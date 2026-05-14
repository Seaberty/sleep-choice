# -*- coding: utf-8 -*-
"""
统一情报同步入口：多品牌批量审计与价格补完（默认含 Saatva、Sleep & Beyond、FluffCo 等）。

用法：
  cd src/scripts && python batch_scanner.py                  # 全部品牌（增量：缺字段才跑）
  python batch_scanner.py --force                            # 全部强制全量重审
  python batch_scanner.py --brand Saatva                     # 单一品牌
  python batch_scanner.py --brand fluffco --brand saatva    # 多个品牌
  python batch_scanner.py --full-sync                       # 等价 --force（命名便于 cron）

官网 PDP 列表**仅**从各站 sitemap 自动发现；无静态 URL 回退（抓取失败则该品牌任务为空）。
扩展品牌：在 ``BRAND_SITE_PROFILES`` 中增加一项，或添加 ``src/data/batch_scanner_brand_profiles.json``（见模块内说明）。
缓存：``src/data/batch_scanner_targets.cache.json``
  BATCH_SCANNER_TARGETS_CACHE_HOURS — 缓存有效小时数，默认 168（7 天）。
  BATCH_SCANNER_TARGETS_CACHE_PATH — 覆盖缓存 JSON 路径。
  SAATVA_SITEMAP_URL / SB_SHOP_ORIGIN / FLUFFCO_SHOP_ORIGIN — 覆盖抓取起点。
  通过 ``batch_scanner_brand_profiles.json`` 扩展品牌时，若使用 ``tempurpedic_sitemap``，可设
  TEMPURPEDIC_SHOP_ORIGIN / TEMPURPEDIC_SITEMAP_URL。

  python batch_scanner.py --refresh-targets   # 忽略缓存重新拉 sitemap 再跑任务

试跑（不写库、不联网）：
  python batch_scanner.py --dry-run -b FluffCo

定时示例：
  0 6 * * * ... python batch_scanner.py                      # 每日增量
  0 */4 * * * ... python batch_scanner.py --site-only        # 每 4h 官网情报（单次耗时长，勿盲目每小时）

推广物料（JSON / Pinterest PNG / Reddit 草稿，不写社交 API）：
  python promo_assets.py --output-dir ./promo_output
"""
from __future__ import annotations

import argparse
import asyncio
import html
import json
import os
import re
import ssl
import sys
import urllib.error
import urllib.request
from datetime import datetime, UTC
from pathlib import Path
from typing import TYPE_CHECKING, Any
from urllib.parse import urlparse

from dotenv import load_dotenv
from supabase import Client, create_client

if TYPE_CHECKING:
    from forensic_engine import ForensicAuditEngine

_FORENSIC_ENGINE_MOD: Any = None


def _forensic_engine():
    """延迟加载 forensic_engine；sitemap 发现逻辑不依赖此模块。"""
    global _FORENSIC_ENGINE_MOD
    if _FORENSIC_ENGINE_MOD is None:
        import forensic_engine as _FORENSIC_ENGINE_MOD

    return _FORENSIC_ENGINE_MOD

_ROOT = Path(__file__).resolve().parents[2]
_ENV = _ROOT / ".env.local"
if not _ENV.is_file():
    _ENV = Path(__file__).resolve().parents[1] / ".env.local"
load_dotenv(dotenv_path=_ENV)


