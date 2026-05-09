# -*- coding: utf-8 -*-
import os
import json
import asyncio
import hashlib
import httpx
import re
from pathlib import Path
from datetime import datetime, UTC
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential

# 核心库
from supabase import create_client, Client
from playwright.async_api import async_playwright
from google import genai
from google.genai import types

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = _PROJECT_ROOT / ".env.local"
if not _ENV_FILE.is_file():
    _ENV_FILE = Path(__file__).resolve().parents[1] / ".env.local"
load_dotenv(dotenv_path=_ENV_FILE)

# 促销文案里易被误识别为「优惠码」的英文词（如 24 HOURS、LIMITED TIME）
COUPON_DENYLIST = frozenset(
    {
        "HOURS",
        "TODAY",
        "TONIGHT",
        "NIGHT",
        "NIGHTS",
        "DAYS",
        "DAY",
        "WEEKS",
        "WEEK",
        "MONTH",
        "MONTHS",
        "ORDER",
        "ORDERS",
        "SHIPPING",
        "STORE",
        "STORES",
        "SHOP",
        "FREE",
        "SAVE",
        "SALE",
        "SALES",
        "DEALS",
        "DEAL",
        "SUPER",
        "HAPPY",
        "EARLY",
        "FLASH",
        "ONLY",
        "JUST",
        "LAST",
        "FIRST",
        "FULL",
        "HALF",
        "HOME",
        "SITE",
        "WIDE",
        "CARD",
        "BACK",
        "OFF",
        "SPRING",
        "SUMMER",
        "WINTER",
        "FALL",
        "LIMITED",
        "SELECT",
        "ITEMS",
        "OFFER",
        "OFFERS",
        "EXTRA",
        "SLEEP",
        "REST",
        "BED",
        "BEDS",
        "VIP",
        "TIME",
        "TIMES",
        "LEFT",
        "LEFTS",
        "MORE",
        "LESS",
        "YEAR",
        "YEARS",
        "MEMORIAL",
        "LABOR",
        "FRIDAY",
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "SATURDAY",
        "SUNDAY",
        "CANNOT",
        "COMBINE",
        "OTHER",
        "LINK",
        "CLICK",
        "HERE",
        "SIZE",
        "SIZES",
    }
)


def normalize_coupon_token(raw: str | None) -> str | None:
    if raw is None:
        return None
    c = re.sub(r"[^A-Z0-9]", "", str(raw).strip().upper())
    if len(c) < 4 or len(c) > 16:
        return None
    return c


def coupon_token_is_plausible(token: str | None) -> bool:
    if not token:
        return False
    u = token.upper().strip()
    if len(u) < 4:
        return False
    if u in COUPON_DENYLIST:
        return False
    # 短纯字母 token 多半是版面词（真实码多为字母+数字如 MOM15）
    if u.isalpha() and len(u) <= 6:
        return False
    return True


def apply_brand_site_coupon_fallback(brand: str, data: dict) -> None:
    """无效/噪声码清空；支持站点级默认券（FluffCo → MOM15，可由 FLUFFCO_SITE_COUPON 覆盖）。"""
    raw = data.get("coupon_code")
    n = normalize_coupon_token(raw) if raw else None
    if coupon_token_is_plausible(n):
        data["coupon_code"] = n[:24]
        return
    fb_map = {
        "FluffCo": os.getenv("FLUFFCO_SITE_COUPON", "MOM15").strip().upper(),
    }
    fb = fb_map.get((brand or "").strip())
    if fb and re.fullmatch(r"[A-Z0-9]{4,16}", fb):
        data["coupon_code"] = fb[:24]
    else:
        data["coupon_code"] = None


# --- LLM 审计（Gemini 主 / DeepSeek 备）---
GEMINI_MODEL_ID = "gemini-2.5-flash"
GEMINI_AUDIT_LABEL = "Gemini-2.5-Flash"
DEEPSEEK_MODEL_ID = "deepseek-chat"
DEEPSEEK_AUDIT_LABEL = "DeepSeek-Chat"
DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions"

# --- 强制提前注入 ---
# 这样可以确保所有后续初始化的库（httpx, playwright, genai）都读取到同一个配置
if os.getenv("PROXY_URL"):
    os.environ["HTTP_PROXY"] = os.getenv("PROXY_URL")
    os.environ["HTTPS_PROXY"] = os.getenv("PROXY_URL")

