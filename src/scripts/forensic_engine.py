# -*- coding: utf-8 -*-
import os
import json
import asyncio
import hashlib
import httpx
import re
from pathlib import Path
from urllib.parse import quote, urlparse
from datetime import datetime, UTC
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential
from typing import Any

# 核心库
from supabase import create_client, Client
from playwright.async_api import async_playwright

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = _PROJECT_ROOT / ".env.local"
if not _ENV_FILE.is_file():
    _ENV_FILE = Path(__file__).resolve().parents[1] / ".env.local"
load_dotenv(dotenv_path=_ENV_FILE)


def sniff_image_format(data: bytes) -> tuple[str | None, str]:
    """
    用文件头识别图片类型。CloudFront 等常对图片返回 application/octet-stream。
    返回 (mime_type, ext)；无法识别则 (None, jpg)。
    """
    if not data or len(data) < 12:
        return None, "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png", "png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg", "jpg"
    if len(data) >= 6 and data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif", "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None, "jpg"


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


def coupon_looks_like_referral_or_name_spam(token: str) -> bool:
    """
    误识别典型：极长大写前缀 + 末尾两位数字（仿人名 referral / UGC 噪声），
    如 REBEKAHWIGGINS71；与常见短促促销码（MOM15、SAVE20）区分。
    """
    u = token.upper().strip()
    if len(u) < 13:
        return False
    if re.match(r"^[A-Z]{12,}\d{2}$", u):
        return True
    if len(u) >= 20 and re.match(r"^[A-Z]{14,}\d{2,4}$", u):
        return True
    return False


def coupon_token_is_plausible(token: str | None) -> bool:
    if not token:
        return False
    u = token.upper().strip()
    if len(u) < 4:
        return False
    if u in COUPON_DENYLIST:
        return False
    if coupon_looks_like_referral_or_name_spam(u):
        return False
    # 短纯字母 token 多半是版面词（真实码多为字母+数字如 MOM15）
    if u.isalpha() and len(u) <= 6:
        return False
    return True


def sanitize_coupon_for_persistence(data: dict) -> None:
    """仅保留页面爬到的可信码；无效则清空，不把站点默认码写入持久化字段。"""
    raw = data.get("coupon_code")
    n = normalize_coupon_token(raw) if raw else None
    if coupon_token_is_plausible(n):
        data["coupon_code"] = n[:24]
    else:
        data["coupon_code"] = None


# Shopify 系店铺：GET /discount/{code} 后从落地页判断（含 headless 部分误报时以「明确无效」为准）
_SHOPIFY_DISCOUNT_INVALID_SNIPPETS = (
    "isn't valid",
    "is not valid",
    "invalid discount",
    "this discount code",
    "couldn't find this discount",
    "could not find this discount",
    "can't find this discount",
    "enter a valid discount",
    "does not exist",
    "no longer valid",
    "discount code expired",
)

_SHOPIFY_DISCOUNT_OK_PATH_HINTS = ("/cart", "/checkouts", "checkout", "discount=")


async def finalize_coupon_for_store(page_url: str, token: str | None) -> str | None:
    """
    入库前最后一道：在线探测 discount 链；明确判无效则返回 None。
    网络/模糊情况返回原 token（避免误杀真实码）。可用环境变量 COUPON_VALIDATE_HTTP=0 关闭请求。
    """
    if not token:
        return None
    if not coupon_token_is_plausible(token):
        return None
    if os.getenv("COUPON_VALIDATE_HTTP", "1").strip().lower() in (
        "0",
        "false",
        "no",
        "off",
    ):
        return token
    try:
        pr = urlparse(page_url)
    except Exception:
        return token
    if pr.scheme not in ("http", "https") or not pr.netloc:
        return token
    origin = f"{pr.scheme}://{pr.netloc}"
    path = quote(token, safe="")
    url = f"{origin.rstrip('/')}/discount/{path}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; SleepChoiceIntel/1.0; "
            "+https://sleepchoiceguide.com)"
        ),
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    }
    try:
        async with httpx.AsyncClient(
            timeout=12.0,
            follow_redirects=True,
            trust_env=True,
        ) as client:
            r = await client.get(url, headers=headers)
    except Exception:
        return token
    text = (r.text or "").lower()
    final_u = str(r.url or "").lower()
    for snip in _SHOPIFY_DISCOUNT_INVALID_SNIPPETS:
        if snip in text:
            return None
    if r.status_code == 404:
        return None
    for hint in _SHOPIFY_DISCOUNT_OK_PATH_HINTS:
        if hint in final_u:
            return token
    if r.status_code >= 400:
        return None
    return token


# --- LLM 审计 / 情报（DeepSeek Chat）---
DEEPSEEK_MODEL_ID = "deepseek-chat"
DEEPSEEK_AUDIT_LABEL = "DeepSeek-Chat"
DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions"

# 与 src/types/product.ts 中 AuditScores 对齐（仅允许这五个维度写入 audit_scores）
_AUDIT_SCORE_KEYS: tuple[str, ...] = (
    "overall",
    "support",
    "cooling",
    "pressure",
    "durability",
)

_DEEPSEEK_FORENSIC_AUDIT_SYSTEM = """You are a strict JSON generator for a mattress forensic audit pipeline.
Your entire reply MUST be one JSON object only: no markdown code fences, no prose before or after, no comments.

Schema (keys and nesting are mandatory):

1) audit_scores — object with EXACTLY these five keys, all JSON numbers, no extras:
   "overall", "support", "cooling", "pressure", "durability"
   Each value is the 10-point forensic scale from 0.0 through 10.0 (one decimal recommended).
   Do NOT encode the 10-point scale as a 0–1 fraction; use 0–10 directly.

2) technical_specs — object with EXACTLY these seven keys, all string values:
   "Construction", "Firmness", "Support_Core", "Comfort_Layer", "Trial", "Warranty", "Certifications"
   Certifications: comma-separated claims traceable to the provided listing or brand copy; if none, use exactly:
   Not stated in captured listing

3) specs_matrix — object whose values are all strings, non-empty forensic prose.
   REQUIRED keys: "Spinal_Alignment", "Edge_Support_Integrity", "Motion_Transfer_Damping", "Pressure_Relief_Index"
   You may add more string keys with forensic indices if useful.

4) pros — JSON array of short non-empty strings (strings only, not objects).
5) cons — same as pros.

6) audit_note — single string, clinical forensic tone, at most ~60 words.
7) summary_log — single string, chronological steps using tokens like [T-00:00:00].

8) seo_title — string, at most 60 characters, must include the words Forensic Audit and Review.
9) seo_description — string, at most 155 characters.
10) seo_keywords — string, 5–8 comma-separated lowercase keywords.
11) detected_coupon — string (empty string if none).
12) promo_text — string (empty string if none).

Hard rules: valid JSON only; double-quoted keys; no trailing commas; no NaN or Infinity; do not rename or omit audit_scores keys."""

_DEEPSEEK_BRAND_INTEL_SYSTEM = """You are a strict JSON API for mattress brand intelligence (consumer research).
Your entire reply MUST be one JSON object only: no markdown fences, no commentary.

Top-level: exactly one key "items" whose value is a JSON array.

For EACH object in input.platforms (same order, same length), output one object in "items" with EXACTLY these keys:
- "source_platform" (string): MUST exactly match that platform's input source_platform (same spelling and case).
- "sentiment_score" (number): between 0.0 and 1.0 inclusive. If evidence is thin or contradictory, use about 0.45–0.55.
- "key_issue_tags" (array of strings): length 2 to 8. Each tag: only ASCII letters, digits, and underscores; length 2–40; use forms like Edge_Support, Off_gassing, Thin_Signal. No commas, quotes, slashes, or spaces inside a tag. No empty strings.
- "verdict_summary" (string): one neutral forensic paragraph, at most 85 words, themes only, no URLs, no invented facts.

Do not add other top-level keys. Do not omit any input platform."""

