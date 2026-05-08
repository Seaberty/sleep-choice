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

    async def _extract_json_ld_price(self, page):
        """从 schema.org / WooCommerce 的 JSON-LD 解析标价（优先于 DOM 文本）。"""
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
            if (isAgg && o.lowPrice != null) {
              const p = parseFloat(String(o.lowPrice).replace(/,/g, ''));
              if (!isNaN(p) && p > 0) return p;
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
        
    async def fetch_site_data(self, url):
        """默认 Playwright 扫描（无品牌专用反爬强化）。"""
        print(f"🌐 深度扫描官网: {url}")
        data = {"price": 0.0, "original_image": None, "raw_text": "", "status": 200}

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
                "price_selector": ".product-single__price",
                "image_selector": ".product-single__photo--featured img",
                "wait_for": "h1",
            },
        }

        config = BRAND_MAP.get(self.brand, {})
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

                ld_price = await self._extract_json_ld_price(page)
                if ld_price is not None and 5.0 <= ld_price <= 100000.0:
                    data["price"] = ld_price

                if data["price"] == 0.0:
                    selectors = []
                    if config.get("price_selector"):
                        selectors.append(config["price_selector"])
                    for fb in config.get("price_selectors_fallback") or []:
                        if fb and fb not in selectors:
                            selectors.append(fb)

                    dom_ok = False
                    sel_timeout = 8000
                    for sel in selectors:
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
                    if not dom_ok and selectors:
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
                "protocol": "v3.0-forensic"
            }

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

            # 6. 数据库双表同步
            res = self.supabase.table("audit_products").upsert(payload, on_conflict="slug").execute()
            
            if res.data:
                product_uuid = res.data[0]['id']
                self.supabase.table("product_offers").upsert({
                    "product_id": product_uuid,
                    "site_name": self.brand,
                    "price": site_data['price'],
                    "offer_url": url,
                    "coupon_code": report.get('detected_coupon'),
                    "promo_text": report.get('promo_text') or "Best Offer Detected",
                    "is_primary": True,
                    "status": "active",
                    "last_checked_at": datetime.now(UTC).isoformat()
                }, on_conflict="product_id, site_name").execute()

                print(
                    f"✅ 审计存证已锁定: {self.slug} | LLM: {audit_llm_label} | "
                    f"价格: {site_data['price']} | 指纹: {payload['audit_data']['audit_hash']}"
                )

        except Exception as e:
            print(f"❌ 级联同步失败: {e}")

# if __name__ == "__main__":
#     engine = ForensicAuditEngine("Saatva", "Rx")
#     asyncio.run(engine.execute_and_sync("https://www.saatva.com/mattresses/saatva-rx"))