def _bootstrap_supabase_env_from_aliases() -> None:
    """把 Vercel 常用别名写回标准名，便于 forensic_engine 等仍读 SUPABASE_*。"""
    if not (os.getenv("SUPABASE_URL") or "").strip():
        alt = (os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
        if alt:
            os.environ["SUPABASE_URL"] = alt
    if not (os.getenv("SUPABASE_KEY") or "").strip():
        alt = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
        if alt:
            os.environ["SUPABASE_KEY"] = alt


_bootstrap_supabase_env_from_aliases()


def _resolve_supabase_credentials() -> tuple[str | None, str | None]:
    """优先标准名；兼容 Next/Vercel 常用名与 service_role。"""
    url = (
        (os.getenv("SUPABASE_URL") or "").strip()
        or (os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    )
    key = (
        (os.getenv("SUPABASE_KEY") or "").strip()
        or (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    )
    return (url or None, key or None)


def _audit_msrp_unset(row: dict | None) -> bool:
    """audit_products.msrp 未写入或可视为缺失（None / 非正数）。"""
    if not row:
        return True
    m = row.get("msrp")
    if m is None:
        return True
    try:
        return float(m) <= 0
    except (TypeError, ValueError):
        return True


def get_clean_slug(brand: str, model: str) -> str:
    """与 ForensicAuditEngine.slug 一致。"""

    def slugify(text: str) -> str:
        text = text.lower().replace("&", "and")
        text = re.sub(r"[^a-z0-9]+", "-", text)
        return text.strip("-")

    return slugify(f"{brand}-{model}")


# --- 品牌站点矩阵（仅 sitemap；无静态 URL 表）---------------------------------
# 扩展方式：
#   1) 修改下方 BUILTIN_BRAND_SITE_PROFILES；或
#   2) 新增 src/data/batch_scanner_brand_profiles.json（JSON 数组），字段示例：
#        {"name": "MyBrand", "cooldown_sec": 25, "discover_kind": "shopify_products",
#         "origin": "https://shop.example.com"}
#      discover_kind 支持：
#        saatva_mattresses | woocommerce_products | shopify_products | tempurpedic_sitemap
#      同名品牌会覆盖内置项。

_EXTRA_PROFILES_PATH = _ROOT / "src" / "data" / "batch_scanner_brand_profiles.json"

BUILTIN_BRAND_SITE_PROFILES: tuple[dict[str, Any], ...] = (
    {"name": "Saatva", "cooldown_sec": 25, "discover_kind": "saatva_mattresses"},
    {
        "name": "Sleep & Beyond",
        "cooldown_sec": 25,
        "discover_kind": "woocommerce_products",
        "origin": "",
    },
    {"name": "FluffCo", "cooldown_sec": 20, "discover_kind": "shopify_products", "origin": ""},
)

_TARGETS_CACHE_PATH = Path(
    (os.getenv("BATCH_SCANNER_TARGETS_CACHE_PATH") or "").strip()
    or str(_ROOT / "src" / "data" / "batch_scanner_targets.cache.json")
)


def _targets_cache_ttl_sec() -> float:
    try:
        h = float((os.getenv("BATCH_SCANNER_TARGETS_CACHE_HOURS") or "168").strip())
    except ValueError:
        h = 168.0
    return max(300.0, h * 3600.0)


def _http_get(url: str, timeout: float = 45.0) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (compatible; SleepChoiceBatchScanner/1.0; "
                "+https://sleepchoiceguide.com)"
            ),
            "Accept": "application/xml,text/xml,application/xhtml+xml,*/*;q=0.8",
        },
        method="GET",
    )
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _extract_sitemap_locs(xml: str) -> list[str]:
    return [
        html.unescape(m.strip())
        for m in re.findall(r"<loc>\s*([^<]+?)\s*</loc>", xml, re.I)
    ]


def _normalize_product_url(url: str) -> str:
    u = (url or "").strip()
    if not u:
        return ""
    return u.split("#")[0].split("?")[0].rstrip("/")


_EXCLUDE_NON_SLEEP_URL_SNIPS: tuple[str, ...] = (
    "gift-card",
    "gift_card",
    "/cart",
    "/account",
    "sample-pack",
    "swatch",
)

_SLEEP_PRODUCT_SLUG_RE = re.compile(
    r"(pillow|mattress|topper|comforter|sheet|duvet|blanket|protector|protect|"
    r"quilt|wool|merino|crib|bunk|feather|foam|towel|robe|sleep|bedding|"
    r"pad|lounge|waffle|silk|kit|down|frame|foundation|base|platform|wink|"
    r"gravity|cloud|ergo|travel)",
    re.I,
)


def _url_looks_sleep_related(url: str) -> bool:
    """WooCommerce / Shopify sitemap 常含非睡眠页；仅保留与睡眠品类相关的 PDP。"""
    lu = url.lower()
    if any(s in lu for s in _EXCLUDE_NON_SLEEP_URL_SNIPS):
        return False
    m = re.search(r"(?:/product/|/products/)([^/?#]+)", url, re.I)
    if not m:
        return True
    return bool(_SLEEP_PRODUCT_SLUG_RE.search(m.group(1)))


_SAATVA_SEGMENT_MODEL: dict[str, str] = {
    "loom-and-leaf": "Loom & Leaf",
    "memory-foam-hybrid": "Memory Foam Hybrid",
    "crib-mattress": "Crib",
    "saatva-youth": "Youth",
}


def _model_from_saatva_mattress_url(url: str) -> str:
    m = re.search(r"/mattresses/([^/?#]+)/?", url, re.I)
    if not m:
        return ""
    seg = m.group(1).lower()
    if seg in _SAATVA_SEGMENT_MODEL:
        return _SAATVA_SEGMENT_MODEL[seg]
    core = seg[7:] if seg.startswith("saatva-") else seg
    parts = [p for p in core.split("-") if p]
    if not parts:
        return ""
    return " ".join(p.capitalize() for p in parts)


_SB_PRODUCT_SLUG_TO_MODEL: dict[str, str] = {
    "mytravel-pillow": "MyTravel Pillow",
    "mywoolly-pillow": "MyWoolly Pillow",
    "mymerino-pillow": "MyMerino Pillow",
    "mymerino-comforter": "MyMerino Comforter",
    "mycomforter": "MyComforter",
    "mytopper": "MyTopper",
    "mymerino-topper": "MyMerino Topper",
    "myprotector": "MyProtector",
    "mysheet-set": "mySheet Set",
    "mypad": "myPad",
}


def _model_from_sb_product_url(url: str) -> str:
    m = re.search(r"/product/([^/?#]+)/?", url, re.I)
    if not m:
        return ""
    slug = m.group(1).lower().strip("/")
    if slug in _SB_PRODUCT_SLUG_TO_MODEL:
        return _SB_PRODUCT_SLUG_TO_MODEL[slug]
    return " ".join(p.capitalize() for p in slug.split("-") if p)


_FLUFF_HANDLE_TO_MODEL: dict[str, str] = {
    "pillow-comforter-kit": "Pillow & Comforter Kit",
    "down-alternative-pillow": "Down Alternative Pillow",
    "down-feather-pillow": "Down Feather Pillow",
    "down-blended-comforter": "Down Blended Comforter",
    "down-alternative-comforter": "Down Alternative Comforter",
    "hotel-lounge-robe": "Hotel Lounge Robe",
    "hotel-waffle-robe": "Hotel Waffle Robe",
    "hotel-towel": "Hotel Towel",
    "silk-pillowcase": "Silk Pillowcase",
}


def _model_from_fluffco_product_url(url: str) -> str:
    m = re.search(r"/products/([^/?#]+)", url, re.I)
    if not m:
        return ""
    handle = m.group(1).lower()
    if handle in _FLUFF_HANDLE_TO_MODEL:
        return _FLUFF_HANDLE_TO_MODEL[handle]
    return " ".join(p.capitalize() for p in handle.split("-") if p)


_TEMPUR_ALLOWED_PREFIXES: frozenset[str] = frozenset(
    {
        "shop-mattresses",
        "shop-pillows",
        "other-products",
        "bedding",
        "bases-and-foundations",
        "bases-and-foundations-v1",
    }
)
_TEMPUR_MATTRESS_HUB_SLUGS: frozenset[str] = frozenset(
    {
        "adapt-collection",
        "breeze-collection",
        "compare-tempurpedic-mattresses",
        "previous-generation-adapt-closeout",
        "split-head-king",
        "tempur-active-breeze",
    }
)
_TEMPUR_PILLOW_HUB_SLUGS: frozenset[str] = frozenset(
    {"all", "adapt-pillows", "breeze-pillows"}
)


def _tempurpedic_slug_keep(prefix: str, slug: str) -> bool:
    """主站 sitemap 含集合页与办公周边；只保留睡眠相关 PDP。"""
    lu = slug.lower()
    if prefix == "shop-mattresses":
        if slug in _TEMPUR_MATTRESS_HUB_SLUGS or lu.startswith("all-"):
            return False
        return bool(_SLEEP_PRODUCT_SLUG_RE.search(slug))
    if prefix == "shop-pillows":
        if slug in _TEMPUR_PILLOW_HUB_SLUGS:
            return False
        return bool(_SLEEP_PRODUCT_SLUG_RE.search(slug))
    if prefix == "other-products":
        if slug == "tempur-toppers":
            return False
        noise = (
            "office-chair",
            "plush-puppy",
            "plush-teddy",
            "wireless-remote",
            "universal-bracket-kit",
            "lumbar-support",
            "seat-cushion",
            "universal-support",
        )
        if any(x in lu for x in noise):
            return False
        return bool(_SLEEP_PRODUCT_SLUG_RE.search(slug))
    if prefix == "bedding":
        return True
    if prefix in ("bases-and-foundations", "bases-and-foundations-v1"):
        return bool(_SLEEP_PRODUCT_SLUG_RE.search(slug)) or any(
            k in lu for k in ("foundation", "frame", "base", "ergo", "ease", "adjust", "power", "bed")
        )
    return False


def _model_from_tempurpedic_url(url: str) -> str:
    try:
        path = (urlparse(url).path or "").strip("/")
    except Exception:
        return ""
    segs = [s for s in path.split("/") if s]
    if len(segs) < 2:
        return ""
    slug = segs[-1].lower()
    return " ".join(p.capitalize() for p in slug.split("-") if p)


def _discover_tempurpedic_products(origin: str) -> list[dict[str, str]]:
    origin = origin.rstrip("/")
    index_url = (os.getenv("TEMPURPEDIC_SITEMAP_URL") or "").strip() or f"{origin}/sitemap.xml"
    xml = _http_get(index_url)
    locs = _extract_sitemap_locs(xml)
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    origin_host = urlparse(origin).netloc.lower()
    for raw in locs:
        try:
            pr = urlparse((raw or "").strip())
        except Exception:
            continue
        if not pr.scheme.startswith("http"):
            continue
        if pr.netloc.lower() != origin_host:
            continue
        segs = [s for s in (pr.path or "").strip("/").split("/") if s]
        if len(segs) != 2:
            continue
        prefix, slug = segs[0], segs[1]
        if prefix not in _TEMPUR_ALLOWED_PREFIXES:
            continue
        if not _tempurpedic_slug_keep(prefix, slug):
            continue
        canon = _normalize_product_url(raw)
        if not canon:
            continue
        url = canon if canon.endswith("/") else canon + "/"
        if url in seen:
            continue
        model = _model_from_tempurpedic_url(url)
        if not model:
            continue
        seen.add(url)
        out.append({"model": model, "url": url})
    out.sort(key=lambda x: x["model"].lower())
    return out


def _discover_saatva_targets() -> list[dict[str, str]]:
    index_url = (os.getenv("SAATVA_SITEMAP_URL") or "").strip() or "https://www.saatva.com/sitemap.xml"
    xml = _http_get(index_url)
    locs = _extract_sitemap_locs(xml)
    secondary = [u for u in locs if u.lower().endswith(".xml") and u != index_url][:40]
    all_urls = list(locs)
    for sm in secondary:
        try:
            all_urls.extend(_extract_sitemap_locs(_http_get(sm)))
        except (urllib.error.URLError, OSError, TimeoutError):
            continue
    deny_seg = frozenset(
        {
            "mattresses",
            "shop",
            "compare",
            "foundations",
            "bedding",
            "furniture",
            "adjustable-bases",
            "viewing-rooms",
        }
    )
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    pat = re.compile(r"https?://(?:www\.)?saatva\.com/mattresses/([a-z0-9-]+)/?", re.I)
    for raw in all_urls:
        u = raw.strip()
        m = pat.match(u)
        if not m:
            continue
        seg = m.group(1).lower()
        if seg in deny_seg or not seg:
            continue
        canon = _normalize_product_url(u)
        if not canon or canon in seen:
            continue
        model = _model_from_saatva_mattress_url(canon + "/")
        if not model:
            continue
        seen.add(canon)
        out.append({"model": model, "url": canon + "/" if not canon.endswith("/") else canon})
    out.sort(key=lambda x: x["model"].lower())
    return out


def _discover_woocommerce_products(origin: str) -> list[dict[str, str]]:
    origin = origin.rstrip("/")
    for index_path in ("/wp-sitemap.xml", "/sitemap_index.xml", "/sitemap.xml"):
        try:
            xml = _http_get(origin + index_path)
        except (urllib.error.URLError, OSError, TimeoutError):
            continue
        locs = _extract_sitemap_locs(xml)
        secondary = [u for u in locs if u.lower().endswith(".xml")][:35]
        all_urls = list(locs)
        for sm in secondary:
            try:
                all_urls.extend(_extract_sitemap_locs(_http_get(sm)))
            except (urllib.error.URLError, OSError, TimeoutError):
                continue
        out: list[dict[str, str]] = []
        seen: set[str] = set()
        for raw in all_urls:
            lu = raw.lower()
            if "/product/" not in lu:
                continue
            if any(x in lu for x in ("/product-category/", "/product-tag/", "attachment")):
                continue
            if not _url_looks_sleep_related(raw):
                continue
            canon = _normalize_product_url(raw)
            if not canon or canon in seen:
                continue
            model = _model_from_sb_product_url(canon + "/")
            if not model:
                continue
            seen.add(canon)
            url = canon if canon.endswith("/") else canon + "/"
            out.append({"model": model, "url": url})
        if out:
            out.sort(key=lambda x: x["model"].lower())
            return out
    return []


def _sitemap_loc_is_xml(url: str) -> bool:
    """Shopify 子 sitemap 常为 ``.../sitemap_products_1.xml?from=...&to=...``，不能仅用 endswith('.xml')。"""
    base = (url or "").strip().lower().split("?")[0].rstrip("/")
    return base.endswith(".xml")


def _discover_shopify_products(origin: str) -> list[dict[str, str]]:
    origin = origin.rstrip("/")
    index_url = origin + "/sitemap.xml"
    xml = _http_get(index_url)
    locs = _extract_sitemap_locs(xml)
    secondary = [u for u in locs if _sitemap_loc_is_xml(u) and u != index_url][:35]
    all_urls = list(locs)
    for sm in secondary:
        try:
            all_urls.extend(_extract_sitemap_locs(_http_get(sm)))
        except (urllib.error.URLError, OSError, TimeoutError):
            continue
    pat = re.compile(r"https?://[^/]+/products/[a-z0-9-]+", re.I)
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for raw in all_urls:
        if "/products/" not in raw.lower():
            continue
        if not _url_looks_sleep_related(raw):
            continue
        m = pat.search(raw)
        if not m:
            continue
        canon = _normalize_product_url(m.group(0))
        if not canon or canon in seen:
            continue
        model = _model_from_fluffco_product_url(canon)
        if not model:
            continue
        seen.add(canon)
        out.append({"model": model, "url": canon})
    out.sort(key=lambda x: x["model"].lower())
    return out


def _load_extra_brand_profiles() -> list[dict[str, Any]]:
    path = Path(_EXTRA_PROFILES_PATH)
    if not path.is_file():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return []
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        n = str(item.get("name") or "").strip()
        kind = str(item.get("discover_kind") or "").strip()
        if not n or not kind:
            continue
        out.append(dict(item))
    return out


def _merge_brand_profiles() -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = [dict(p) for p in BUILTIN_BRAND_SITE_PROFILES]
    by_name = {str(p["name"]): i for i, p in enumerate(merged)}
    for p in _load_extra_brand_profiles():
        n = str(p.get("name", "")).strip()
        if not n:
            continue
        row = dict(p)
        row["name"] = n
        if n in by_name:
            merged[by_name[n]] = row
        else:
            merged.append(row)
            by_name[n] = len(merged) - 1
    return merged


BRAND_SITE_PROFILES: list[dict[str, Any]] = _merge_brand_profiles()
CANONICAL_BRANDS: tuple[str, ...] = tuple(p["name"] for p in BRAND_SITE_PROFILES)


def _discover_for_profile(profile: dict[str, Any]) -> list[dict[str, str]]:
    kind = profile.get("discover_kind")
    if kind == "saatva_mattresses":
        return _discover_saatva_targets()
    if kind == "woocommerce_products":
        origin = (
            (profile.get("origin") or "").strip()
            or (os.getenv("SB_SHOP_ORIGIN") or "").strip()
            or "https://sleepandbeyond.com"
        ).rstrip("/")
        return _discover_woocommerce_products(origin)
    if kind == "shopify_products":
        origin = (
            (profile.get("origin") or "").strip()
            or (os.getenv("FLUFFCO_SHOP_ORIGIN") or "").strip()
            or "https://home.fluff.co"
        ).rstrip("/")
        return _discover_shopify_products(origin)
    if kind == "tempurpedic_sitemap":
        origin = (
            (profile.get("origin") or "").strip()
            or (os.getenv("TEMPURPEDIC_SHOP_ORIGIN") or "").strip()
            or "https://www.tempurpedic.com"
        ).rstrip("/")
        return _discover_tempurpedic_products(origin)
    raise ValueError(
        f"未知 discover_kind={kind!r}（品牌 {profile.get('name')}）。"
        "可选: saatva_mattresses | woocommerce_products | shopify_products | tempurpedic_sitemap"
    )


def _load_targets_cache() -> dict[str, Any] | None:
    path = Path(_TARGETS_CACHE_PATH)
    if not path.is_file():
        return None
    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def _save_targets_cache(payload: dict[str, Any]) -> None:
    path = Path(_TARGETS_CACHE_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    tmp.replace(path)


def discover_brand_targets_from_sites(
    *,
    force_refresh: bool = False,
    discover_only: frozenset[str] | None = None,
) -> dict[str, list[dict[str, str]]]:
    """
    从各品牌 profile 的 sitemap 策略拉取 PDP URL；无静态回退。
    与库内 slug 对齐的 model 名仍依赖少量 slug→display 映射（见 _SB_PRODUCT_SLUG_TO_MODEL 等）。

    discover_only:
        若为非空集合，仅对这些品牌执行网络发现；其余品牌沿用已有缓存中的 targets（避免
        ``--brand X`` 时仍扫全站且误报其他品牌「未发现 URL」）。与全量品牌集合相同时视为未指定。
    """
    expected_names = {p["name"] for p in BRAND_SITE_PROFILES}
    if discover_only is not None:
        discover_only = frozenset(n for n in discover_only if n in expected_names)
        if not discover_only or discover_only == expected_names:
            discover_only = None

    if not force_refresh:
        cached = _load_targets_cache()
        if isinstance(cached, dict) and cached.get("targets"):
            try:
                ts = float(cached.get("fetched_at_unix", 0))
            except (TypeError, ValueError):
                ts = 0.0
            cached_keys = set(cached["targets"].keys())
            if (
                ts
                and (datetime.now(UTC).timestamp() - ts) < _targets_cache_ttl_sec()
                and cached_keys == expected_names
            ):
                return {
                    k: list(v)
                    for k, v in cached["targets"].items()
                    if isinstance(v, list) and k in expected_names
                }

    prev_cached = _load_targets_cache()
    prev_targets: dict[str, list[dict[str, str]]] = {}
    prev_sources: dict[str, str] = {}
    if isinstance(prev_cached, dict):
        raw_t = prev_cached.get("targets")
        if isinstance(raw_t, dict):
            for k, v in raw_t.items():
                if k in expected_names and isinstance(v, list):
                    prev_targets[k] = [
                        dict(x) for x in v if isinstance(x, dict) and x.get("url")
                    ]
        raw_s = prev_cached.get("sources")
        if isinstance(raw_s, dict):
            for k, v in raw_s.items():
                if k in expected_names and isinstance(v, str):
                    prev_sources[k] = v

    out: dict[str, list[dict[str, str]]] = {name: [] for name in expected_names}
    errors: list[str] = []
    sources: dict[str, str] = {}
    warn_scope = discover_only if discover_only is not None else frozenset(expected_names)

    for profile in BRAND_SITE_PROFILES:
        name = profile["name"]
        if discover_only is not None and name not in discover_only:
            out[name] = list(prev_targets.get(name, []))
            sources[name] = prev_sources.get(name, "（本趟未重拉 sitemap，沿用缓存）")
            continue
        try:
            out[name] = _discover_for_profile(profile)
            kind = str(profile.get("discover_kind") or "")
            if kind == "saatva_mattresses":
                sources[name] = os.getenv("SAATVA_SITEMAP_URL") or "https://www.saatva.com/sitemap.xml"
            elif kind == "woocommerce_products":
                o = (
                    (profile.get("origin") or "").strip()
                    or (os.getenv("SB_SHOP_ORIGIN") or "").strip()
                    or "https://sleepandbeyond.com"
                ).rstrip("/")
                sources[name] = f"{o}/wp-sitemap.xml (或 sitemap_index)"
            elif kind == "shopify_products":
                o = (
                    (profile.get("origin") or "").strip()
                    or (os.getenv("FLUFFCO_SHOP_ORIGIN") or "").strip()
                    or "https://home.fluff.co"
                ).rstrip("/")
                sources[name] = f"{o}/sitemap.xml"
            elif kind == "tempurpedic_sitemap":
                o = (
                    (profile.get("origin") or "").strip()
                    or (os.getenv("TEMPURPEDIC_SHOP_ORIGIN") or "").strip()
                    or "https://www.tempurpedic.com"
                ).rstrip("/")
                sources[name] = (
                    (os.getenv("TEMPURPEDIC_SITEMAP_URL") or "").strip() or f"{o}/sitemap.xml"
                )
            else:
                sources[name] = kind
        except Exception as e:
            errors.append(f"{name}: {e}")
            out[name] = []
        if not out[name] and name in warn_scope:
            print(f"⚠️ 品牌「{name}」sitemap 未发现任务 URL（检查网络、站点结构或 sleep 关键词过滤）")

    payload = {
        "fetched_at": datetime.now(UTC).isoformat(),
        "fetched_at_unix": datetime.now(UTC).timestamp(),
        "sources": sources,
        "targets": out,
        "errors": errors,
    }
    try:
        _save_targets_cache(payload)
    except OSError as oe:
        print(f"⚠️ 无法写入 targets 缓存 {_TARGETS_CACHE_PATH}: {oe}")
    if errors:
        print("⚠️ 部分品牌 sitemap 抓取异常（该品牌列表可能为空）:", "; ".join(errors))
    return out


def get_brand_registry(
    *,
    force_refresh: bool = False,
    discover_only: frozenset[str] | None = None,
) -> list[dict[str, Any]]:
    """运行期任务矩阵：顺序与 BRAND_SITE_PROFILES 一致。"""
    targets_map = discover_brand_targets_from_sites(
        force_refresh=force_refresh,
        discover_only=discover_only,
    )
    return [
        {
            "name": p["name"],
            "targets": targets_map.get(p["name"], []),
            "cooldown_sec": int(p.get("cooldown_sec", 25)),
        }
        for p in BRAND_SITE_PROFILES
    ]


BRAND_ALIASES: dict[str, str] = {
    "saatva": "Saatva",
    "sleep-and-beyond": "Sleep & Beyond",
    "sleepandbeyond": "Sleep & Beyond",
    "sleep_beyond": "Sleep & Beyond",
    "sb": "Sleep & Beyond",
    "fluffco": "FluffCo",
    "fluff": "FluffCo",
}


def resolve_brand_names(tokens: list[str] | None) -> list[str]:
    """将 CLI 输入解析为 canonical 品牌名。"""
    if not tokens:
        return list(CANONICAL_BRANDS)
    out: list[str] = []
    canonical = set(CANONICAL_BRANDS)
    for raw in tokens:
        t = raw.strip()
        if not t:
            continue
        key = t.lower().replace(" ", "-").replace("&", "and")
        key = re.sub(r"[^a-z0-9-]+", "-", key).strip("-")
        name = BRAND_ALIASES.get(key)
        if not name and t in canonical:
            name = t
        if not name:
            # 宽松匹配：忽略大小写
            low = t.lower()
            for c in canonical:
                if c.lower() == low:
                    name = c
                    break
        if not name:
            raise ValueError(f"未知品牌: {raw!r}。可选: {sorted(canonical)}")
        if name not in canonical:
            raise ValueError(
                f"未知品牌: {raw!r}（未在 BRAND_SITE_PROFILES 注册）。可选: {sorted(canonical)}"
            )
        if name not in out:
            out.append(name)
    return out


class IntelBatchScanner:
    """
    全量法医审计（execute_and_sync）与缺失字段时的轻量补完（fetch_site_data）。
    sync_mode=site-only：仅执行官网抓取写库，不调 LLM（适合高频 cron）。
    """

    def __init__(
        self,
        force_update: bool = False,
        *,
        sync_mode: str = "auto",
        limit_per_brand: int | None = None,
        no_cooldown: bool = False,
        refresh_targets: bool = False,
    ) -> None:
        if sync_mode not in ("auto", "site-only"):
            raise ValueError("sync_mode 必须是 auto 或 site-only")
        self.force_update = force_update
        self.sync_mode = sync_mode
        self.limit_per_brand = limit_per_brand
        self.no_cooldown = no_cooldown
        self.refresh_targets = refresh_targets
        url, key = _resolve_supabase_credentials()
        if not url or not key:
            print(f"❌ 环境探测失败: 已查找 dotenv 路径 {_ENV.absolute()}（CI 上通常不存在）")
            raise ValueError(
                "SUPABASE_URL 或 SUPABASE_KEY 未设置。"
                "本地请在仓库根目录或 src 下放 .env.local；"
                "GitHub Actions 请在仓库 Settings → Secrets and variables → Actions "
                "中添加 SUPABASE_URL 与 SUPABASE_KEY（建议 service_role key）。"
                "亦可使用 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。"
            )
        self.supabase: Client = create_client(url, key)

    async def _run_site_intel_patch(
        self,
        engine: ForensicAuditEngine,
        existing_record: dict[str, Any],
        brand: str,
        model: str,
        url: str,
        slug: str,
    ) -> None:
        """仅 Playwright 抓取 + 写 audit_products / product_offers（与法医 LLM 无关）。"""
        fe = _forensic_engine()
        print(f"\n[官网情报] 正在抓取: {brand} {model}")
        try:
            new_site_data = await engine.fetch_site_data(url)

            update_payload: dict[str, Any] = {}
            if new_site_data.get("price", 0) > 0:
                update_payload["price"] = new_site_data["price"]
            if new_site_data.get("original_image"):
                update_payload["original_image_url"] = new_site_data["original_image"]
                hosted = await engine.transfer_to_supabase_storage(
                    new_site_data["original_image"]
                )
                if hosted:
                    update_payload["image_url"] = hosted
                elif existing_record.get("image_url"):
                    update_payload["image_url"] = existing_record["image_url"]
                    print(
                        "⚠️ 图片上传 Storage 失败，已保留库内旧 image_url；"
                        "请查看上方「图片下载/转储」报错（常为网络或非图片 Content-Type）。"
                    )
                else:
                    print(
                        "⚠️ 图片上传 Storage 失败且库内无旧 image_url，"
                        "前端可能仍无图；请检查上方转储报错。"
                    )

            if new_site_data.get("msrp"):
                update_payload["msrp"] = new_site_data["msrp"]

            av_label = new_site_data.get("audit_variant")
            if isinstance(av_label, str) and av_label.strip():
                try:
                    ar = (
                        self.supabase.table("audit_products")
                        .select("audit_data")
                        .eq("slug", slug)
                        .limit(1)
                        .execute()
                    )
                    raw_ad = (ar.data or [{}])[0].get("audit_data") if ar.data else {}
                    if isinstance(raw_ad, str):
                        try:
                            ad_obj: dict[str, Any] = json.loads(raw_ad)
                        except json.JSONDecodeError:
                            ad_obj = {}
                    elif isinstance(raw_ad, dict):
                        ad_obj = dict(raw_ad)
                    else:
                        ad_obj = {}
                    ad_obj["audit_variant"] = av_label.strip()[:200]
                    update_payload["audit_data"] = ad_obj
                except Exception as me:
                    print(f"⚠️ 合并 audit_variant 至 audit_data 失败: {me}")

            if update_payload:
                now_iso = datetime.now(UTC).isoformat()
                update_payload["updated_at"] = now_iso
                update_payload["last_audited_at"] = now_iso
                self.supabase.table("audit_products").update(update_payload).eq(
                    "slug", slug
                ).execute()
                print(f"✅ {model} 市场数据已修正。")
            else:
                print(f"⚠️ {model} 未获取到可写入字段。")

            if new_site_data.get("price", 0) > 0:
                try:
                    po: dict[str, Any] = {
                        "product_id": existing_record["id"],
                        "site_name": brand,
                        "price": new_site_data["price"],
                        "offer_url": existing_record.get("official_link") or url,
                        "is_primary": True,
                        "status": "active",
                        "last_checked_at": datetime.now(UTC).isoformat(),
                    }
                    if new_site_data.get("old_price"):
                        po["old_price"] = new_site_data["old_price"]
                    if new_site_data.get("availability"):
                        po["availability"] = str(
                            new_site_data["availability"]
                        ).strip()[:160]
                    cc_raw = new_site_data.get("coupon_code")
                    cc_n = (
                        fe.normalize_coupon_token(cc_raw)
                        if isinstance(cc_raw, str)
                        else None
                    )
                    if cc_n and fe.coupon_token_is_plausible(cc_n):
                        cc_n = await fe.finalize_coupon_for_store(url, cc_n)
                    else:
                        cc_n = None
                    if cc_n:
                        po["coupon_code"] = cc_n[:80]
                    else:
                        po["coupon_code"] = None
                    ptxt = new_site_data.get("promo_text_snippet")
                    if isinstance(ptxt, str) and ptxt.strip():
                        po["promo_text"] = ptxt.strip()[:500]

                    msrp_val = update_payload.get("msrp")
                    if msrp_val is None:
                        msrp_val = existing_record.get("msrp")
                    if msrp_val is None:
                        msrp_val = new_site_data.get("msrp") or new_site_data.get(
                            "old_price"
                        )
                    try:
                        msrp_f = float(msrp_val) if msrp_val is not None else None
                    except (TypeError, ValueError):
                        msrp_f = None
                    pct_raw = new_site_data.get("promo_discount_percent")
                    try:
                        pct_f = float(pct_raw) if pct_raw is not None else None
                    except (TypeError, ValueError):
                        pct_f = None
                    if pct_f is not None and 0 < pct_f < 95:
                        po["promo_discount_percent"] = round(pct_f, 4)
                    else:
                        po["promo_discount_percent"] = None
                    ts = fe.ForensicAuditEngine.compute_total_savings(
                        msrp_f,
                        float(new_site_data["price"]),
                        pct_f,
                    )
                    if ts is not None:
                        po["total_savings"] = round(ts, 2)

                    self.supabase.table("product_offers").upsert(
                        po,
                        on_conflict="product_id, site_name",
                    ).execute()
                    print(f"✅ {model} product_offers 已同步。")
                except Exception as oe:
                    print(f"⚠️ product_offers 同步失败: {oe}")
        except Exception as e:
            print(f"❌ {model} 官网情报失败: {e}")

    async def execute_task(self, brand: str, task: dict[str, str]) -> None:
        model = task["model"]
        url = task["url"]
        slug = get_clean_slug(brand, model)

        existing_record = None
        try:
            res = (
                self.supabase.table("audit_products")
                .select(
                    "id, last_audited_at, price, msrp, original_image_url, image_url, audit_note, official_link"
                )
                .eq("slug", slug)
                .execute()
            )
            if res.data:
                existing_record = res.data[0]
        except Exception as e:
            print(f"⚠️ 数据库读取受阻: {e}")

        if self.sync_mode == "site-only":
            if not existing_record:
                print(
                    f"⏭️ 跳过（库中无 slug）: {model} — 请先跑一次非 --site-only 以建立记录"
                )
                return
            fe = _forensic_engine()
            engine = fe.ForensicAuditEngine(brand, model)
            await self._run_site_intel_patch(
                engine, existing_record, brand, model, url, slug
            )
            return

        needs_full_audit = False
        needs_data_patch = False

        if not existing_record or self.force_update:
            needs_full_audit = True
        elif not existing_record.get("audit_note"):
            print(f"🔍 发现残缺审计记录: {model}，准备重新触发全量审计...")
            needs_full_audit = True
        elif (
            not existing_record.get("price")
            or existing_record.get("price") == 0
            or not existing_record.get("original_image_url")
            or not existing_record.get("image_url")
            or _audit_msrp_unset(existing_record)
        ):
            print(f"🩹 发现缺失市场数据或 MSRP: {model}，准备执行数据补完...")
            needs_data_patch = True
        else:
            print(f"⏩ 跳过: {model} 已有完整存证。")
            return

        fe = _forensic_engine()
        engine = fe.ForensicAuditEngine(brand, model)

        if needs_full_audit:
            print(f"\n[法医扫描-全量] 正在分析: {brand} {model}")
            try:
                await engine.execute_and_sync(url)
                print(f"✅ {model} 全量同步成功。")
            except Exception as e:
                print(f"❌ {model} 全量任务失败: {e}")

        elif needs_data_patch:
            await self._run_site_intel_patch(
                engine, existing_record, brand, model, url, slug
            )

    async def run_brands(self, brand_names: list[str]) -> None:
        registry = get_brand_registry(
            force_refresh=self.refresh_targets,
            discover_only=frozenset(brand_names),
        )
        for cfg in registry:
            name = cfg["name"]
            if name not in brand_names:
                continue
            targets: list[dict[str, str]] = list(cfg["targets"])
            if self.limit_per_brand is not None and self.limit_per_brand > 0:
                targets = targets[: self.limit_per_brand]
            cooldown = 0 if self.no_cooldown else int(cfg.get("cooldown_sec", 25))
            mode_note = " [官网-only]" if self.sync_mode == "site-only" else ""
            print(
                f"\n{'=' * 60}\n🚀 品牌: {name}{mode_note} | 本趟任务数: {len(targets)}\n{'=' * 60}"
            )
            for i, task in enumerate(targets):
                print(f"\n进度 [{name}]: [{i + 1}/{len(targets)}]")
                await self.execute_task(name, task)
                if cooldown > 0 and i < len(targets) - 1:
                    print(f"⏳ 冷却 {cooldown}s …")
                    await asyncio.sleep(cooldown)

        print("\n🏁 所选品牌任务已全部结束。")


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Sleep Choice 情报批量同步（法医审计 / 官网情报补完）"
    )
    p.add_argument(
        "--brand",
        "-b",
        action="append",
        metavar="NAME",
        help="只跑指定品牌，可重复。例: -b Saatva -b FluffCo。省略则跑全部。",
    )
    p.add_argument(
        "--force",
        "-f",
        action="store_true",
        help="强制全量重审（忽略库内已有完整记录）。与 --site-only 互斥语义：后者下会忽略此项。",
    )
    p.add_argument(
        "--full-sync",
        action="store_true",
        help="与 --force 相同，便于定时任务语义化。",
    )
    p.add_argument(
        "--site-only",
        action="store_true",
        help="仅抓取官网价格/MSRP/图源/库存并写库，不调用 LLM；库中无 slug 的 SKU 会跳过。",
    )
    p.add_argument(
        "--limit",
        type=int,
        metavar="N",
        default=None,
        help="每个品牌最多处理列表中的前 N 条（试跑、配额或限流）。",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="只打印将运行的任务清单，不连接 Supabase、不发起抓取。",
    )
    p.add_argument(
        "--no-cooldown",
        action="store_true",
        help="去掉品牌任务间隔（本地调试或 CI 加速）。",
    )
    p.add_argument(
        "--refresh-targets",
        action="store_true",
        help="忽略目标 URL 缓存，从各站 sitemap 重新拉取 PDP 列表后再执行（写入 batch_scanner_targets.cache.json）。",
    )
    return p


def _print_dry_run_plan(
    brand_names: list[str],
    limit_per_brand: int | None,
    site_only: bool,
    force: bool,
    *,
    refresh_targets: bool = False,
) -> None:
    print("📋 [dry-run] 计划任务（未执行）")
    print(f"    模式: {'官网-only' if site_only else ('强制全量' if force else '增量 auto')}")
    registry = get_brand_registry(
        force_refresh=refresh_targets,
        discover_only=frozenset(brand_names),
    )
    for cfg in registry:
        name = cfg["name"]
        if name not in brand_names:
            continue
        tg: list[dict[str, str]] = list(cfg["targets"])
        if limit_per_brand is not None and limit_per_brand > 0:
            tg = tg[:limit_per_brand]
        print(f"\n  ▶ {name} ({len(tg)} 条)")
        for t in tg:
            print(f"      - {t['model']}")
            print(f"        {t['url']}")


def cli_main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    force = bool(args.force or args.full_sync)
    site_only = bool(args.site_only)
    try:
        names = resolve_brand_names(args.brand)
    except ValueError as e:
        print(f"❌ {e}")
        return 2

    if args.dry_run:
        _print_dry_run_plan(
            names, args.limit, site_only, force, refresh_targets=bool(args.refresh_targets)
        )
        return 0

    if site_only and force:
        print("⚠️ --site-only 已启用：将忽略 --force / --full-sync（不会触发 LLM 全量审计）")
        force = False

    limit = args.limit if args.limit is not None and args.limit > 0 else None

    mode_desc = (
        "官网情报-only（无 LLM）"
        if site_only
        else ("强制全量" if force else "增量（缺字段才更新）")
    )
    lim_note = f" | 每品牌上限: {limit}" if limit else ""
    print(f"📋 模式: {mode_desc}{lim_note} | 品牌: {', '.join(names)}")

    try:
        scanner = IntelBatchScanner(
            force_update=force,
            sync_mode="site-only" if site_only else "auto",
            limit_per_brand=limit,
            no_cooldown=bool(args.no_cooldown),
            refresh_targets=bool(args.refresh_targets),
        )
    except ValueError as e:
        print(e)
        return 1
    asyncio.run(scanner.run_brands(names))
    return 0


# 旧脚本仍可：BatchScanner / SBBatchScanner / FluffCoForensicScanner
BatchScanner = IntelBatchScanner


class SBBatchScanner(IntelBatchScanner):
    """兼容 `sb_batch_scanner.py` 时代的类名。"""

    def __init__(
        self,
        brand: str = "Sleep & Beyond",
        force_update: bool = False,
        **kwargs: Any,
    ) -> None:
        super().__init__(force_update=force_update, **kwargs)
        self._legacy_brand = brand

    async def main_loop(self) -> None:
        await self.run_brands([self._legacy_brand])


class FluffCoForensicScanner(IntelBatchScanner):
    """兼容 `fluffco_batch_scanner.py` 时代的类名。"""

    def __init__(self, force_update: bool = False, **kwargs: Any) -> None:
        super().__init__(force_update=force_update, **kwargs)

    async def start(self) -> None:
        await self.run_brands(["FluffCo"])


if __name__ == "__main__":
    raise SystemExit(cli_main(sys.argv[1:]))