_CTRL_OR_INVISIBLE = re.compile(r"[\x00-\x1f\x7f\u200b-\u200f\ufeff]")


def _normalize_audit_scores_from_llm(raw: Any) -> dict[str, float]:
    """对齐 AuditScores：五键、0–10；兼容历史 0–1 分输出。"""
    src = raw if isinstance(raw, dict) else {}
    out: dict[str, float] = {}
    for k in _AUDIT_SCORE_KEYS:
        v = src.get(k)
        try:
            x = float(v) if v is not None else 0.0
        except (TypeError, ValueError):
            x = 0.0
        if 0 < x <= 1.0:
            x = round(x * 10, 1)
        x = max(0.0, min(10.0, round(x, 1)))
        out[k] = x
    return out


def _normalize_str_list_for_audit(raw: Any, *, cap: int = 24) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        s = raw.strip()
        return [s] if s else []
    if isinstance(raw, list):
        return [str(x).strip() for x in raw if str(x).strip()][:cap]
    return []


def _sanitize_key_issue_tags(raw: Any, *, min_tags: int = 2, max_tags: int = 8) -> list[str]:
    """稳定写入 brand_intelligence.key_issue_tags（text[] / json）：去控制字符、统一 token 形状。"""
    if isinstance(raw, dict):
        raw = list(raw.values())
    elif not isinstance(raw, list):
        raw = [raw] if raw is not None else []
    out: list[str] = []
    for x in raw:
        s = _CTRL_OR_INVISIBLE.sub("", str(x)).strip()
        s = re.sub(r"\s+", "_", s)
        s = re.sub(r"_+", "_", s).strip("_")
        s = re.sub(r"[^A-Za-z0-9_]+", "", s)[:40]
        if len(s) >= 2 and s not in out:
            out.append(s)
        if len(out) >= max_tags:
            break
    for pad in ("Thin_Signal", "General_Themes"):
        if len(out) >= min_tags:
            break
        if pad not in out:
            out.append(pad)
    return out[:max_tags]


# --- 强制提前注入 ---
# 这样可以确保所有后续初始化的库（httpx, playwright）都读取到同一个配置
if os.getenv("PROXY_URL"):
    os.environ["HTTP_PROXY"] = os.getenv("PROXY_URL")
    os.environ["HTTPS_PROXY"] = os.getenv("PROXY_URL")


def resolve_playwright_proxy_server() -> str | None:
    """
    Playwright Chromium 的 proxy.server 需要完整 URL。
    优先级：PROXY_URL → HTTPS_PROXY → HTTP_PROXY（便于与系统/终端代理对齐）。
    """
    raw = (
        (os.getenv("PROXY_URL") or "").strip()
        or (os.getenv("HTTPS_PROXY") or "").strip()
        or (os.getenv("HTTP_PROXY") or "").strip()
    )
    if not raw:
        return None
    low = raw.lower()
    if not low.startswith(("http://", "https://", "socks5://", "socks4://")):
        raw = "http://" + raw.lstrip("/")
    return raw


def format_proxy_for_log(server: str) -> str:
    """日志脱敏：user:pass@host → ***@host"""
    try:
        pr = urlparse(server)
        if pr.username or pr.password:
            host = pr.hostname or ""
            port = f":{pr.port}" if pr.port else ""
            return f"{pr.scheme}://***@{host}{port}"
        return server
    except Exception:
        return server[:48]


# 与 sb_batch_scanner 独立脚本时期（forensic_engine ~235081a）一致的默认 UA，避免站点按指纹区别对待。
_DEFAULT_FETCH_SITE_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)


def playwright_fetch_site_new_context_kwargs() -> dict[str, Any]:
    """
    fetch_site_data 的 BrowserContext 参数。
    - 默认 UA 对齐旧版单独 SB 脚本时代；可用 PLAYWRIGHT_USER_AGENT 覆盖。
    - 额外 Accept 头等仅在 PLAYWRIGHT_FETCH_EXTRA_HEADERS=1 时启用（旧版未加）。
    """
    ua = (os.getenv("PLAYWRIGHT_USER_AGENT") or "").strip() or _DEFAULT_FETCH_SITE_USER_AGENT
    out: dict[str, Any] = {"user_agent": ua}
    if os.getenv("PLAYWRIGHT_FETCH_EXTRA_HEADERS", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    ):
        out["locale"] = "en-US"
        out["extra_http_headers"] = {
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;q=0.9,"
                "image/avif,image/webp,image/apng,*/*;q=0.8"
            ),
            "Upgrade-Insecure-Requests": "1",
        }
    return out


def _brand_social_corpus_audit_max_rows() -> int:
    raw = (os.getenv("BRAND_SOCIAL_CORPUS_AUDIT_MAX") or "").strip()
    try:
        n = int(raw)
        return max(20, min(n, 800))
    except (TypeError, ValueError):
        return 400


def load_social_evidence_from_brand_corpus(
    supabase: Client,
    brand_slug: str,
    product_slug: str | None,
) -> tuple[str, int, list[dict[str, Any]]]:
    """
    从 brand_social_corpus 组装 merged 文本与 platform_blocks，
    供审计上下文与 _persist_brand_intelligence 使用。
    """
    bs = (brand_slug or "").strip()
    if not bs:
        return "", 0, []
    lim = _brand_social_corpus_audit_max_rows()
    try:
        q = (
            supabase.table("brand_social_corpus")
            .select("source_platform,title,snippet,source_url")
            .eq("brand_slug", bs)
        )
        ps = (product_slug or "").strip()
        if ps:
            q = q.or_(f"product_slug.is.null,product_slug.eq.{ps}")
        res = q.order("collected_at", desc=True).limit(lim).execute()
    except Exception as e:
        print(f"⚠️ brand_social_corpus 读取失败（舆情块留空）: {e}")
        return "", 0, []

    rows = res.data or []
    if not rows:
        return "", 0, []

    buckets: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        plat = (r.get("source_platform") or "Other").strip() or "Other"
        buckets.setdefault(plat, []).append(r)

    order = ("Reddit", "Amazon", "Trustpilot", "SleepLine", "Other")

    def _plat_sort_key(p: str) -> int:
        try:
            return order.index(p)
        except ValueError:
            return 99

    all_evidence: list[str] = []
    platform_blocks: list[dict[str, Any]] = []
    total_review_count = 0

    for platform_name in sorted(buckets.keys(), key=_plat_sort_key):
        items = buckets[platform_name]
        n = len(items)
        total_review_count += n
        chunk_lines: list[str] = []
        for item in items[:45]:
            title = item.get("title") or ""
            snip = item.get("snippet") or ""
            link = item.get("source_url") or ""
            chunk_lines.append(
                f"🔍 SOURCE: {title}\nCONTEXT: {snip}\n🔗 {link}"
            )
        merged_chunk = "\n\n".join(chunk_lines)
        platform_blocks.append(
            {
                "source_platform": platform_name,
                "evidence_text": merged_chunk,
                "signal_density": n,
            }
        )
        if merged_chunk.strip():
            all_evidence.append(f"--- PLATFORM: {platform_name} ---\n{merged_chunk}")

    evidence_text = "\n\n".join(all_evidence)
    return evidence_text, total_review_count, platform_blocks