class IntelligenceProvider:
    """情报供应商：Serper API 舆情采集"""

    def __init__(self, api_key):
        self.api_key = api_key
        self.url = "https://google.serper.dev/search"

    async def fetch_social_proof(self, query, product_id=None, supabase_client=None):
        all_evidence = []
        review_count = 0
        headers = {
            "X-API-KEY": self.api_key, 
            "Content-Type": "application/json"
        }
        
        # 构造精确的请求体，不要包含任何自定义字段
        payload = {
            "q": f"{query} user experience reviews reddit",
            "num": 100,  # 确保是整数
            "page": 1
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            try:
                # 发送请求
                resp = await client.post(
                    self.url, 
                    headers=headers, 
                    json=payload # httpx 会自动处理成正确的 JSON
                )
                
                # 如果还是 400，打印出详细的错误信息
                if resp.status_code != 200:
                    print(f"❌ Serper 报错: {resp.status_code} - {resp.text}")
                    return "", 0

                data = resp.json()
                organic_results = data.get("organic", []) or []
                review_count = len(organic_results)

                # ... 后续处理逻辑保持不变 ...
                for item in organic_results[:10]:
                    all_evidence.append(f"🔍 SOURCE: {item.get('title')}\nCONTEXT: {item.get('snippet')}")

                # 存储到 Supabase 的逻辑独立出来，不要混合在请求体里
                if product_id and supabase_client:
                    evidence_text = "\n\n".join(all_evidence)
                    supabase_client.table("audit_products").update({
                        "evidence_log": evidence_text,
                        "review_count": review_count,
                        "updated_at": datetime.now(UTC).isoformat(),
                    }).eq("id", product_id).execute()

            except Exception as e:
                print(f"⚠️ 系统异常: {e}")

        return "\n\n".join(all_evidence), review_count

class ForensicAuditEngine: 
    def __init__(self, brand, model, slug_override=None):
        self.brand = brand
        self.model = model
        # 1. 预处理：将 & 转化为 and，处理空格
        # 2. 正则过滤：只保留字母、数字、连字符
        def slugify(text):
            text = text.lower().replace("&", "and")
            # 将所有非字母数字的字符替换为连字符
            text = re.sub(r'[^a-z0-9]+', '-', text)
            # 去掉首尾多余的连字符
            return text.strip('-')

        self.brand_slug = slugify(brand)
        # 组合后的 slug 也要跑一遍 slugify 确保 model 里的特殊字符被清洗。
        # slug_override：仅当同一 model 多 variant 需拆行记录时再传入唯一串。
        if slug_override:
            self.slug = slugify(slug_override.strip())
        else:
            self.slug = slugify(f"{brand}-{model}")
        
        self.supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
        self.ai_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        self.intel = IntelligenceProvider(os.getenv("SERPER_API_KEY"))

    def generate_hash(self):
        return hashlib.md5(f"{self.slug}-{datetime.now().date()}".encode()).hexdigest()[:8].upper()

    @staticmethod
    def _parse_llm_json_text(text: str) -> dict:
        """解析模型返回的 JSON；兼容 ```json 包裹。"""
        raw = (text or "").strip()
        if raw.startswith("```"):
            lines = raw.split("\n")
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw = "\n".join(lines).strip()
        return json.loads(raw)

    def _chromium_launch_options(self, proxy_settings):
        """默认 Chromium 启动；可选代理与本机 Chrome channel。"""
        slow_mo_ms = 0
        if os.getenv("PLAYWRIGHT_SLOW_MO"):
            try:
                slow_mo_ms = int(os.getenv("PLAYWRIGHT_SLOW_MO", "0"))
            except ValueError:
                slow_mo_ms = 0

        opts = {
            "headless": os.getenv("PLAYWRIGHT_HEADED", "").lower()
            not in ("1", "true", "yes"),
            "slow_mo": slow_mo_ms,
        }
        if proxy_settings and proxy_settings.get("server"):
            opts["proxy"] = proxy_settings
        channel = os.getenv("PLAYWRIGHT_CHROME_CHANNEL", "").strip()
        if channel:
            opts["channel"] = channel
        return opts

    async def _likely_bot_or_challenge_page(self, page) -> bool:
        try:
            title = (await page.title() or "").lower()
            if any(
                x in title
                for x in (
                    "access denied",
                    "just a moment",
                    "attention required",
                    "verify you are human",
                )
            ):
                return True
            snippet = await page.evaluate(
                "() => (document.body && document.body.innerText) ? "
                "document.body.innerText.slice(0, 4000) : ''"
            )
            low = snippet.lower()
            if "cloudflare" in low and "ray id" in low:
                return True
            if "sorry, you have been blocked" in low:
                return True
            if len(snippet.strip()) < 80 and "javascript" in low:
                return True
        except Exception:
            pass
        return False
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=8))
    async def transfer_to_supabase_storage(self, original_url):
        if not original_url: return None
        
        # 确保 URL 是完整的
        if original_url.startswith('//'):
            original_url = 'https:' + original_url

        bucket = "product-images"
        raw_ext = (original_url.split(".")[-1].split("?")[0] or "jpg").lower()
        if raw_ext not in ("jpg", "jpeg", "png", "webp", "gif"):
            raw_ext = "jpg"
        storage_path = f"{self.brand_slug}/{self.slug}.{raw_ext}"

        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                resp = await client.get(original_url, timeout=20.0)
                if resp.status_code != 200:
                    print(f"❌ 图片下载失败 HTTP {resp.status_code}")
                    return None
                ct = (resp.headers.get("content-type") or "").split(";")[0].strip()
                if ct and not ct.startswith("image/"):
                    print(f"❌ 非图片响应 Content-Type: {ct}")
                    return None

                loop = asyncio.get_running_loop()

                def upload():
                    return self.supabase.storage.from_(bucket).upload(
                        path=storage_path,
                        file=resp.content,
                        file_options={
                            "content-type": ct or "image/jpeg",
                            "upsert": "true",
                        },
                    )

                await loop.run_in_executor(None, upload)

                res = self.supabase.storage.from_(bucket).get_public_url(storage_path)
                if isinstance(res, str):
                    return res
                if isinstance(res, dict):
                    return res.get("publicUrl") or res.get("public_url")
                return str(res) if res else None
        except Exception as e:
            print(f"❌ 图片转储失败: {e}")
            return None

    async def _extract_json_ld_safe_fallback(self, page):
        """
        锚定失败后兜底：绝不单独使用 AggregateOffer.lowPrice（跨规格最低价），
        仅接受普通 Offer 标价，或 offerCount===1 且 low/high 同对象成对的 AggregateOffer。
        """
        script = r"""() => {
          function walk(node, fn) {
            if (node === null || node === undefined) return;
            if (Array.isArray(node)) { for (const x of node) walk(x, fn); return; }
            if (typeof node !== 'object') return;
            fn(node);
            for (const k of Object.keys(node)) walk(node[k], fn);
          }
          function priceFromOffer(o) {
            if (!o || typeof o !== 'object') return null;
            const t = o['@type'];
            const types = Array.isArray(t) ? t : (t ? [t] : []);
            const isAgg = types.some(x => String(x).toLowerCase() === 'aggregateoffer');
            if (isAgg) {
              const oc = o.offerCount;
              const low = parseFloat(String(o.lowPrice || '').replace(/,/g, ''));
              const high = parseFloat(String(o.highPrice || '').replace(/,/g, ''));
              if (!isNaN(low) && low > 0 && !isNaN(high) && high > low && (oc === 1 || oc === '1'))
                return low;
              return null;
            }
            if (o.price != null) {
              const p = parseFloat(String(o.price).replace(/,/g, ''));
              if (!isNaN(p) && p > 0) return p;
            }
            if (o.priceSpecification && o.priceSpecification.price != null) {
              const p = parseFloat(String(o.priceSpecification.price).replace(/,/g, ''));
              if (!isNaN(p) && p > 0) return p;
            }
            return null;
          }
          function findInProduct(n) {
            const t = n['@type'];
            const types = Array.isArray(t) ? t : (t ? [t] : []);
            if (!types.some(x => String(x).toLowerCase() === 'product')) return null;
            const offers = n.offers;
            if (!offers) return null;
            const olist = Array.isArray(offers) ? offers : [offers];
            for (const o of olist) {
              const pr = priceFromOffer(o);
              if (pr != null) return pr;
            }
            return null;
          }
          const scripts = document.querySelectorAll('script[type="application/ld+json"]');
          for (const s of scripts) {
            try {
              const j = JSON.parse(s.textContent);
              const roots = [];
              if (Array.isArray(j)) roots.push(...j);
              else {
                roots.push(j);
                if (j['@graph'] && Array.isArray(j['@graph'])) roots.push(...j['@graph']);
              }
              for (const root of roots) {
                const pr = findInProduct(root);
                if (pr != null) return pr;
              }
              let found = null;
              walk(j, (node) => {
                if (found != null) return;
                if (node && typeof node === 'object') {
                  const pr = findInProduct(node);
                  if (pr != null) found = pr;
                }
              });
              if (found != null) return found;
            } catch (e) {}
          }
          return null;
        }"""
        try:
            val = await page.evaluate(script)
            return float(val) if val is not None else None
        except Exception:
            return None

    async def _extract_json_ld_extras(self, page):
        """从 JSON-LD 提取 AggregateOffer.highPrice（划线/原价）与 schema.org availability。"""
        script = r"""() => {
          let highPrice = null;
          let availability = null;
          function parseAvail(av) {
            if (av == null) return null;
            const s = String(av);
            const low = s.toLowerCase();
            if (low.includes('instock')) return 'IN_STOCK';
            if (low.includes('outofstock')) return 'OUT_OF_STOCK';
            if (low.includes('soldout')) return 'OUT_OF_STOCK';
            if (low.includes('limitedavailability')) return 'LIMITED';
            if (low.includes('preorder')) return 'PRE_ORDER';
            const seg = s.split('/').pop();
            return seg && seg.length < 48 ? seg.replace(/#/g, '') : null;
          }
          function num(x) {
            if (x == null) return null;
            const p = parseFloat(String(x).replace(/,/g, ''));
            return !isNaN(p) && p > 0 ? p : null;
          }
          function handleOffer(o) {
            if (!o || typeof o !== 'object') return;
            const t = o['@type'];
            const types = Array.isArray(t) ? t : (t ? [t] : []);
            const isAgg = types.some(function(x) {
              return String(x).toLowerCase() === 'aggregateoffer';
            });
            if (isAgg && o.highPrice != null) {
              const hp = num(o.highPrice);
              if (hp != null) {
                highPrice = highPrice == null ? hp : Math.max(highPrice, hp);
              }
            }
            if (o.availability) {
              const a = parseAvail(o.availability);
              if (a) availability = a;
            }
            if (o.offers) {
              const ol = Array.isArray(o.offers) ? o.offers : [o.offers];
              for (let i = 0; i < ol.length; i++) handleOffer(ol[i]);
            }
          }
          function handleProduct(n) {
            if (!n || typeof n !== 'object') return;
            const t = n['@type'];
            const types = Array.isArray(t) ? t : (t ? [t] : []);
            if (!types.some(function(x) {
              return String(x).toLowerCase() === 'product';
            })) return;
            if (n.offers) {
              const ol = Array.isArray(n.offers) ? n.offers : [n.offers];
              for (let i = 0; i < ol.length; i++) handleOffer(ol[i]);
            }
            if (n.availability) {
              const a = parseAvail(n.availability);
              if (a) availability = a;
            }
          }
          const scripts = document.querySelectorAll(
            'script[type="application/ld+json"]'
          );
          for (let si = 0; si < scripts.length; si++) {
            try {
              const j = JSON.parse(scripts[si].textContent);
              const roots = [];
              if (Array.isArray(j)) {
                for (let i = 0; i < j.length; i++) roots.push(j[i]);
              } else {
                roots.push(j);
                if (j['@graph'] && Array.isArray(j['@graph'])) {
                  for (let i = 0; i < j['@graph'].length; i++) {
                    roots.push(j['@graph'][i]);
                  }
                }
              }
              for (let ri = 0; ri < roots.length; ri++) {
                handleProduct(roots[ri]);
              }
              for (let ri = 0; ri < roots.length; ri++) {
                const stack = [roots[ri]];
                while (stack.length) {
                  const cur = stack.pop();
                  if (!cur || typeof cur !== 'object') continue;
                  handleProduct(cur);
                  const keys = Object.keys(cur);
                  for (let ki = 0; ki < keys.length; ki++) {
                    const v = cur[keys[ki]];
                    if (v && typeof v === 'object') stack.push(v);
                  }
                }
              }
            } catch (e) {}
          }
          return { highPrice: highPrice, availability: availability };
        }"""
        try:
            return await page.evaluate(script)
        except Exception:
            return None

    async def _extract_json_ld_anchor_commerce(self, page):
        """
        固定基准优先 + fallback：从 JSON-LD 中选单一 Offer（规格标签匹配 Queen / Standard 等），
        使 sale 价与 list/compare-at（若有）来自同一对象，避免 AggregateOffer 的 low/high 跨规格错配。
        """
        script = r"""() => {
          const PREFERRED = [
            'Queen', 'Full', 'King', 'California King', 'Cal King',
            'Twin XL', 'Twin', 'Standard', 'Original', 'Medium'
          ];
          const BAD = /travel|sample|swatch|trial\s*size|mini(?!\s*k)/i;

          const __sp = new URLSearchParams(window.location.search);
          const variantIdPin = __sp.get('variant');

          function normTypes(n) {
            const t = n['@type'];
            return (Array.isArray(t) ? t : (t ? [t] : [])).map(function(x) {
              return String(x).toLowerCase();
            });
          }
          function num(x) {
            if (x == null) return null;
            const p = parseFloat(String(x).replace(/,/g, ''));
            return !isNaN(p) && p > 0 ? p : null;
          }
          function parseAvail(av) {
            if (av == null) return null;
            const s = String(av);
            const low = s.toLowerCase();
            if (low.includes('instock')) return 'IN_STOCK';
            if (low.includes('outofstock')) return 'OUT_OF_STOCK';
            if (low.includes('soldout')) return 'OUT_OF_STOCK';
            if (low.includes('limitedavailability')) return 'LIMITED';
            if (low.includes('preorder')) return 'PRE_ORDER';
            const seg = s.split('/').pop();
            return seg && seg.length < 48 ? seg.replace(/#/g, '') : null;
          }
          function saleFromOffer(o) {
            if (!o || typeof o !== 'object') return null;
            const types = normTypes(o);
            if (types.indexOf('aggregateoffer') !== -1) {
              if (o.lowPrice != null) return num(o.lowPrice);
              return null;
            }
            const ps = o.priceSpecification;
            if (Array.isArray(ps)) {
              let salePV = null;
              let listPV = null;
              for (let i = 0; i < ps.length; i++) {
                const p = ps[i];
                if (!p || typeof p !== 'object') continue;
                const pt = String(p.priceType || '').toLowerCase();
                const pv = num(p.price);
                if (!pv) continue;
                if (pt.indexOf('sale') !== -1 || pt.indexOf('saleprice') !== -1)
                  salePV = pv;
                if (
                  pt.indexOf('list') !== -1 ||
                  pt.indexOf('listprice') !== -1 ||
                  pt.indexOf('strik') !== -1 ||
                  pt.indexOf('regular') !== -1
                )
                  listPV = pv;
              }
              if (salePV != null) return salePV;
              const top = num(o.price);
              if (top && listPV && top < listPV) return top;
              if (top) return top;
              return null;
            }
            if (o.price != null) return num(o.price);
            if (ps && typeof ps === 'object' && !Array.isArray(ps) && ps.price != null) {
              return num(ps.price);
            }
            return null;
          }
          function listFromSimpleOffer(o) {
            if (!o || typeof o !== 'object') return null;
            const sale = num(o.price);
            const ps = o.priceSpecification;
            if (Array.isArray(ps)) {
              for (let i = 0; i < ps.length; i++) {
                const p = ps[i];
                if (!p || typeof p !== 'object') continue;
                const pt = String(p.priceType || '').toLowerCase();
                const pv = num(p.price);
                if (!pv) continue;
                if (
                  pt.indexOf('list') !== -1 ||
                  pt.indexOf('listprice') !== -1 ||
                  pt.indexOf('strik') !== -1 ||
                  pt.indexOf('regular') !== -1
                )
                  return pv;
              }
              let best = null;
              for (let j = 0; j < ps.length; j++) {
                const q = ps[j];
                if (!q || typeof q !== 'object') continue;
                const qv = num(q.price);
                if (!qv || !sale) continue;
                if (qv > sale && (!best || qv > best)) best = qv;
              }
              return best;
            }
            if (ps && typeof ps === 'object' && ps.price != null) {
              const pv = num(ps.price);
              if (sale && pv && pv > sale) return pv;
              return pv;
            }
            return null;
          }
          function flattenOffers(offers) {
            if (!offers) return [];
            const arr = Array.isArray(offers) ? offers : [offers];
            const out = [];
            for (let i = 0; i < arr.length; i++) {
              const o = arr[i];
              if (!o || typeof o !== 'object') continue;
              const types = normTypes(o);
              if (types.indexOf('aggregateoffer') !== -1 && o.offers) {
                const sub = Array.isArray(o.offers) ? o.offers : [o.offers];
                for (let j = 0; j < sub.length; j++) out.push(sub[j]);
              } else {
                out.push(o);
              }
            }
            return out;
          }
          function variantLabel(v, parentName) {
            const parts = [v.name, v.sku, parentName, v.description].filter(Boolean);
            return parts.join(' ').slice(0, 600);
          }

          const candidates = [];
          const seen = new Set();
          function addCandidate(label, sale, msrpHint, meta, offerObj) {
            if (sale == null || sale <= 0) return;
            let msrp = null;
            if (msrpHint != null && msrpHint > sale) msrp = msrpHint;
            const m = Object.assign({}, meta || {});
            if (variantIdPin && offerObj && typeof offerObj === 'object') {
              const u = offerObj.url || offerObj['@id'] || '';
              if (String(u).indexOf(variantIdPin) !== -1) m.pinned = true;
            }
            const key =
              String(Math.round(sale * 100)) +
              '|' +
              String(label || '')
                .trim()
                .toLowerCase()
                .slice(0, 96);
            if (seen.has(key)) return;
            seen.add(key);
            candidates.push({
              label: String(label || '').trim(),
              sale: sale,
              msrp: msrp,
              meta: m
            });
          }

          function processProduct(prod) {
            if (!prod || typeof prod !== 'object') return;
            const types = normTypes(prod);
            if (types.indexOf('product') === -1) return;
            const pname = prod.name || '';

            if (prod.hasVariant) {
              const vars = Array.isArray(prod.hasVariant)
                ? prod.hasVariant
                : [prod.hasVariant];
              for (let vi = 0; vi < vars.length; vi++) {
                const v = vars[vi];
                if (!v || typeof v !== 'object') continue;
                const vTypes = normTypes(v);
                if (vTypes.indexOf('product') === -1) continue;
                const vl = variantLabel(v, pname);
                const offs = flattenOffers(v.offers);
                for (let oi = 0; oi < offs.length; oi++) {
                  const o = offs[oi];
                  if (!o || typeof o !== 'object') continue;
                  const oTypes = normTypes(o);
                  if (oTypes.indexOf('aggregateoffer') !== -1) {
                    const low = num(o.lowPrice);
                    const high = num(o.highPrice);
                    const oc = o.offerCount;
                    if (low && high && high > low) {
                      if (oc === 1 || oc === '1') {
                        addCandidate(vl, low, high, { src: 'var_agg_1' }, o);
                      } else {
                        addCandidate(vl, low, null, { src: 'var_agg_n' }, o);
                      }
                    } else if (low) {
                      addCandidate(vl, low, null, { src: 'var_agg_low' }, o);
                    }
                  } else {
                    const sale = saleFromOffer(o);
                    const listP = listFromSimpleOffer(o);
                    addCandidate(vl, sale, listP, { src: 'var_offer' }, o);
                  }
                }
              }
            }

            const offs = flattenOffers(prod.offers);
            for (let oi = 0; oi < offs.length; oi++) {
              const o = offs[oi];
              if (!o || typeof o !== 'object') continue;
              const oTypes = normTypes(o);
              if (oTypes.indexOf('aggregateoffer') !== -1) {
                const low = num(o.lowPrice);
                const high = num(o.highPrice);
                const oc = o.offerCount;
                if (low && high && high > low) {
                  if (oc === 1 || oc === '1') {
                    addCandidate(pname + ' [aggregate]', low, high, { src: 'root_agg_1' }, o);
                  } else {
                    addCandidate(pname + ' [aggregate]', low, null, { src: 'root_agg_n' }, o);
                  }
                } else if (low) {
                  addCandidate(pname + ' [aggregate]', low, null, { src: 'root_agg' }, o);
                }
              } else {
                const sale = saleFromOffer(o);
                const listP = listFromSimpleOffer(o);
                addCandidate(pname, sale, listP, { src: 'root_offer' }, o);
              }
            }
          }

          function walk(node, fn) {
            if (node === null || node === undefined) return;
            if (Array.isArray(node)) {
              for (let i = 0; i < node.length; i++) walk(node[i], fn);
              return;
            }
            if (typeof node !== 'object') return;
            fn(node);
            const keys = Object.keys(node);
            for (let ki = 0; ki < keys.length; ki++) walk(node[keys[ki]], fn);
          }

          let availability = null;
          function snagAvail(n) {
            if (!n || typeof n !== 'object') return;
            if (n.availability) {
              const a = parseAvail(n.availability);
              if (a) availability = a;
            }
          }

          const scripts = document.querySelectorAll(
            'script[type="application/ld+json"]'
          );
          for (let si = 0; si < scripts.length; si++) {
            try {
              const j = JSON.parse(scripts[si].textContent);
              const roots = [];
              if (Array.isArray(j)) {
                for (let i = 0; i < j.length; i++) roots.push(j[i]);
              } else {
                roots.push(j);
                if (j['@graph'] && Array.isArray(j['@graph'])) {
                  for (let i = 0; i < j['@graph'].length; i++) {
                    roots.push(j['@graph'][i]);
                  }
                }
              }
              for (let ri = 0; ri < roots.length; ri++) {
                walk(roots[ri], function(n) {
                  const types = normTypes(n);
                  if (types.indexOf('product') !== -1) processProduct(n);
                  snagAvail(n);
                });
              }
            } catch (e) {}
          }

          function selectBest() {
            if (!candidates.length) return null;
            if (variantIdPin) {
              const pinnedList = candidates.filter(function(c) {
                return c.meta && c.meta.pinned;
              });
              if (pinnedList.length >= 1) return pinnedList[0];
              const byId = candidates.find(function(c) {
                return String(c.label).indexOf(variantIdPin) !== -1;
              });
              if (byId) return byId;
            }
            const lower = function(s) {
              return s.toLowerCase();
            };
            for (let pi = 0; pi < PREFERRED.length; pi++) {
              const pref = PREFERRED[pi];
              const hit = candidates.find(function(c) {
                return lower(c.label).indexOf(lower(pref)) !== -1;
              });
              if (hit) return hit;
            }
            const nonBad = candidates.find(function(c) {
              return !BAD.test(c.label);
            });
            if (nonBad) return nonBad;
            return candidates[0];
          }

          const best = selectBest();
          if (!best) {
            return { price: null, msrp: null, auditVariant: null, availability: availability };
          }
          const auditVariant =
            best.label.length > 160 ? best.label.slice(0, 160) + '…' : best.label;
          return {
            price: best.sale,
            msrp: best.msrp,
            auditVariant: auditVariant || 'ANCHORED_OFFER',
            availability: availability
          };
        }"""
        try:
            raw = await page.evaluate(script)
            if not raw or not isinstance(raw, dict):
                return None
            price = raw.get("price")
            msrp = raw.get("msrp")
            av = raw.get("auditVariant")
            avail = raw.get("availability")
            out = {}
            if price is not None:
                try:
                    pf = float(price)
                    if 5.0 <= pf <= 100000.0:
                        out["price"] = pf
                except (TypeError, ValueError):
                    pass
            if msrp is not None:
                try:
                    mf = float(msrp)
                    if mf > 0:
                        out["msrp"] = mf
                        out["old_price"] = mf
                except (TypeError, ValueError):
                    pass
            if isinstance(av, str) and av.strip():
                out["audit_variant"] = av.strip()[:200]
            if isinstance(avail, str) and avail.strip():
                out["availability"] = str(avail).strip()[:160]
            return out if out else None
        except Exception:
            return None

    async def _extract_shopify_variant_pricing(self, page):
        """
        从 Shopify 前台 meta 读取「与 JSON-LD 同规格」的现价与 compare_at_price（划线）。
        ?variant= 优先；无参数时用 selected_or_first_available_variant、单规格、或 Queen/Standard 等标题匹配。
        FluffCo 等店 JSON-LD 常有售价无划线，必须在锚定价写入后仍执行本函数补全 old_price。
        """
        script = r"""() => {
          try {
            function normMoney(n, isCompare) {
              var x = Number(n);
              if (isNaN(x) || x <= 0) return null;
              if (x >= 50000) return x / 100;
              return x;
            }
            function getProductMeta() {
              if (window.meta && window.meta.product) return window.meta.product;
              if (
                window.ShopifyAnalytics &&
                window.ShopifyAnalytics.meta &&
                window.ShopifyAnalytics.meta.product
              )
                return window.ShopifyAnalytics.meta.product;
              return null;
            }
            function getVariants() {
              var mp = getProductMeta();
              if (mp && mp.variants && mp.variants.length) return mp.variants;
              return null;
            }
            function resolveVid(variants) {
              var sp = new URLSearchParams(window.location.search);
              var vid = sp.get('variant');
              if (vid) return vid;
              var mp = getProductMeta();
              if (mp && mp.selected_or_first_available_variant && mp.selected_or_first_available_variant.id != null)
                return String(mp.selected_or_first_available_variant.id);
              if (mp && mp.selected_variant && mp.selected_variant.id != null)
                return String(mp.selected_variant.id);
              if (variants && variants.length === 1) return String(variants[0].id);
              var PREFS = [
                'Queen',
                'California King',
                'Cal King',
                'King',
                'Full',
                'Twin XL',
                'Twin',
                'Standard',
                'Original'
              ];
              if (variants && variants.length) {
                for (var pi = 0; pi < PREFS.length; pi++) {
                  var pref = PREFS[pi].toLowerCase();
                  for (var i = 0; i < variants.length; i++) {
                    var t = String(
                      variants[i].public_title ||
                        variants[i].title ||
                        variants[i].name ||
                        ''
                    ).toLowerCase();
                    if (t.indexOf(pref) !== -1) return String(variants[i].id);
                  }
                }
                return String(variants[0].id);
              }
              return null;
            }
            function pick(variants, vid) {
              if (!variants || !variants.length || !vid) return null;
              for (var i = 0; i < variants.length; i++) {
                var v = variants[i];
                if (String(v.id) !== String(vid)) continue;
                var pr = normMoney(v.price, false);
                if (pr == null) continue;
                var cmp = v.compare_at_price != null ? normMoney(v.compare_at_price, true) : null;
                var title = v.public_title || v.title || v.name || '';
                return { price: pr, compare_at_price: cmp, title: String(title) };
              }
              return null;
            }
            var variants = getVariants();
            var vid = resolveVid(variants);
            if (!vid || !variants) return null;
            var r = pick(variants, vid);
            if (r) return r;
          } catch (e) {}
          return null;
        }"""
        try:
            raw = await page.evaluate(script)
            if not raw or not isinstance(raw, dict):
                return None
            out = {}
            p = raw.get("price")
            if p is not None:
                try:
                    pf = float(p)
                    if 5.0 <= pf <= 100000.0:
                        out["price"] = pf
                except (TypeError, ValueError):
                    pass
            cmp = raw.get("compare_at_price")
            if cmp is not None and out.get("price") is not None:
                try:
                    cf = float(cmp)
                    if cf > float(out["price"]):
                        out["msrp"] = cf
                        out["old_price"] = cf
                except (TypeError, ValueError):
                    pass
            tit = raw.get("title")
            if isinstance(tit, str) and tit.strip():
                out["audit_variant"] = tit.strip()[:200]
            return out if out else None
        except Exception:
            return None

    async def _extract_fluffco_product_price_dom(self, page):
        """
        FluffCo（Shopify）：前台使用自定义元素 <product-price>，
        划线价在 span.compare，现价在 span.final.price-field（见 .desktop.module.block-price）。
        JSON-LD / window.meta 有时无 compare_at，必须从 DOM 配对。
        """
        script = r"""() => {
          try {
            function money(txt) {
              if (txt == null) return null;
              var m = String(txt).match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
              if (!m) return null;
              var v = parseFloat(m[1].replace(/,/g, ''));
              if (isNaN(v) || v < 5 || v > 100000) return null;
              return v;
            }
            var root =
              document.querySelector('.desktop.module.block-price product-price') ||
              document.querySelector('.module.block-price product-price') ||
              document.querySelector('product-price');
            if (!root) return null;
            var cmpEl = root.querySelector('.compare');
            var finEl =
              root.querySelector('.final.price-field') ||
              root.querySelector('span.final.price-field') ||
              root.querySelector('.final');
            var sale = finEl ? money(finEl.innerText || finEl.textContent) : null;
            var cmp = cmpEl ? money(cmpEl.innerText || cmpEl.textContent) : null;
            var out = {};
            if (sale != null) out.sale = sale;
            if (cmp != null) out.compare = cmp;
            return Object.keys(out).length ? out : null;
          } catch (e) {}
          return null;
        }"""
        try:
            raw = await page.evaluate(script)
            if not raw or not isinstance(raw, dict):
                return None
            out = {}
            if raw.get("sale") is not None:
                try:
                    sf = float(raw["sale"])
                    if 5.0 <= sf <= 100000.0:
                        out["sale"] = sf
                except (TypeError, ValueError):
                    pass
            if raw.get("compare") is not None:
                try:
                    cf = float(raw["compare"])
                    if 5.0 <= cf <= 100000.0:
                        out["compare"] = cf
                except (TypeError, ValueError):
                    pass
            return out if out else None
        except Exception:
            return None

    async def _extract_dom_promo_paired_prices(self, page, selectors: list[str]):
        """
        主价格容器内多数字场景：过滤 /mo 分期等噪音后，若存在两档且 max>min，则
        min 为促销现价、max 为划线价（与页面上「原价 + 促销价」展示一致）。
        """
        if not selectors:
            return None
        script = r"""(selectors) => {
          function parseContainer(el) {
            if (!el) return null;
            var text = el.innerText || '';
            var re = /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
            var nums = [];
            var mm;
            while ((mm = re.exec(text)) !== null) {
              var start = mm.index;
              var head = text.slice(Math.max(0, start - 42), start);
              var tail = text.slice(
                start + mm[0].length,
                Math.min(text.length, start + mm[0].length + 14)
              );
              var ctx = text
                .slice(
                  Math.max(0, start - 16),
                  Math.min(text.length, start + mm[0].length + 16)
                )
                .toLowerCase();
              if (
                /\/\s*mo|\bper\s*mo|\bwk\b|\bweek\b|\bday\b|\bpayment\s*plan|\bfinanc(e|ing)/i.test(
                  ctx
                )
              )
                continue;
              if (
                /(save|saved|savings|discount|rebate|rewards|credit|cash\s*back|earn|bonus)\s*$/i.test(
                  head
                )
              )
                continue;
              if (/(get|take|receive|up\s+to)\s*$/i.test(head)) continue;
              if (/^\s*(off|discount|rebate|back)\b/i.test(tail)) continue;
              if (/\b(save|discount)\s+\$?\s*$/i.test(head)) continue;
              var v = parseFloat(mm[1].replace(/,/g, ''));
              if (v >= 9 && v <= 100000) nums.push(v);
            }
            if (nums.length === 0) return null;
            var significant = nums.filter(function (x) {
              return x >= 49;
            });
            var use = significant.length ? significant : nums;
            if (use.length >= 2) {
              var hi0 = Math.max.apply(null, use);
              use = use.filter(function (x) {
                if (x >= hi0 * 0.42) return true;
                if (x >= 799) return true;
                return false;
              });
            }
            if (use.length === 0) return null;
            if (use.length === 1) return { sale: use[0], list: null };
            var hi = Math.max.apply(null, use);
            var lo = Math.min.apply(null, use);
            if (hi > lo * 1.01) return { sale: lo, list: hi };
            return { sale: use[use.length - 1], list: null };
          }
          for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);
            var r = parseContainer(el);
            if (r && r.sale) return r;
          }
          return null;
        }"""
        try:
            raw = await page.evaluate(script, selectors)
            if not raw or not isinstance(raw, dict):
                return None
            out = {}
            s = raw.get("sale")
            if s is not None:
                try:
                    sf = float(s)
                    if 5.0 <= sf <= 100000.0:
                        out["sale"] = sf
                except (TypeError, ValueError):
                    pass
            lst = raw.get("list")
            if lst is not None:
                try:
                    lf = float(lst)
                    if lf > 0:
                        out["list"] = lf
                except (TypeError, ValueError):
                    pass
            return out if out else None
        except Exception:
            return None

    async def _extract_promotional_intel(self, page):
        """
        扫描含 OFF / SAVE / CODE 的文案节点与常见「隐式」来源，提取优惠码与百分比折扣。
        """
        script = r"""() => {
          const KW = /(?:OFF|SAVE|CODE)/i;
          const lines = [];
          const seen = new Set();
          function addLine(t) {
            if (!t || typeof t !== 'string') return;
            var s = t.trim();
            if (s.length < 4 || s.length > 320) return;
            if (!KW.test(s)) return;
            var k = s.slice(0, 140);
            if (seen.has(k)) return;
            seen.add(k);
            lines.push(s);
          }
          try {
            document.querySelectorAll('div, span, p, li, strong, em, button, a, label').forEach(function(el) {
              addLine(el.innerText || '');
            });
          } catch (e) {}
          try {
            document.querySelectorAll('[data-coupon], [data-promo-code], [data-discount-code]').forEach(function(el) {
              var a = el.getAttribute('data-coupon') || el.getAttribute('data-promo-code') ||
                el.getAttribute('data-discount-code');
              if (a) addLine('CODE ' + a);
            });
          } catch (e) {}
          try {
            var params = new URLSearchParams(window.location.search);
            ['discount', 'promo', 'coupon', 'code'].forEach(function(k) {
              var v = params.get(k);
              if (v && v.length >= 4 && v.length <= 40) addLine('CODE ' + v);
            });
          } catch (e) {}
          var blob = lines.slice(0, 80).join('\n').slice(0, 12000);
          var blobU = blob.toUpperCase();
          var out = {
            coupon_code: null,
            discount_percent: null,
            promo_text_snippet: blob.slice(0, 600)
          };
          var DENY = {
            HOURS:1,TODAY:1,TONIGHT:1,NIGHT:1,NIGHTS:1,DAYS:1,DAY:1,WEEKS:1,WEEK:1,
            MONTH:1,MONTHS:1,ORDER:1,ORDERS:1,SHIPPING:1,STORE:1,STORES:1,SHOP:1,
            FREE:1,SAVE:1,SALE:1,SALES:1,DEALS:1,DEAL:1,SUPER:1,HAPPY:1,EARLY:1,
            FLASH:1,ONLY:1,JUST:1,LAST:1,FIRST:1,HOME:1,SITE:1,WIDE:1,CARD:1,BACK:1,
            OFF:1,SPRING:1,SUMMER:1,WINTER:1,FALL:1,LIMITED:1,SELECT:1,ITEMS:1,
            OFFER:1,OFFERS:1,EXTRA:1,SLEEP:1,REST:1,BED:1,BEDS:1,VIP:1,TIME:1,
            TIMES:1,LEFT:1,MORE:1,LESS:1,YEAR:1,MEMORIAL:1,LABOR:1,FRIDAY:1,
            MONDAY:1,TUESDAY:1,WEDNESDAY:1,THURSDAY:1,SATURDAY:1,SUNDAY:1,
            CANNOT:1,COMBINE:1,OTHER:1,LINK:1,CLICK:1,HERE:1,SIZE:1,SIZES:1
          };
          function okCoupon(c) {
            if (!c || c.length < 4 || c.length > 14) return false;
            if (DENY[c]) return false;
            if (/^[A-Z]+$/.test(c) && c.length <= 6) return false;
            return true;
          }
          var exPat = /\b(MOM\d{2}|SAVE\d{2}|EXTRA\d{2}|BF\d{2}|FLASH\d{2}|VIP\d{2,})\b/i;
          var exM = blobU.match(exPat);
          if (exM) {
            var ex = exM[1].replace(/[^A-Z0-9]/gi, '').toUpperCase();
            if (okCoupon(ex)) out.coupon_code = ex;
          }
          var codeRe = /\b(?:code|coupon|promo)\s*[:\s#]+\s*([A-Z0-9][A-Z0-9_-]{3,15})\b/gi;
          var m;
          if (!out.coupon_code) {
            while ((m = codeRe.exec(blob)) !== null) {
              var c1 = m[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
              if (okCoupon(c1)) {
                out.coupon_code = c1;
                break;
              }
            }
          }
          if (!out.coupon_code) {
            var digRe = /\b([A-Z]{2,}\d{2,}[A-Z0-9]*)\b/g;
            var dm;
            while ((dm = digRe.exec(blobU)) !== null) {
              var t = dm[1].replace(/[^A-Z0-9]/g, '');
              if (okCoupon(t)) {
                out.coupon_code = t;
                break;
              }
            }
          }
          var pctM = blob.match(/(\d{1,2})%\s*(?:off|discount|savings)/i);
          if (pctM) out.discount_percent = parseInt(pctM[1], 10);
          return out;
        }"""
        try:
            raw = await page.evaluate(script)
            if not raw or not isinstance(raw, dict):
                return None
            out = {}
            cc = raw.get("coupon_code")
            if isinstance(cc, str) and cc.strip():
                out["coupon_code"] = cc.strip().upper()[:24]
            dp = raw.get("discount_percent")
            if dp is not None:
                try:
                    dpf = float(dp)
                    if 0 < dpf <= 95:
                        out["promo_discount_percent"] = dpf
                except (TypeError, ValueError):
                    pass
            sn = raw.get("promo_text_snippet")
            if isinstance(sn, str) and sn.strip():
                out["promo_text_snippet"] = sn.strip()[:600]
            return out if out else None
        except Exception:
            return None

    @staticmethod
    def augment_promo_from_plain_text(raw_text: str, data: dict) -> None:
        """从正文再扫一遍优惠码与百分比（补齐浏览器漏网）。"""
        if not raw_text:
            return
        blob = raw_text.upper()
        if not data.get("coupon_code"):
            m = re.search(
                r"(?:CODE|COUPON|PROMO)\s*[:\s#]+\s*([A-Z0-9][A-Z0-9_-]{3,15})\b",
                blob,
            )
            if m:
                c = normalize_coupon_token(m.group(1))
                if c and coupon_token_is_plausible(c):
                    data["coupon_code"] = c[:24]
            if not data.get("coupon_code"):
                m2 = re.search(
                    r"\b(MOM\d{2}|SAVE\d{2}|EXTRA\d{2}|BF\d{2}|FLASH\d{2}|[A-Z]{2,}\d{2,}[A-Z0-9]*)\b",
                    blob,
                )
                if m2:
                    c2 = normalize_coupon_token(m2.group(1))
                    if c2 and coupon_token_is_plausible(c2):
                        data["coupon_code"] = c2[:24]
        if data.get("promo_discount_percent") is None:
            pm = re.search(r"(\d{1,2})%\s*(?:OFF|DISCOUNT)", blob)
            if pm:
                try:
                    p = float(pm.group(1))
                    if 0 < p <= 95:
                        data["promo_discount_percent"] = p
                except (TypeError, ValueError):
                    pass

    @staticmethod
    def compute_total_savings(
        msrp: float | None,
        price: float | None,
        promo_discount_percent: float | None = None,
    ):
        """
        在已知 MSRP 与当前页价格时估算总优惠额。
        若扫到额外百分比券（相对当前标价的再折扣），则有效支付价 = price * (1 - pct/100)，
        total_savings = msrp - 有效支付价；否则 total_savings = msrp - price。
        """
        if msrp is None or price is None:
            return None
        try:
            m = float(msrp)
            p = float(price)
        except (TypeError, ValueError):
            return None
        if m <= 0 or p < 0:
            return None
        if promo_discount_percent is not None:
            try:
                d = float(promo_discount_percent)
                if 0 < d <= 95:
                    effective = p * (1.0 - d / 100.0)
                    return max(0.0, m - effective)
            except (TypeError, ValueError):
                pass
        return max(0.0, m - p)
        
    async def fetch_site_data(self, url):
        """默认 Playwright 扫描（无品牌专用反爬强化）。"""
        print(f"🌐 深度扫描官网: {url}")
        data = {
            "price": 0.0,
            "original_image": None,
            "raw_text": "",
            "status": 200,
            "msrp": None,
            "old_price": None,
            "availability": None,
            "audit_variant": None,
            "coupon_code": None,
            "promo_discount_percent": None,
            "promo_text_snippet": None,
        }

        BRAND_MAP = {
            "Saatva": {
                "price_selector": "[data-testid='product-price']",
                "price_selectors_fallback": [
                    '[data-testid="product-price"]',
                    "[itemprop=\"price\"]",
                    "[data-testid*=\"price\"]",
                    ".product-detail__price",
                    "[class*=\"ProductPrice\"]",
                ],
                "image_selector": "meta[property='og:image']",
                "wait_for": "h1",
            },
            "Sleep & Beyond": {
                "price_selector": ".summary p.price",
                "image_selector": ".woocommerce-product-gallery__image img.wp-post-image",
                "wait_for": ".product_title",
            },
            "FluffCo": {
                "price_selector": "product-price .final.price-field",
                "price_selectors_fallback": [
                    ".desktop.module.block-price product-price",
                    "product-price",
                    ".product-single__price",
                ],
                "image_selector": ".product-single__photo--featured img",
                "wait_for": "product-price, .desktop.module.block-price",
            },
        }

        config = BRAND_MAP.get(self.brand, {})
        selector_chain: list[str] = []
        if config.get("price_selector"):
            selector_chain.append(config["price_selector"])
        for fb in config.get("price_selectors_fallback") or []:
            if fb and fb not in selector_chain:
                selector_chain.append(fb)
        proxy_url = os.getenv("PROXY_URL")
        proxy_settings = {"server": proxy_url} if proxy_url else None

        goto_timeout = 30000
        wait_until = "domcontentloaded"

        async with async_playwright() as p:
            browser = await p.chromium.launch(**self._chromium_launch_options(proxy_settings))
            context = await browser.new_context()
            page = await context.new_page()

            try:
                response = await page.goto(
                    url, wait_until=wait_until, timeout=goto_timeout
                )

                # 如果还是超时或没响应，手动抛出异常进入 catch
                if not response:
                    raise Exception("Empty Response")

                print(f"📡 页面响应状态: {response.status}")

                if response.status == 404:
                    data["status"] = 404
                    return data

                if await self._likely_bot_or_challenge_page(page):
                    print(
                        "🛑 疑似命中机器人拦截 / 挑战页（正文极短或 Cloudflare）。"
                        " 可尝试：调整 PROXY_URL、PLAYWRIGHT_CHROME_CHANNEL=chrome、PLAYWRIGHT_HEADED=1。"
                    )

                wait_sel = config.get("wait_for") or config.get("price_selector")
                wait_budget = 12000
                if wait_sel:
                    try:
                        await page.wait_for_selector(wait_sel, timeout=wait_budget)
                    except Exception:
                        pass

                if self.brand == "Saatva":
                    await asyncio.sleep(0.85)

                anchor = await self._extract_json_ld_anchor_commerce(page)
                if anchor:
                    if anchor.get("price") is not None:
                        data["price"] = float(anchor["price"])
                    av_ar = anchor.get("audit_variant")
                    if av_ar:
                        data["audit_variant"] = str(av_ar).strip()[:200]
                    if anchor.get("msrp") is not None:
                        mf = float(anchor["msrp"])
                        if mf > 0:
                            data["msrp"] = mf
                            data["old_price"] = mf
                    elif anchor.get("old_price") is not None:
                        mf = float(anchor["old_price"])
                        if mf > 0:
                            data["msrp"] = mf
                            data["old_price"] = mf
                    if anchor.get("availability") and not data.get("availability"):
                        data["availability"] = str(anchor["availability"]).strip()[:160]

                # Shopify meta.compare_at_price：即使 JSON-LD 已写入现价也要执行，否则 FluffCo 等仅有售价、无 schema 划线价。
                shop = await self._extract_shopify_variant_pricing(page)
                if shop:
                    sale_now = float(data.get("price") or 0)
                    if shop.get("price") is not None and sale_now == 0.0:
                        try:
                            ps = float(shop["price"])
                            if 5.0 <= ps <= 100000.0:
                                data["price"] = ps
                                sale_now = ps
                        except (TypeError, ValueError):
                            pass
                    avs = shop.get("audit_variant")
                    if avs and not data.get("audit_variant"):
                        data["audit_variant"] = str(avs).strip()[:200]
                    if shop.get("msrp") is not None and sale_now > 0:
                        try:
                            mf = float(shop["msrp"])
                            if mf > sale_now:
                                data["msrp"] = mf
                                data["old_price"] = mf
                        except (TypeError, ValueError):
                            pass

                # FluffCo：<product-price> 内 .compare / .final.price-field，优先覆盖缺失的划线价
                if self.brand == "FluffCo":
                    fc = await self._extract_fluffco_product_price_dom(page)
                    if fc:
                        sale_fc = fc.get("sale")
                        cmp_fc = fc.get("compare")
                        if sale_fc is not None:
                            try:
                                sf = float(sale_fc)
                                if 5.0 <= sf <= 100000.0:
                                    data["price"] = sf
                            except (TypeError, ValueError):
                                pass
                        if cmp_fc is not None:
                            try:
                                cf = float(cmp_fc)
                                sp = float(data.get("price") or 0)
                                if cf > sp > 0:
                                    data["msrp"] = cf
                                    data["old_price"] = cf
                            except (TypeError, ValueError):
                                pass

                if data["price"] == 0.0:
                    ld_price = await self._extract_json_ld_safe_fallback(page)
                    if ld_price is not None and 5.0 <= ld_price <= 100000.0:
                        data["price"] = ld_price

                _price_before_dom_pair = float(data["price"] or 0)
                paired_dom = await self._extract_dom_promo_paired_prices(
                    page, selector_chain
                )
                if paired_dom:
                    ps = paired_dom.get("sale")
                    pl = paired_dom.get("list")
                    if ps is not None:
                        psf = float(ps)
                        if pl is not None:
                            plf = float(pl)
                            if 5.0 <= psf <= 100000.0 and plf > psf:
                                looks_like_savings_line = (
                                    _price_before_dom_pair > 400
                                    and psf < _price_before_dom_pair * 0.52
                                    and psf < 650
                                )
                                if looks_like_savings_line:
                                    data["price"] = _price_before_dom_pair
                                    if plf > _price_before_dom_pair:
                                        data["msrp"] = plf
                                        data["old_price"] = plf
                                else:
                                    data["price"] = psf
                                    data["msrp"] = plf
                                    data["old_price"] = plf
                        elif data["price"] == 0.0 and 5.0 <= psf <= 100000.0:
                            data["price"] = psf

                if data["price"] == 0.0:
                    dom_ok = False
                    sel_timeout = 8000
                    for sel in selector_chain:
                        try:
                            await page.wait_for_selector(sel, timeout=sel_timeout)
                            price_text = await page.inner_text(sel)
                            all_prices = re.findall(
                                r"(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)", price_text
                            )
                            parsed = [float(p.replace(",", "")) for p in all_prices]
                            valid_prices = [
                                x for x in parsed if 9.0 <= x <= 100000.0
                            ]
                            if valid_prices:
                                data["price"] = valid_prices[0]
                                dom_ok = True
                                break
                        except Exception:
                            continue
                    if not dom_ok and selector_chain:
                        print("⚠️ 价格抓取失败，已尝试 JSON-LD / DOM。")

                if self.brand == "Sleep & Beyond":
                    try:
                        img_element = await page.query_selector(config["image_selector"])
                        if img_element:
                            large_img = await img_element.get_attribute(
                                "data-large_image"
                            )
                            src = (
                                large_img
                                if large_img
                                else await img_element.get_attribute("src")
                            )
                            data["original_image"] = src
                        if not data["original_image"]:
                            data["original_image"] = await page.evaluate(
                                "() => document.querySelector('meta[property=\"og:image\"]')?.content"
                            )
                    except Exception:
                        pass
                elif config.get("image_selector"):
                    try:
                        data["original_image"] = await page.evaluate(
                            "() => document.querySelector(\"meta[property='og:image']\")?.content"
                        )
                    except Exception:
                        pass

                data["raw_text"] = await page.evaluate(
                    "() => document.body.innerText.substring(0, 6000)"
                )

                promo = await self._extract_promotional_intel(page)
                if promo:
                    cc_raw = promo.get("coupon_code")
                    if cc_raw:
                        cn = normalize_coupon_token(str(cc_raw))
                        if cn and coupon_token_is_plausible(cn):
                            data["coupon_code"] = cn[:24]
                    if promo.get("promo_discount_percent") is not None:
                        data["promo_discount_percent"] = promo["promo_discount_percent"]
                    if promo.get("promo_text_snippet"):
                        data["promo_text_snippet"] = promo["promo_text_snippet"]
                self.augment_promo_from_plain_text(data.get("raw_text") or "", data)
                apply_brand_site_coupon_fallback(self.brand, data)

                extras = await self._extract_json_ld_extras(page)
                if extras:
                    av = extras.get("availability")
                    if av and not data.get("availability"):
                        data["availability"] = str(av).strip()[:160]
                    # 不再用全局 AggregateOffer.highPrice 填 MSRP：易与「跨规格最低价」现价错配；
                    # 划线价仅来自锚定 JSON-LD、Shopify 同 variant 的 compare_at，或将来显式 DOM 配对逻辑。

            except Exception as e:
                print(f"⚠️ 官网扫描受限: {e}")
                data['error_log'] = str(e)
            finally:
                await browser.close()
        return data 

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=5, max=15))
    async def call_ai_audit(self, prompt, context):
        try:
            response = self.ai_client.models.generate_content(
                model=GEMINI_MODEL_ID,
                contents=[prompt, context],
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            return json.loads(response.text)
        except Exception as e:
            # 打印完整的错误细节，看看是不是 API Key 过期、欠费或被封禁
            print(f"DEBUG - Gemini API 报错详情: {str(e)}")
            raise e

    async def call_deepseek_audit(self, prompt, context):
        """Gemini 不可用时的降级：DeepSeek Chat（OpenAI 兼容接口）。"""
        api_key = os.getenv("DEEPSEEK_API_KEY")
        if not api_key:
            raise ValueError("未配置 DEEPSEEK_API_KEY，无法启用降级审计")

        combined = (
            f"{prompt.strip()}\n\n--- EVIDENCE ---\n{context}\n\n"
            "Respond with a single valid JSON object only, no markdown fences."
        )
        timeout = httpx.Timeout(connect=20.0, read=120.0, write=30.0, pool=20.0)
        async with httpx.AsyncClient(timeout=timeout, trust_env=True) as client:
            resp = await client.post(
                DEEPSEEK_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": DEEPSEEK_MODEL_ID,
                    "messages": [{"role": "user", "content": combined}],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.2,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        if not content:
            raise RuntimeError("DeepSeek 返回空内容")
        return self._parse_llm_json_text(content)

    async def execute_and_sync(self, url):
        # 1. 采集数据
        site_data = await self.fetch_site_data(url)

        # --- 新增判断逻辑 ---
        # 如果价格没拿到且文本内容太短，判定为抓取失败，不触发 Gemini
        if site_data['price'] == 0.0 and len(site_data['raw_text']) < 300:
            print(f"❌ 采集完整性校验失败: {self.model}。原因：可能是被反爬拦截或 404。")
            return  # 优雅退出，不抛出异常，不触发 retry

        # 如果抓取到了 404 关键词（针对某些网站不跳转 404 页面但显示错误内容的情况）
        if "404 Not Found" in site_data['raw_text'] or "Page not found" in site_data['raw_text']:
            print(f"🚫 目标已下架: {self.model} (检测到 404 文本)")
            return
        
        # --- 图片转储：audit_products.image_url 仅存 Storage 公链；失败时保留库内旧图 ---
        hosted_image_url = None
        if site_data.get('original_image'):
            print(f"📸 正在转储图片至 Supabase Storage: {self.slug}")
            hosted_image_url = await self.transfer_to_supabase_storage(site_data['original_image'])
        if not hosted_image_url:
            try:
                prev = (
                    self.supabase.table("audit_products")
                    .select("image_url")
                    .eq("slug", self.slug)
                    .limit(1)
                    .execute()
                )
                if prev.data and prev.data[0].get("image_url"):
                    hosted_image_url = prev.data[0]["image_url"]
            except Exception:
                pass
        
        # 清洗 raw_text 的工具函数
        def clean_web_text(text):
            # 1. 移除 script 和 style 块 (如果 raw_text 包含标签的话)
            text = re.sub(r'<script.*?</script>', '', text, flags=re.DOTALL)
            text = re.sub(r'<style.*?</style>', '', text, flags=re.DOTALL)
            # 2. 移除所有 HTML 标签
            text = re.sub(r'<[^>]+>', '', text)
            # 3. 将多个换行和空格合并为一个空格
            text = re.sub(r'\s+', ' ', text).strip()
            # 4. 严格限制长度 (2000-3000字符足够审计使用了)
            return text[:2500]
    
        # --- 新增：上下文瘦身逻辑 ---
        # 移除重复空格、换行符，并严格截断
        clean_text = clean_web_text(site_data['raw_text'])

        existing_id = None
        try:
            prev = (
                self.supabase.table("audit_products")
                .select("id")
                .eq("slug", self.slug)
                .limit(1)
                .execute()
            )
            if prev.data:
                existing_id = prev.data[0]["id"]
        except Exception:
            pass

        social_proof, serp_review_count = await self.intel.fetch_social_proof(
            f"{self.brand} {self.model}",
            product_id=existing_id,
            supabase_client=self.supabase if existing_id else None,
        )

        # 2. 注入审计上下文 (大幅减少 Token 占用)
        audit_context = f"--- OFFICIAL SPECS ---\n{clean_text}\n\n--- SOCIAL EVIDENCE ---\n{social_proof[:800]}"

        # 3. 精炼版 10分制 Prompt
        audit_prompt = f"""
        ACT AS A SENIOR BIOMECHANICAL AUDITOR. 
        AUDIT TARGET: {self.brand} {self.model}
        
        TASK:
        1. 10-point scale audit (audit_scores).
        2. Create a standardized matrix (technical_specs).
        3. Write a sharp clinical forensic note (audit_note).
        4. Generate a 'specs_matrix' containing 4-6 forensic indices (e.g., Spinal_Alignment_Index, Motion_Isolation_Rating, Thermal_Conductivity).

        SPECIFICATIONS:
        - audit_note: MAX 60 words. Strict clinical tone. 
        - seo_title: Create a high-CTR title (max 60 chars) including "Forensic Audit" and "Review".
        - seo_description: Max 155 chars. Focus on material integrity and audit results.
        - seo_keywords: 5-8 highly relevant comma-separated keywords (e.g., brand, model, mattress-type, spinal-alignment).
        - technical_specs: USE THESE KEYS: "Construction", "Firmness", "Support_Core", "Comfort_Layer", "Trial", "Warranty".
        - specs_matrix: DO NOT leave empty. Provide detailed mechanical evaluation for each key.

        RETURN JSON:
        {{
          "audit_scores": {{"overall": 0.0, "support": 0.0, "cooling": 0.0, "pressure": 0.0, "durability": 0.0}},
          "technical_specs": {{
              "Construction": "", "Firmness": "", "Support_Core": "", "Comfort_Layer": "", "Trial": "", "Warranty": ""
          }},
          "specs_matrix": {{
              "Spinal_Alignment": "",
              "Edge_Support_Integrity": "",
              "Motion_Transfer_Damping": "",
              "Pressure_Relief_Index": ""
          }},
          "pros": [], 
          "cons": [],
          "audit_note": "",
          "summary_log": "Generate chronological audit steps [T-00:00:00]...",
          "seo_title": "",
          "seo_description": "",
          "seo_keywords": "",
          "detected_coupon": "",
          "promo_text": ""
        }}
        """

        audit_llm_label = GEMINI_AUDIT_LABEL
        try:
            print(f"🧠 启动 {GEMINI_AUDIT_LABEL}（{GEMINI_MODEL_ID}）深度审计...")
            report = await self.call_ai_audit(audit_prompt, audit_context)
        except Exception as gem_err:
            print(f"⚠️ Gemini 审计失败，尝试 DeepSeek 降级: {gem_err}")
            try:
                print(
                    f"🧠 启动 {DEEPSEEK_AUDIT_LABEL}（{DEEPSEEK_MODEL_ID}）深度审计..."
                )
                report = await self.call_deepseek_audit(
                    audit_prompt, audit_context
                )
                audit_llm_label = DEEPSEEK_AUDIT_LABEL
            except Exception as ds_err:
                print(f"❌ DeepSeek 降级失败: {ds_err}")
                raise RuntimeError(
                    f"LLM 审计均失败 — Gemini: {gem_err!s} | DeepSeek: {ds_err!s}"
                ) from ds_err

        try:
            # 逻辑层：生成专业日志与数据校正
            scores = report.get('audit_scores', {})
            for k in scores: # 标准化分数
                if 0 < scores[k] <= 1.0: scores[k] = round(scores[k] * 10, 1)

            # 2. 数据清洗 (必须在构建 payload 之前)
            clean_desc = report.get('seo_description', '').strip().replace('"', '')
            clean_title = report.get('seo_title', '').strip().replace('"', '')
            clean_keywords = report.get('seo_keywords', '').strip().lower()

            # 我们将 specs_matrix 放入 audit_data 字段中
            msrp_val = site_data.get("msrp")
            msrp_num = float(msrp_val) if msrp_val else 0.0

            audit_data_payload = {
                "audit_hash": self.generate_hash(),
                "evidence_size": len(audit_context),
                "model": audit_llm_label,
                "api_model_id": (
                    GEMINI_MODEL_ID
                    if audit_llm_label == GEMINI_AUDIT_LABEL
                    else DEEPSEEK_MODEL_ID
                ),
                "timestamp": datetime.now(UTC).isoformat(),
                "specs_matrix": report.get('specs_matrix', {}), # 这里对应前端的 Forensic Analysis
                "protocol": "v3.0-forensic",
                "msrp": msrp_num,
            }
            av_label = site_data.get("audit_variant")
            if isinstance(av_label, str) and av_label.strip():
                audit_data_payload["audit_variant"] = av_label.strip()[:200]

            # 5. 构建主 Payload
            payload = {
                "slug": self.slug,
                "brand": self.brand,
                "brand_slug": self.brand_slug,
                "model": self.model,
                "official_link": url,
                "price": site_data['price'],
                "audit_scores": scores,
                "technical_specs": report.get('technical_specs'),
                "pros": report.get('pros', []),
                "cons": report.get('cons', []),
                "audit_note": report.get('audit_note'),
                "summary_log": report.get('summary_log'),

                # SEO 字段映射
                "seo_title": clean_title,
                "seo_description": clean_desc,
                "seo_keywords": clean_keywords, 

                "audit_data": audit_data_payload,
                "original_image_url": site_data['original_image'],
                "image_url": hosted_image_url,
                "confidence_score": 0.85 if site_data['price'] > 0 else 0.6,
                "is_verified": site_data['price'] > 0,
                "protocol_version": "v3.0-forensic",
                "last_audited_at": datetime.now(UTC).isoformat(),
                "updated_at": datetime.now(UTC).isoformat(),
                "evidence_log": social_proof,
                "review_count": serp_review_count,
            }

            if msrp_val:
                payload["msrp"] = msrp_num

            # 6. 数据库双表同步
            res = self.supabase.table("audit_products").upsert(payload, on_conflict="slug").execute()
            
            if res.data:
                product_uuid = res.data[0]['id']
                offer_row = {
                    "product_id": product_uuid,
                    "site_name": self.brand,
                    "price": site_data['price'],
                    "offer_url": url,
                    "coupon_code": report.get('detected_coupon'),
                    "promo_text": report.get('promo_text') or "Best Offer Detected",
                    "is_primary": True,
                    "status": "active",
                    "last_checked_at": datetime.now(UTC).isoformat(),
                }
                op_old = site_data.get("old_price")
                if op_old:
                    try:
                        offer_row["old_price"] = float(op_old)
                    except (TypeError, ValueError):
                        pass
                av_raw = site_data.get("availability")
                if av_raw:
                    offer_row["availability"] = str(av_raw).strip()[:160]

                self.supabase.table("product_offers").upsert(
                    offer_row, on_conflict="product_id, site_name"
                ).execute()

                print(
                    f"✅ 审计存证已锁定: {self.slug} | LLM: {audit_llm_label} | "
                    f"价格: {site_data['price']} | 指纹: {payload['audit_data']['audit_hash']}"
                )

        except Exception as e:
            print(f"❌ 级联同步失败: {e}")

# if __name__ == "__main__":
#     engine = ForensicAuditEngine("Saatva", "Rx")
#     asyncio.run(engine.execute_and_sync("https://www.saatva.com/mattresses/saatva-rx"))