class SocialEvidenceProvider:
    """舆情：仅读取 public.brand_social_corpus。"""

    async def fetch_social_proof(
        self,
        query,
        product_id=None,
        supabase_client=None,
        *,
        brand_slug: str | None = None,
        product_slug: str | None = None,
    ):
        """
        Returns:
            merged_evidence: str
            total_review_count: int
            platform_blocks: list[{"source_platform","evidence_text","signal_density"}]
        """

        def _update_evidence_log(evidence_text: str, review_count: int) -> None:
            if not (product_id and supabase_client and evidence_text):
                return
            try:
                supabase_client.table("audit_products").update(
                    {
                        "evidence_log": evidence_text,
                        "review_count": review_count,
                        "updated_at": datetime.now(UTC).isoformat(),
                    }
                ).eq("id", product_id).execute()
            except Exception as ex:
                print(f"⚠️ evidence_log 回写失败: {ex}")

        if supabase_client and brand_slug:
            evidence_text, total_review_count, platform_blocks = (
                load_social_evidence_from_brand_corpus(
                    supabase_client, brand_slug, product_slug
                )
            )
            if evidence_text.strip():
                print(
                    f"ℹ️ 审计舆情来源: brand_social_corpus（{total_review_count} 条）"
                )
                _update_evidence_log(evidence_text, total_review_count)
                return evidence_text, total_review_count, platform_blocks

        print(
            "ℹ️ 无舆情块：请配置 supabase + brand_slug，并在 public.brand_social_corpus 写入数据 "
            "（python brand_social_corpus_ingest.py --from-registry）。"
        )
        return "", 0, []


async def _safe_close_playwright_browser(context: Any, browser: Any) -> None:
    """
    关闭 Playwright context / browser。代理不稳或进程已崩溃时，raw close 会抛
    ``Browser.close: Connection closed while reading from the driver``，且在 finally
    中会覆盖 try 内已成功 return 的 data —— 故此处吞掉关闭类异常并仅打日志。
    """
    try:
        await context.close()
    except Exception:
        pass
    try:
        await browser.close()
    except Exception as e:
        low = str(e).lower()
        if (
            "connection closed" in low
            or "browser has been closed" in low
            or "reading from the driver" in low
            or "target closed" in low
        ):
            print(
                "⚠️ Playwright 关闭时与浏览器驱动连接已断开（多见于 HTTP 代理中途断连、"
                "节点重置或页面进程崩溃）。若上文已成功解析价格/JSON-LD，通常可忽略。"
            )
        else:
            print(f"⚠️ Playwright 关闭浏览器: {e}")


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
        self.intel = SocialEvidenceProvider()

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
                    "403",
                    "forbidden",
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
            if "access to this page is forbidden" in low:
                return True
            if "403" in title and "forbidden" in low:
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

        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                resp = await client.get(original_url, timeout=20.0)
                if resp.status_code != 200:
                    print(f"❌ 图片下载失败 HTTP {resp.status_code}")
                    return None
                body = resp.content
                ct = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
                upload_ct: str | None = None
                ext = raw_ext

                if ct.startswith("image/"):
                    upload_ct = ct
                elif ct in (
                    "application/octet-stream",
                    "binary/octet-stream",
                    "application/unknown",
                ) or not ct:
                    smime, sext = sniff_image_format(body)
                    if smime:
                        upload_ct = smime
                        if sext in ("jpg", "jpeg", "png", "webp", "gif"):
                            ext = sext
                    else:
                        hint = ct or "(empty)"
                        print(
                            f"❌ 非图片响应 Content-Type: {hint}（且无法通过文件头识别）"
                        )
                        return None
                else:
                    print(f"❌ 非图片响应 Content-Type: {ct}")
                    return None

                if ext == "jpeg":
                    ext = "jpg"
                storage_path = f"{self.brand_slug}/{self.slug}.{ext}"
                up_ct = upload_ct or "image/jpeg"

                loop = asyncio.get_running_loop()

                def upload():
                    return self.supabase.storage.from_(bucket).upload(
                        path=storage_path,
                        file=body,
                        file_options={
                            "content-type": up_ct,
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
          /* 勿用裸 travel：会误伤「MyTravel」等品牌名；仅匹配独立词 travel 或 travel-size 等 */
          const BAD =
            /\btravel\b|travel\s*[-–]?\s*size|sample|swatch|trial\s*size|mini(?!\s*k)/i;

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

          function pickHighestSale(arr) {
            if (!arr || !arr.length) return null;
            return arr.reduce(function(best, c) {
              if (!best) return c;
              if (c.sale > best.sale) return c;
              if (c.sale < best.sale) return best;
              var bm = best.msrp != null ? best.msrp : 0;
              var cm = c.msrp != null ? c.msrp : 0;
              if (cm > bm) return c;
              return best;
            }, null);
          }
          function selectBest() {
            if (!candidates.length) return null;
            if (variantIdPin) {
              const pinnedList = candidates.filter(function(c) {
                return c.meta && c.meta.pinned;
              });
              if (pinnedList.length >= 1) return pickHighestSale(pinnedList);
              const byIdMatches = candidates.filter(function(c) {
                return String(c.label).indexOf(variantIdPin) !== -1;
              });
              if (byIdMatches.length >= 1) return pickHighestSale(byIdMatches);
            }
            const lower = function(s) {
              return s.toLowerCase();
            };
            for (let pi = 0; pi < PREFERRED.length; pi++) {
              const pref = PREFERRED[pi];
              const matches = candidates.filter(function(c) {
                return lower(c.label).indexOf(lower(pref)) !== -1;
              });
              if (matches.length >= 1) return pickHighestSale(matches);
            }
            const nonBad = candidates.filter(function(c) {
              return !BAD.test(c.label);
            });
            if (nonBad.length) return pickHighestSale(nonBad);
            return pickHighestSale(candidates);
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
                var va = v.available;
                var vAvail = null;
                if (va === true || va === 'true') vAvail = true;
                else if (va === false || va === 'false') vAvail = false;
                else if (typeof va !== 'undefined' && va !== null) vAvail = Boolean(va);
                return {
                  price: pr,
                  compare_at_price: cmp,
                  title: String(title),
                  variant_available: vAvail
                };
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
            vb = raw.get("variant_available")
            # 仅在为 true 时标现货：meta 里 available:false 在 Hydrogen/自定义店常与 PDP 可购不一致，
            # 不再据此直接写 OUT_OF_STOCK，交给主按钮 / DOM 裁定。
            if vb is True:
                out["availability"] = "IN_STOCK"
            return out if out else None
        except Exception:
            return None

    async def _reconcile_availability_with_buy_button(self, page):
        """
        以主「加入购物车」交互为准，修正 meta / JSON-LD 误判的 OUT_OF_STOCK。
        仅在能识别到明确 purchasable / OOS 按钮时返回；模糊则返回 None。
        """
        script = r"""() => {
          try {
            function visible(el) {
              if (!el) return false;
              if (el.offsetParent === null && el.getClientRects().length === 0)
                return false;
              return true;
            }
            function findPrimaryAtc() {
              var scoped = [
                '.pdp-info',
                '[class*="pdp-info"]',
                'form[action*="/cart/add"]',
                '[data-type="add-to-cart-form"]',
                '.product-form',
                '[data-product-form]',
                'main#main-content',
                'main'
              ];
              var selLists = [
                'button[type="submit"]',
                'button[name="add"]',
                '[data-add-to-cart]',
                'button.product-form__submit',
                '.product-form__buttons button',
                'button'
              ];
              for (var si = 0; si < scoped.length; si++) {
                var root = document.querySelector(scoped[si]);
                if (!root) continue;
                for (var sj = 0; sj < selLists.length; sj++) {
                  var nodes = root.querySelectorAll(selLists[sj]);
                  for (var k = 0; k < nodes.length; k++) {
                    var b = nodes[k];
                    if (!visible(b)) continue;
                    var tx = (b.innerText || b.textContent || '').trim();
                    if (tx.length < 3) continue;
                    var tl = tx.toLowerCase();
                    if (
                      tl.indexOf('cart') !== -1 ||
                      tl.indexOf('buy') !== -1 ||
                      tl.indexOf('purchase') !== -1 ||
                      tl.indexOf('checkout') !== -1
                    )
                      return b;
                  }
                }
              }
              return null;
            }
            var btn = findPrimaryAtc();
            if (!btn) return null;
            var txt = ((btn.innerText || btn.textContent || '') + ' ' +
              (btn.getAttribute('aria-label') || '')).toLowerCase();
            var dis =
              btn.disabled === true ||
              btn.getAttribute('aria-disabled') === 'true' ||
              btn.hasAttribute('disabled');
            if (
              /sold\s*out|out\s+of\s+stock|unavailable|notify\s+when|coming\s+soon/i.test(
                txt
              )
            )
              return 'OUT_OF_STOCK';
            if (dis && /sold|unavailable|notify/i.test(txt))
              return 'OUT_OF_STOCK';
            if (
              !dis &&
              (/add\s+to\s+cart|add\s+to\s+bag|buy\s+now/i.test(txt) ||
                (txt.indexOf('cart') !== -1 && !/sold/i.test(txt)))
            )
              return 'IN_STOCK';
            if (!dis && txt.length > 2 && !/sold\s*out/i.test(txt))
              return 'IN_STOCK';
          } catch (e) {}
          return null;
        }"""
        try:
            raw = await page.evaluate(script)
            if isinstance(raw, str) and raw.strip():
                return raw.strip().upper()[:160]
            return None
        except Exception:
            return None

    async def _extract_fluffco_availability_dom(self, page):
        """
        home.fluff.co React PDP：schema.org 常与图中其它实体串味或缺失；
        从主购买区文案读取在售/售罄/紧迫库存（与 URL variant 所见一致）。
        """
        script = r"""() => {
          try {
            var root =
              document.querySelector('.pdp-info') ||
              document.querySelector('[class*="pdp-info"]');
            if (!root) return null;
            var btns = root.querySelectorAll('button');
            for (var bi = 0; bi < btns.length; bi++) {
              var b = btns[bi];
              if (b.offsetParent === null) continue;
              var bx = (
                (b.innerText || '') +
                ' ' +
                (b.getAttribute('aria-label') || '')
              ).toLowerCase();
              var dis =
                b.disabled ||
                b.getAttribute('aria-disabled') === 'true';
              if (/sold\s*out|unavailable|notify\s+when/i.test(bx))
                continue;
              if (
                !dis &&
                bx.indexOf('cart') !== -1 &&
                /add|buy/i.test(bx)
              )
                return 'IN_STOCK';
            }
            var slice = (root.innerText || '').slice(0, 8000);
            if (/sold\s+out|out\s+of\s+stock/i.test(slice))
              return 'OUT_OF_STOCK';
            var low = slice.toLowerCase();
            if (
              /only\s+\d+\s*%?\s*left|almost\s+sold\s+out|low\s+stock|limited\s+quantity|few\s+left/i.test(
                low
              )
            )
              return 'LIMITED';
          } catch (e) {}
          return null;
        }"""
        try:
            raw = await page.evaluate(script)
            if isinstance(raw, str) and raw.strip():
                return raw.strip()[:160]
            return None
        except Exception:
            return None

    async def _extract_fluffco_product_price_dom(self, page):
        """
        FluffCo：新版站点 home.fluff.co 使用 React PDP（.pdp-price + 同排划线价）；
        旧版 Shopify 自定义 <product-price> 仍作后备。
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
            function homeFluffPdpRow() {
              var pe =
                document.querySelector('.pdp-info .pdp-price') ||
                document.querySelector('.pdp-price');
              if (!pe) return null;
              var saleTxt = pe.innerText || pe.textContent || '';
              var saleM = String(saleTxt).match(
                /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/
              );
              var sale = saleM
                ? parseFloat(saleM[1].replace(/,/g, ''))
                : null;
              if (
                sale == null ||
                isNaN(sale) ||
                sale < 5 ||
                sale > 100000
              ) {
                return null;
              }
              var row = pe.closest('div');
              if (!row) row = pe.parentElement;
              var compare = null;
              if (row) {
                var strike =
                  row.querySelector('span[style*="line-through"]') ||
                  row.querySelector('[style*="text-decoration-line"]');
                if (!strike) {
                  strike = row.querySelector(
                    'span[style*="text-decoration"]'
                  );
                }
                if (strike && strike !== pe && !pe.contains(strike)) {
                  var ct = strike.innerText || strike.textContent || '';
                  var cm = String(ct).match(
                    /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/
                  );
                  if (cm) {
                    var cv = parseFloat(cm[1].replace(/,/g, ''));
                    if (!isNaN(cv) && cv > sale && cv <= 100000) {
                      compare = cv;
                    }
                  }
                }
                if (compare == null) {
                  var block = row.innerText || '';
                  var nosave = block.replace(/\bsave\s*\d{1,3}\s*%/gi, ' ');
                  nosave = nosave.replace(/\b\d{1,3}\s*%\s*off\b/gi, ' ');
                  var re = /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
                  var nums = [];
                  var mm;
                  while ((mm = re.exec(nosave)) !== null) {
                    var v = parseFloat(mm[1].replace(/,/g, ''));
                    if (v >= 5 && v <= 100000) nums.push(v);
                  }
                  if (nums.length) {
                    var mx = Math.max.apply(null, nums);
                    if (mx > sale * 1.02) compare = mx;
                  }
                }
              }
              var out = { sale: sale };
              if (compare != null) out.compare = compare;
              return out;
            }
            var hf = homeFluffPdpRow();
            if (hf && hf.sale != null) return hf;
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
              if (/^\s*%/.test(tail)) continue;
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

    async def _extract_woocommerce_variations_pricing(self, page) -> dict[str, Any] | None:
        """
        WooCommerce 可变商品：variations_form 内嵌 JSON —— 现价、划线价、各变体库存汇总。
        """
        script = r"""() => {
          const form = document.querySelector(
            'form.variations_form[data-product_variations]'
          );
          if (!form) return null;
          try {
            const raw = form.getAttribute('data-product_variations');
            if (!raw) return null;
            const vars = JSON.parse(raw);
            if (!Array.isArray(vars) || vars.length === 0) return null;
            let minSale = null;
            let maxReg = null;
            let inStock = 0;
            let outOfStock = 0;
            for (let i = 0; i < vars.length; i++) {
              const v = vars[i];
              const dp = v.display_price;
              const dr = v.display_regular_price;
              if (typeof dp === 'number' && !isNaN(dp) && dp >= 5 && dp <= 100000) {
                minSale = minSale == null ? dp : Math.min(minSale, dp);
              }
              if (typeof dr === 'number' && !isNaN(dr) && dr >= 5 && dr <= 100000) {
                maxReg = maxReg == null ? dr : Math.max(maxReg, dr);
              }
              if (v.is_in_stock === true) inStock++;
              else if (v.is_in_stock === false) outOfStock++;
            }
            if (minSale == null) return null;
            const out = { price: minSale };
            if (maxReg != null && maxReg > minSale * 1.009) {
              out.msrp = maxReg;
            }
            if (inStock > 0 && outOfStock === 0) {
              out.availability = 'IN_STOCK';
            } else if (outOfStock > 0 && inStock === 0) {
              out.availability = 'OUT_OF_STOCK';
            } else if (inStock > 0 && outOfStock > 0) {
              out.availability = 'LIMITED';
            }
            return out;
          } catch (e) {
            return null;
          }
        }"""
        try:
            raw = await page.evaluate(script)
            if not raw or not isinstance(raw, dict):
                return None
            out: dict[str, Any] = {}
            p = raw.get("price")
            if p is not None:
                try:
                    pf = float(p)
                    if 5.0 <= pf <= 100000.0:
                        out["price"] = pf
                except (TypeError, ValueError):
                    pass
            m = raw.get("msrp")
            if m is not None:
                try:
                    mf = float(m)
                    if mf > 0:
                        out["msrp"] = mf
                except (TypeError, ValueError):
                    pass
            av = raw.get("availability")
            if isinstance(av, str) and av.strip():
                out["availability"] = av.strip()[:160]
            return out if out else None
        except Exception:
            return None

    async def _extract_woocommerce_summary_sale_regular(self, page) -> dict[str, Any] | None:
        """
        摘要区 p.price：促销模板 ins（现价）+ del（划线原价），或「From $a - $b」区间价。
        """
        script = r"""() => {
          const root = document.querySelector(
            '.summary.entry-summary, div.product div.summary'
          );
          if (!root) return null;
          const pe = root.querySelector('p.price');
          if (!pe) return null;
          function numFrom(el) {
            if (!el) return null;
            const t = el.innerText || el.textContent || '';
            const m = t.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
            if (!m) return null;
            const v = parseFloat(m[1].replace(/,/g, ''));
            if (v >= 5 && v <= 100000) return v;
            return null;
          }
          const delEl = pe.querySelector(
            'del .woocommerce-Price-amount, del span.amount, del span[class*="Price"]'
          );
          const insEl = pe.querySelector(
            'ins .woocommerce-Price-amount, ins span.amount, ins span[class*="Price"]'
          );
          const reg = numFrom(delEl);
          const sale = numFrom(insEl);
          if (reg != null && sale != null && reg > sale * 1.009) {
            return { price: sale, msrp: reg, old_price: reg };
          }
          if (sale != null) {
            return { price: sale, msrp: null, old_price: null };
          }
          const amounts = pe.querySelectorAll(
            '.woocommerce-Price-amount bdi, .woocommerce-Price-amount'
          );
          const nums = [];
          for (let i = 0; i < amounts.length; i++) {
            const n = numFrom(amounts[i]);
            if (n != null) nums.push(n);
          }
          if (nums.length === 0) return null;
          let lo = nums[0];
          let hi = nums[0];
          for (let j = 1; j < nums.length; j++) {
            if (nums[j] < lo) lo = nums[j];
            if (nums[j] > hi) hi = nums[j];
          }
          if (hi > lo * 1.02) {
            return { price: lo, msrp: hi, old_price: hi };
          }
          return { price: lo, msrp: null, old_price: null };
        }"""
        try:
            raw = await page.evaluate(script)
            if not raw or not isinstance(raw, dict):
                return None
            out: dict[str, Any] = {}
            for key in ("price", "msrp", "old_price"):
                v = raw.get(key)
                if v is None:
                    continue
                try:
                    f = float(v)
                    if key == "price":
                        if 5.0 <= f <= 100000.0:
                            out[key] = f
                    elif f > 0:
                        out[key] = f
                except (TypeError, ValueError):
                    pass
            return out if out else None
        except Exception:
            return None

    async def _extract_woocommerce_stock_line(self, page) -> str | None:
        """WooCommerce 常见 `p.stock.in-stock` / `out-of-stock` 文案。"""
        script = r"""() => {
          const el =
            document.querySelector('p.stock') ||
            document.querySelector('.product_meta .stock');
          if (!el) return null;
          const cls = String(el.className || '').toLowerCase();
          const t = (el.textContent || '').toLowerCase();
          if (cls.includes('out-of-stock') || t.includes('out of stock'))
            return 'OUT_OF_STOCK';
          if (cls.includes('available-on-backorder') || t.includes('backorder'))
            return 'PRE_ORDER';
          if (cls.includes('in-stock') || (t.includes('in stock') && !t.includes('out')))
            return 'IN_STOCK';
          return null;
        }"""
        try:
            s = await page.evaluate(script)
            return str(s).strip()[:160] if s else None
        except Exception:
            return None

    async def _extract_promotional_intel(self, page):
        """
        扫描含 OFF / SAVE / CODE 的文案节点与常见「隐式」来源，提取优惠码。
        不再从全页拼接文案中匹配任意「N% off」，以免全站大促横幅写入 promo_discount_percent；
        叠折百分比见 extract_promo_discount_percent_strict / augment_promo_from_plain_text。
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
            sn = raw.get("promo_text_snippet")
            if isinstance(sn, str) and sn.strip():
                out["promo_text_snippet"] = sn.strip()[:600]
            return out if out else None
        except Exception:
            return None

    @staticmethod
    def _stack_percent_without_coupon_allowed() -> bool:
        """为 true 时：无券也保留叠折百分比（默认 false，避免全站横幅误入库）。"""
        v = (os.getenv("ALLOW_STACK_PERCENT_WITHOUT_COUPON") or "").strip().lower()
        return v in ("1", "true", "yes", "on")

    @staticmethod
    def extract_promo_discount_percent_strict(raw_text: str) -> float | None:
        """
        仅从「叠折 / 用码」类短句取百分比；排除 UP TO、SITEWIDE、大促横幅等常见误报。
        不再使用全文任意「30% OFF」。
        """
        if not raw_text or len(raw_text) < 8:
            return None
        bad_ctx = re.compile(
            r"UP\s+TO|SITE(?:\s|-)?WIDE|SELECT\s+(?:ITEMS|STYLES)|MEMORIAL|"
            r"BLACK\s*FRIDAY|CYBER\s*MONDAY|PREVIEW\s+SALE|BEST\s+PRICE\s+ENDS|"
            r"SHOP\s+(?:THE\s+)?SALE|LIMITED\s+TIME\s+ONLY|\bENDS\s+\d",
            re.I,
        )
        patterns = (
            re.compile(r"extra\s+(\d{1,2})\s*%\s*off\b", re.I),
            re.compile(
                r"(\d{1,2})\s*%\s*off\s+with\s+(?:code|coupon|promo)\b", re.I
            ),
            re.compile(
                r"(?:stack|combine)\s+.*?(\d{1,2})\s*%\s*(?:off|discount)\b", re.I
            ),
        )
        for pat in patterns:
            for m in pat.finditer(raw_text):
                start = max(0, m.start() - 140)
                win = raw_text[start : m.end() + 60]
                if bad_ctx.search(win):
                    continue
                try:
                    v = float(m.group(1))
                    if 0 < v <= 95:
                        return v
                except (TypeError, ValueError, IndexError):
                    continue
        return None

    @staticmethod
    def augment_promo_from_plain_text(raw_text: str, data: dict) -> None:
        """从正文再扫一遍优惠码；叠折百分比仅用严格上下文（见 extract_promo_discount_percent_strict）。"""
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
            pct = ForensicAuditEngine.extract_promo_discount_percent_strict(raw_text)
            if pct is not None:
                data["promo_discount_percent"] = pct

    @staticmethod
    def reconcile_display_prices(data: dict[str, Any]) -> None:
        """保证现价与划线价自洽：msrp/old_price 必须严格大于现价。"""
        try:
            p = float(data.get("price") or 0)
        except (TypeError, ValueError):
            return
        if p <= 0:
            return
        for key in ("msrp", "old_price"):
            raw = data.get(key)
            if raw is None:
                continue
            try:
                m = float(raw)
            except (TypeError, ValueError):
                continue
            if m <= p:
                data["msrp"] = None
                data["old_price"] = None
                return

    @staticmethod
    def apply_aggregate_high_as_msrp_if_plausible(
        data: dict[str, Any], extras: dict[str, Any] | None
    ) -> None:
        """
        在尚无可靠划线价时，用 JSON-LD 全局 AggregateOffer.highPrice 补 MSRP。
        仅当 high/现价 比例在常见促销带内（避免「跨规格最低价 + 全站最高价」错配）。
        """
        if not extras or not isinstance(extras, dict):
            return
        hp = extras.get("highPrice")
        if hp is None:
            return
        try:
            hf = float(hp)
            pf = float(data.get("price") or 0)
        except (TypeError, ValueError):
            return
        if pf <= 0 or hf <= pf * 1.015 or hf > pf * 1.48:
            return
        cur = data.get("msrp")
        try:
            curf = float(cur) if cur is not None else None
        except (TypeError, ValueError):
            curf = None
        if curf is not None and curf >= hf:
            return
        data["msrp"] = hf
        data["old_price"] = hf

    @staticmethod
    def compute_total_savings(
        msrp: float | None,
        price: float | None,
        promo_discount_percent: float | None = None,
    ):
        """
        估算相对「官方划线 / MSRP」的总节省额。

        爬虫写入的 price 在绝大多数 PDP 上已是「促销后货架价」；若再乘
        promo_discount_percent，易与整站横幅、配件区误扫的 X% off 双算，
        total_savings 会远大于页面主价区（如 Save $525）。

        规则：
        - 当 MSRP 明显高于现价（典型「划线 + 促销价」）时：total_savings = MSRP − price。
        - 仅当 MSRP 与现价几乎同价（无可靠划线差）且扫到额外叠券比例时，才用
          effective = price * (1 − pct/100) 再算 MSRP − effective（少数「标价即牌价」站点）。
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
        # 约 0.3% 以上价差视为「已有划线→现价」的主促销，不再叠扫到的百分比
        if m > p * 1.003:
            return max(0.0, m - p)
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
                "price_selectors_fallback": [
                    ".entry-summary .price",
                    ".entry-summary p.price",
                    "div.product p.price",
                    "div.product .price",
                    ".woocommerce-Price-amount.amount",
                    "p.price .woocommerce-Price-amount",
                    ".product .summary .price",
                    "[itemprop='price']",
                    "ins .woocommerce-Price-amount",
                ],
                "image_selector": ".woocommerce-product-gallery__image img.wp-post-image",
                # WooCommerce：标题类名常为 product_title；价格在 entry-summary 较晚渲染
                "wait_for": ".product_title, .entry-summary .price, h1.product_title",
            },
            "FluffCo": {
                "price_selector": ".pdp-info .pdp-price",
                "price_selectors_fallback": [
                    ".pdp-price",
                    "[class*='pdp-price']",
                    "product-price .final.price-field",
                    ".desktop.module.block-price product-price",
                    "product-price",
                    ".product-single__price",
                ],
                "image_selector": ".pdp-gallery img",
                "wait_for": ".pdp-price, h1.pdp-h1, h1",
            },
        }

        config = BRAND_MAP.get(self.brand, {})
        selector_chain: list[str] = []
        if config.get("price_selector"):
            selector_chain.append(config["price_selector"])
        for fb in config.get("price_selectors_fallback") or []:
            if fb and fb not in selector_chain:
                selector_chain.append(fb)
        proxy_server = resolve_playwright_proxy_server()
        proxy_settings = {"server": proxy_server} if proxy_server else None
        if proxy_server:
            print(f"🌐 Playwright 代理已启用: {format_proxy_for_log(proxy_server)}")
        else:
            print(
                "🌐 Playwright 未检测到代理（未设置 PROXY_URL / HTTPS_PROXY / HTTP_PROXY）"
            )

        goto_timeout = 30000
        wait_until = "domcontentloaded"

        async with async_playwright() as p:
            browser = await p.chromium.launch(**self._chromium_launch_options(proxy_settings))
            context = await browser.new_context(**playwright_fetch_site_new_context_kwargs())
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

                if response.status in (401, 403):
                    data["status"] = response.status
                    print(
                        "⚠️ HTTP %s：与旧版 sb_batch_scanner 一致，仍尝试解析页面正文（错误页通常无价格）。"
                        % response.status
                    )
                    if proxy_server:
                        print(
                            "（代理已启用；若正文仍是拦截页，可换节点或 PLAYWRIGHT_CHROME_CHANNEL=chrome / HEADED=1。）"
                        )

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

                try:
                    await page.wait_for_load_state("networkidle", timeout=22000)
                except Exception:
                    pass

                if self.brand == "Saatva":
                    try:
                        await page.get_by_role(
                            "button", name=re.compile(r"^\s*Queen\s*$", re.I)
                        ).first.click(timeout=5000)
                    except Exception:
                        pass
                    await asyncio.sleep(2.0)
                else:
                    await asyncio.sleep(0.75)

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
                        av0 = str(anchor["availability"]).strip()
                        # JSON-LD 图中常有无关节点的 OutOfStock，勿单独采信缺货
                        if av0.upper() != "OUT_OF_STOCK":
                            data["availability"] = av0[:160]

                # Shopify meta.compare_at_price：即使 JSON-LD 已写入现价也要执行，否则 FluffCo 等仅有售价、无 schema 划线价。
                shop = await self._extract_shopify_variant_pricing(page)
                if shop:
                    sale_now = float(data.get("price") or 0)
                    if shop.get("price") is not None:
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
                    av_shop = shop.get("availability")
                    if isinstance(av_shop, str) and av_shop.strip():
                        data["availability"] = str(av_shop).strip()[:160]

                # Sleep & Beyond：变体 JSON（价+库存）+ 摘要区 del/ins（划线价）+ p.stock（补库存）
                if self.brand == "Sleep & Beyond":
                    woo = await self._extract_woocommerce_variations_pricing(page)
                    if woo:
                        wp = woo.get("price")
                        if wp is not None:
                            data["price"] = float(wp)
                        wm = woo.get("msrp")
                        if wm is not None:
                            try:
                                wf = float(wm)
                                sp = float(data.get("price") or 0)
                                if wf > sp > 0:
                                    data["msrp"] = wf
                                    data["old_price"] = wf
                            except (TypeError, ValueError):
                                pass
                        wav = woo.get("availability")
                        if isinstance(wav, str) and wav.strip():
                            data["availability"] = wav.strip()[:160]

                    summ = await self._extract_woocommerce_summary_sale_regular(page)
                    if summ:
                        sf = summ.get("price")
                        if sf is not None:
                            try:
                                pf = float(sf)
                                if 5.0 <= pf <= 100000.0:
                                    data["price"] = pf
                            except (TypeError, ValueError):
                                pass
                        sm = summ.get("msrp")
                        sp_now = float(data.get("price") or 0)
                        if sm is not None:
                            try:
                                mf = float(sm)
                                if mf > sp_now > 0:
                                    data["msrp"] = mf
                                    data["old_price"] = float(
                                        summ.get("old_price") or mf
                                    )
                            except (TypeError, ValueError):
                                pass

                    if not data.get("availability"):
                        st_line = await self._extract_woocommerce_stock_line(page)
                        if st_line:
                            data["availability"] = st_line[:160]

                # FluffCo：PDP 行内 .pdp-price + 同排数字，或旧 <product-price> 结构
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
                        elif pl is None and 5.0 <= psf <= 100000.0:
                            # 无划线价时：摘要栏单价须能覆盖错误的 schema 锚定（SB / Saatva 等 React PDP 常见）
                            if (
                                data["price"] == 0.0
                                or self.brand == "Sleep & Beyond"
                                or self.brand == "Saatva"
                            ):
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
                elif self.brand == "FluffCo":
                    # React PDP：叠放徽章 + 多帧轮播。勿用 og:image 兜底——本站常为第三方截图非商品图。
                    # 优先选「inset:0 且非 opacity:0」的当前主帧；再退回第二张（首张多为徽章）。
                    try:
                        try:
                            await page.wait_for_selector(
                                ".pdp-gallery [style*='aspect-ratio'] img",
                                timeout=12000,
                            )
                        except Exception:
                            pass
                        src = await page.evaluate(r"""() => {
                          function srcUrl(im) {
                            const u = im.currentSrc || im.src || im.getAttribute('src');
                            if (!u || !/^https?:\/\//i.test(String(u).trim())) return null;
                            return String(u).trim();
                          }
                          /** URL / 路径含奖章素材（与是否 540 大图无关） */
                          function isBadgeAsset(u) {
                            if (!u) return true;
                            const low = String(u).toLowerCase();
                            return (
                              /badge|best-list|best_list|apt-therapy|apt_therapy|apttherapy|the-best-list|pillows.for.back/i.test(
                                low
                              )
                            );
                          }
                          function isHiddenSlide(im) {
                            const st = im.getAttribute('style') || '';
                            return /opacity:\\s*0(?:\\s|;|,|$)/.test(st);
                          }
                          function pickHero(imgs) {
                            for (let i = 0; i < imgs.length; i++) {
                              const im = imgs[i];
                              const st = im.getAttribute('style') || '';
                              if (!/inset:\\s*0(?:px)?/i.test(st)) continue;
                              if (isHiddenSlide(im)) continue;
                              const u = srcUrl(im);
                              if (u && !isBadgeAsset(u)) return u;
                            }
                            for (let j = 0; j < imgs.length; j++) {
                              const u = srcUrl(imgs[j]);
                              if (u && !isBadgeAsset(u)) return u;
                            }
                            return null;
                          }
                          const g = document.querySelector('.pdp-gallery');
                          if (!g) return null;
                          const heroBox = g.querySelector('[style*="aspect-ratio"]');
                          if (heroBox) {
                            const imgs = Array.from(heroBox.querySelectorAll('img'));
                            const u = pickHero(imgs);
                            if (u) return u;
                          }
                          const anyImgs = Array.from(
                            g.querySelectorAll('img:not(button img)')
                          );
                          return pickHero(anyImgs);
                        }""")
                        if src:
                            data["original_image"] = src
                    except Exception:
                        pass
                elif config.get("image_selector"):
                    try:
                        sel = config["image_selector"]
                        src = await page.evaluate(
                            """(selector) => {
                              const el = document.querySelector(selector);
                              if (!el) return null;
                              const tag = el.tagName ? el.tagName.toUpperCase() : '';
                              if (tag === 'META')
                                return el.content || null;
                              const u =
                                el.currentSrc ||
                                el.src ||
                                el.getAttribute('src');
                              return u || null;
                            }""",
                            sel,
                        )
                        if src:
                            data["original_image"] = str(src).strip()
                        if not data.get("original_image"):
                            data["original_image"] = await page.evaluate(
                                "() => document.querySelector('meta[property=\"og:image\"]')?.content"
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
                sanitize_coupon_for_persistence(data)
                if data.get("coupon_code"):
                    data["coupon_code"] = await finalize_coupon_for_store(
                        url, data["coupon_code"]
                    )
                if (
                    not data.get("coupon_code")
                    and not ForensicAuditEngine._stack_percent_without_coupon_allowed()
                ):
                    data["promo_discount_percent"] = None

                extras = await self._extract_json_ld_extras(page)
                if extras:
                    av = extras.get("availability")
                    if av and not data.get("availability"):
                        avx = str(av).strip()
                        if avx.upper() != "OUT_OF_STOCK":
                            data["availability"] = avx[:160]
                    self.apply_aggregate_high_as_msrp_if_plausible(data, extras)

                self.reconcile_display_prices(data)

                if self.brand == "FluffCo":
                    fc_av = await self._extract_fluffco_availability_dom(page)
                    if fc_av:
                        prev_u = (data.get("availability") or "").strip().upper()
                        if fc_av == "OUT_OF_STOCK":
                            data["availability"] = fc_av
                        elif fc_av == "LIMITED":
                            if "OUT" not in prev_u:
                                data["availability"] = fc_av
                        elif fc_av == "IN_STOCK" and not data.get(
                            "availability"
                        ):
                            data["availability"] = fc_av

                ui_av = await self._reconcile_availability_with_buy_button(page)
                if ui_av == "IN_STOCK":
                    cur = (data.get("availability") or "").strip().upper()
                    if cur == "OUT_OF_STOCK" or not data.get("availability"):
                        data["availability"] = "IN_STOCK"
                elif ui_av == "OUT_OF_STOCK":
                    data["availability"] = "OUT_OF_STOCK"

            except Exception as e:
                print(f"⚠️ 官网扫描受限: {e}")
                data['error_log'] = str(e)
            finally:
                await _safe_close_playwright_browser(context, browser)
        return data 

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=5, max=15))
    async def _deepseek_chat_json_object(
        self, user_message: str, *, system: str | None = None
    ) -> dict:
        """DeepSeek Chat API → 解析为单个 JSON 对象（可选 system 强化契约）。"""
        api_key = os.getenv("DEEPSEEK_API_KEY")
        if not api_key:
            raise ValueError("未配置 DEEPSEEK_API_KEY，无法进行 LLM 调用")

        messages: list[dict[str, str]] = []
        if system and system.strip():
            messages.append({"role": "system", "content": system.strip()})
        messages.append({"role": "user", "content": user_message})

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
                    "messages": messages,
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

    async def call_deepseek_audit(self, prompt, context):
        """DeepSeek Chat（OpenAI 兼容接口）做法医审计 JSON。"""
        user = (
            f"{prompt.strip()}\n\n--- EVIDENCE ---\n{context.strip()}\n\n"
            "Output exactly one JSON object as defined in your system instructions."
        )
        return await self._deepseek_chat_json_object(
            user, system=_DEEPSEEK_FORENSIC_AUDIT_SYSTEM
        )

    @staticmethod
    def _confidence_from_density(signal_density: int) -> float:
        """样本越多置信越高；密度为 0 时保留极小正值以便排序。"""
        if signal_density <= 0:
            return 0.05
        return round(min(1.0, signal_density / 30.0), 4)

    async def call_ai_brand_intel_batch(self, platform_blocks: list) -> list[dict]:
        """按平台批量抽取 sentiment / tags / verdict_summary → 写入 brand_intelligence。"""
        trimmed = []
        for b in platform_blocks or []:
            ev = (b.get("evidence_text") or "").strip()
            if not ev:
                continue
            trimmed.append(
                {
                    "source_platform": b.get("source_platform") or "Unknown",
                    "signal_density": int(b.get("signal_density") or 0),
                    "evidence_excerpt": ev[:3200],
                }
            )
        if not trimmed:
            return []

        user = (
            "INPUT_JSON:\n"
            + json.dumps(
                {
                    "brand": self.brand,
                    "model": self.model,
                    "platforms": trimmed,
                },
                ensure_ascii=False,
            )
            + "\n\nReturn exactly one JSON object with top-level key \"items\" only, "
            "per your system instructions."
        )
        try:
            parsed = await self._deepseek_chat_json_object(
                user, system=_DEEPSEEK_BRAND_INTEL_SYSTEM
            )
            items = parsed.get("items") or []
            out = []
            density_map = {x["source_platform"]: x["signal_density"] for x in trimmed}
            for it in items:
                plat = (it.get("source_platform") or "").strip()
                if plat not in density_map:
                    continue
                tags = _sanitize_key_issue_tags(it.get("key_issue_tags"))
                ss_raw = it.get("sentiment_score")
                try:
                    ss = float(ss_raw if ss_raw is not None else 0.5)
                except (TypeError, ValueError):
                    ss = 0.5
                ss = max(0.0, min(1.0, ss))
                out.append(
                    {
                        "source_platform": plat,
                        "sentiment_score": ss,
                        "key_issue_tags": tags,
                        "verdict_summary": (it.get("verdict_summary") or "").strip()[:2000],
                        "signal_density": density_map[plat],
                    }
                )
            return out
        except Exception as e:
            print(f"⚠️ brand_intel LLM 解析失败: {e}")
            return []

    async def _persist_brand_intelligence(self, platform_blocks: list) -> None:
        rows = await self.call_ai_brand_intel_batch(platform_blocks)
        if not rows:
            return
        now = datetime.now(UTC).isoformat()
        for row in rows:
            dens = int(row.get("signal_density") or 0)
            conf = self._confidence_from_density(dens)
            payload = {
                "brand_slug": self.brand_slug,
                "product_slug": self.slug,
                "source_platform": row["source_platform"],
                "sentiment_score": row.get("sentiment_score", 0.5),
                "key_issue_tags": row.get("key_issue_tags") or [],
                "verdict_summary": row.get("verdict_summary") or "",
                "signal_density": dens,
                "confidence_score": conf,
                "updated_at": now,
                "collected_at": now,
            }
            try:
                self.supabase.table("brand_intelligence").upsert(
                    payload,
                    on_conflict="brand_slug,product_slug,source_platform",
                ).execute()
            except Exception as ex:
                print(
                    f"⚠️ brand_intelligence upsert 失败 ({row.get('source_platform')}): {ex}"
                )

    async def execute_and_sync(self, url):
        # 1. 采集数据
        site_data = await self.fetch_site_data(url)

        # --- 新增判断逻辑 ---
        # 如果价格没拿到且文本内容太短，判定为抓取失败，不触发 LLM 审计
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

        social_proof, serp_review_count, platform_blocks = await self.intel.fetch_social_proof(
            f"{self.brand} {self.model}",
            product_id=existing_id,
            supabase_client=self.supabase,
            brand_slug=self.brand_slug,
            product_slug=self.slug,
        )

        # 2. 注入审计上下文 (大幅减少 Token 占用)
        audit_context = f"--- OFFICIAL SPECS ---\n{clean_text}\n\n--- SOCIAL EVIDENCE ---\n{social_proof[:800]}"

        # 3. 法医审计 — user 任务说明；JSON 契约见 _DEEPSEEK_FORENSIC_AUDIT_SYSTEM
        audit_prompt = f"""
AUDIT TARGET: {self.brand} {self.model}

Act as a senior biomechanical mattress auditor. Using the evidence block:
- Fill audit_scores on the 0.0–10.0 scale with all five required keys (overall, support, cooling, pressure, durability).
- Complete technical_specs (seven exact keys) and specs_matrix (four required keys plus non-empty string values).
- Provide pros and cons as arrays of concise strings; audit_note (clinical, ~60 words max); summary_log with [T-00:00:00] style steps.
- SEO: seo_title (<=60 chars, include "Forensic Audit" and "Review"), seo_description (<=155 chars), seo_keywords (5–8 comma-separated, lowercase).
- detected_coupon and promo_text as strings (use empty string when absent).
"""

        audit_llm_label = DEEPSEEK_AUDIT_LABEL
        try:
            print(
                f"🧠 启动 {DEEPSEEK_AUDIT_LABEL}（{DEEPSEEK_MODEL_ID}）深度审计..."
            )
            report = await self.call_deepseek_audit(
                audit_prompt, audit_context
            )
        except Exception as ds_err:
            print(f"❌ DeepSeek 审计失败: {ds_err}")
            raise RuntimeError(f"LLM 审计失败 — DeepSeek: {ds_err!s}") from ds_err

        try:
            # 逻辑层：生成专业日志与数据校正
            scores = _normalize_audit_scores_from_llm(report.get("audit_scores"))

            # 2. 数据清洗 (必须在构建 payload 之前)
            clean_desc = report.get('seo_description', '').strip().replace('"', '')
            clean_title = report.get('seo_title', '').strip().replace('"', '')
            clean_keywords = report.get('seo_keywords', '').strip().lower()

            tech_specs = report.get("technical_specs")
            if isinstance(tech_specs, dict) and "Certifications" not in tech_specs:
                tech_specs["Certifications"] = "Not stated in captured listing"

            # 我们将 specs_matrix 放入 audit_data 字段中
            msrp_val = site_data.get("msrp")
            msrp_num = float(msrp_val) if msrp_val else 0.0

            audit_data_payload = {
                "audit_hash": self.generate_hash(),
                "evidence_size": len(audit_context),
                "model": audit_llm_label,
                "api_model_id": DEEPSEEK_MODEL_ID,
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
                "pros": _normalize_str_list_for_audit(report.get("pros")),
                "cons": _normalize_str_list_for_audit(report.get("cons")),
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
                dc_raw = report.get("detected_coupon")
                dc_n = normalize_coupon_token(dc_raw) if dc_raw else None
                if dc_n and coupon_token_is_plausible(dc_n):
                    dc_n = await finalize_coupon_for_store(url, dc_n)
                else:
                    dc_n = None
                offer_row = {
                    "product_id": product_uuid,
                    "site_name": self.brand,
                    "price": site_data['price'],
                    "offer_url": url,
                    "promo_text": report.get('promo_text') or "Best Offer Detected",
                    "is_primary": True,
                    "status": "active",
                    "last_checked_at": datetime.now(UTC).isoformat(),
                }
                if dc_n:
                    offer_row["coupon_code"] = dc_n[:80]
                else:
                    offer_row["coupon_code"] = None
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

                try:
                    await self._persist_brand_intelligence(platform_blocks)
                except Exception as bi_err:
                    print(f"⚠️ brand_intelligence 流水线异常: {bi_err}")

                print(
                    f"✅ 审计存证已锁定: {self.slug} | LLM: {audit_llm_label} | "
                    f"价格: {site_data['price']} | 指纹: {payload['audit_data']['audit_hash']}"
                )

        except Exception as e:
            print(f"❌ 级联同步失败: {e}")

# if __name__ == "__main__":
#     engine = ForensicAuditEngine("Saatva", "Rx")
#     asyncio.run(engine.execute_and_sync("https://www.saatva.com/mattresses/saatva-rx"))