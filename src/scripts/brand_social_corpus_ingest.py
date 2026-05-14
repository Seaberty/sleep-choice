# -*- coding: utf-8 -*-
"""
按品牌名采集 Reddit /（可选）Amazon & Trustpilot 相关公开链接摘要，写入 Supabase。

不经过 Serper：
  - Reddit：Reddit 公开 search.json（无需 Reddit API OAuth；需合理 User-Agent，与
    reddit_rss_monitor 相同可设 REDDIT_RSS_USER_AGENT，否则易 403）。
  - Amazon / Trustpilot：默认关闭；传入 --brave 且配置 BRAVE_SEARCH_API_KEY 时才用
    Brave Web Search，按落地域名过滤。平时只跑 Reddit 即可。

何时跑「全站情报」：
  - 自建情报中心：建议 **每周或每两周** 跑一次 ``--from-registry``（Reddit 限流 + 数据变化慢）；
    大改 registry 后可 **手动再跑** 一次全量。
  - 与 ``batch_scanner.py`` 分工：batch 负责 **官网 PDP 审计**；本脚本负责 **社媒片段沉淀**。
    可在 CI 里加独立 workflow，在 daily batch 之后或错开时段执行。

输入：
  --brand Saatva
  或 --from-registry（从 audit_products 按 brand_slug 去重，每品牌采一轮，product_slug 留空以免 URL 去重键冲突）

用法：
  cd src/scripts
  python brand_social_corpus_ingest.py --brand Saatva
  python brand_social_corpus_ingest.py --brand Saatva --dry-run
  python brand_social_corpus_ingest.py --brand Saatva --brave   # 显式打开 Brave
  python brand_social_corpus_ingest.py --from-registry
  python brand_social_corpus_ingest.py --from-registry --registry-max-brands 5 --dry-run

环境：
  SUPABASE_URL, SUPABASE_KEY（写入请用 service_role）
  可选：加 --brave 且设置 BRAVE_SEARCH_API_KEY 才采 Amazon/Trustpilot（见 brave.com/search/api）
  可选 REDDIT_RSS_USER_AGENT — 403 时改为桌面浏览器 UA

数据库：
  - 与 public.brand_intelligence 是两张表：intelligence = 每产品每平台一条聚合；
    social_corpus = 每条 URL 一条片段（可多行）。
  - 在 Supabase SQL Editor 执行仓库内 sql 文件（建表 + RLS + 刷新 PostgREST）：
    src/scripts/sql/brand_social_corpus.sql
  - 若仍报 PGRST205：Dashboard → Settings → API → Reload schema，或等约 1 分钟。
"""
from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus, urlparse, urlunparse

import httpx
from dotenv import load_dotenv
from supabase import create_client

_ROOT = Path(__file__).resolve().parents[2]
_ENV = _ROOT / ".env.local"
if not _ENV.is_file():
    _ENV = Path(__file__).resolve().parents[1] / ".env.local"
load_dotenv(dotenv_path=_ENV)

BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search"

# Reddit：站内搜索模板（restrict_sr=1 仅在 r/Mattress）。
REDDIT_SUBQUERY_TEMPLATES: tuple[str, ...] = (
    "{brand} mattress",
    "{brand} mattress review",
    "{brand} hybrid",
    "{brand} topper",
    "{brand} complaints",
    "{brand} vs",
    "{brand} firmness",
)

# Brave：自然语言；结果按 URL 归类 Amazon / Trustpilot（无 Brave 密钥则跳过）。
BRAVE_QUERY_TEMPLATES: tuple[str, ...] = (
    "{brand} mattress reviews amazon",
    "{brand} amazon mattress",
    "{brand} trustpilot reviews",
    "{brand} company trustpilot",
)


def slugify(text: str) -> str:
    text = text.lower().replace("&", "and")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def norm_link(url: str) -> str:
    if not url or not url.startswith(("http://", "https://")):
        return (url or "").strip()
    try:
        p = urlparse(url)
        return urlunparse((p.scheme, p.netloc.lower(), p.path or "", "", "", ""))
    except Exception:
        return url.strip()


def classify_platform(link: str) -> str:
    u = (link or "").lower()
    if "reddit.com" in u:
        return "Reddit"
    if "amazon." in u or "amzn.to" in u or "amzn." in u:
        return "Amazon"
    if "trustpilot.com" in u:
        return "Trustpilot"
    return "Other"


def url_hash(brand_slug: str, norm_url: str) -> str:
    raw = f"{brand_slug}|{norm_url}".encode("utf-8", errors="ignore")
    return hashlib.sha256(raw).hexdigest()


def reddit_json_headers() -> dict[str, str]:
    custom = (os.getenv("REDDIT_RSS_USER_AGENT") or "").strip()
    ua = custom or (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 sleep-choice-brand-corpus/1.0"
    )
    return {
        "User-Agent": ua,
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.reddit.com/",
    }


def _reddit_listing_children(data: dict[str, Any]) -> list[dict[str, Any]]:
    if not isinstance(data, dict):
        return []
    d = data.get("data") or {}
    kids = d.get("children") or []
    out: list[dict[str, Any]] = []
    for ch in kids:
        if isinstance(ch, dict) and ch.get("kind") == "t3":
            inner = ch.get("data")
            if isinstance(inner, dict):
                out.append(inner)
    return out


def _reddit_after_token(data: dict[str, Any]) -> str | None:
    if not isinstance(data, dict):
        return None
    d = data.get("data") or {}
    a = d.get("after")
    return str(a) if a else None


def fetch_reddit_search_page(
    client: httpx.Client,
    brand: str,
    q: str,
    limit: int,
    after: str | None,
    restrict_sr: bool,
) -> tuple[list[dict[str, Any]], str | None]:
    """
    Returns (normalized_hit_dicts, next_after_token).
    Each hit: source_platform, title, snippet, source_url, provenance_query, page_hint
    """
    base = "https://www.reddit.com/r/Mattress/search.json" if restrict_sr else "https://www.reddit.com/search.json"
    params: list[tuple[str, str]] = [
        ("q", q),
        ("limit", str(max(1, min(int(limit), 100)))),
        ("raw_json", "1"),
        ("sort", "relevance"),
        ("t", "all"),
    ]
    if restrict_sr:
        params.append(("restrict_sr", "1"))
    if after:
        params.append(("after", after))
    qs = "&".join(f"{k}={quote_plus(v, safe='')}" for k, v in params)
    url = f"{base}?{qs}"
    r = client.get(url, headers=reddit_json_headers(), timeout=45.0)
    if r.status_code != 200:
        print(f"  ❌ Reddit HTTP {r.status_code} | {url[:120]}... | {r.text[:200]}")
        return [], None
    try:
        payload = r.json()
    except Exception as e:
        print(f"  ❌ Reddit JSON parse: {e}")
        return [], None
    children = _reddit_listing_children(payload)
    next_after = _reddit_after_token(payload)
    hits: list[dict[str, Any]] = []
    for post in children:
        title = (post.get("title") or "").strip()
        selftext = (post.get("selftext") or "").strip()
        permalink = (post.get("permalink") or "").strip()
        if not permalink.startswith("/"):
            permalink = "/" + permalink if permalink else ""
        thread_url = f"https://www.reddit.com{permalink}" if permalink else ""
        if not thread_url:
            continue
        snippet = (title + ("\n\n" + selftext if selftext else "")).strip()[:8000]
        if not snippet:
            continue
        scope = "r/Mattress" if restrict_sr else "global"
        hits.append(
            {
                "source_platform": "Reddit",
                "title": title[:2000],
                "snippet": snippet,
                "source_url": thread_url,
                "serp_query": f"reddit:{scope}:{q}",
            }
        )
    return hits, next_after


def collect_reddit(
    client: httpx.Client,
    brand: str,
    brand_slug: str,
    templates: tuple[str, ...],
    max_queries: int,
    limit: int,
    max_pages_per_query: int,
    sleep_s: float,
) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    used = templates[: max(1, max_queries)]
    for tpl in used:
        q = tpl.format(brand=brand.strip())
        for restrict in (True, False):
            after: str | None = None
            for page in range(1, max_pages_per_query + 1):
                page_hits, next_after = fetch_reddit_search_page(
                    client, brand, q, limit, after, restrict_sr=restrict
                )
                for h in page_hits:
                    nk = norm_link(h["source_url"])
                    fp = url_hash(brand_slug, nk)
                    if fp in seen:
                        continue
                    seen.add(fp)
                    h["url_hash"] = fp
                    h["serp_page"] = page
                    out.append(h)
                time.sleep(sleep_s)
                after = next_after
                if not after or not page_hits:
                    break
        time.sleep(sleep_s)
    return out


def fetch_brave_page(
    client: httpx.Client,
    api_key: str,
    q: str,
    count: int,
    offset: int,
) -> list[dict[str, str]]:
    headers = {
        "Accept": "application/json",
        "X-Subscription-Token": api_key,
    }
    params = {
        "q": q,
        "count": str(max(1, min(int(count), 20))),
        "offset": str(max(0, int(offset))),
    }
    r = client.get(BRAVE_SEARCH_URL, headers=headers, params=params, timeout=45.0)
    if r.status_code != 200:
        print(f"  ❌ Brave HTTP {r.status_code} | q={q[:80]!r} | {r.text[:240]}")
        return []
    try:
        data = r.json()
    except Exception as e:
        print(f"  ❌ Brave JSON: {e}")
        return []
    web = data.get("web") or {}
    results = web.get("results") or data.get("results") or []
    rows: list[dict[str, str]] = []
    for it in results:
        if not isinstance(it, dict):
            continue
        link = (it.get("url") or "").strip()
        title = (it.get("title") or "").strip()
        desc = (it.get("description") or it.get("snippet") or "").strip()
        if not link:
            continue
        rows.append({"link": link, "title": title, "snippet": desc})
    return rows


def collect_brave_amazon_trustpilot(
    client: httpx.Client,
    api_key: str,
    brand: str,
    brand_slug: str,
    templates: tuple[str, ...],
    max_queries: int,
    count: int,
    max_offsets: int,
    sleep_s: float,
) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    used = templates[: max(1, max_queries)]
    for tpl in used:
        q = tpl.format(brand=brand.strip())
        for off_i in range(max_offsets):
            offset = off_i * count
            items = fetch_brave_page(client, api_key, q, count, offset)
            if not items:
                break
            for it in items:
                plat = classify_platform(it["link"])
                if plat not in ("Amazon", "Trustpilot"):
                    continue
                nk = norm_link(it["link"])
                fp = url_hash(brand_slug, nk)
                if fp in seen:
                    continue
                seen.add(fp)
                snippet = (it["title"] + ("\n\n" + it["snippet"] if it["snippet"] else "")).strip()[:8000]
                if not snippet:
                    snippet = it["snippet"] or it["title"]
                out.append(
                    {
                        "source_platform": plat,
                        "title": it["title"][:2000],
                        "snippet": snippet[:8000],
                        "source_url": it["link"][:4000],
                        "url_hash": fp,
                        "serp_query": f"brave:{q}",
                        "serp_page": off_i + 1,
                    }
                )
            time.sleep(sleep_s)
        time.sleep(sleep_s)
    return out


def upsert_batches(
    supabase,
    rows: list[dict[str, Any]],
    batch_size: int,
) -> int:
    n_ok = 0
    for i in range(0, len(rows), batch_size):
        chunk = rows[i : i + batch_size]
        supabase.table("brand_social_corpus").upsert(
            chunk,
            on_conflict="brand_slug,url_hash",
        ).execute()
        n_ok += len(chunk)
    return n_ok


def registry_brand_jobs(supabase, max_brands: int | None) -> list[dict[str, str]]:
    """
    从 audit_products 按 brand_slug 去重；Reddit 查询串取该品牌下最长的「brand model」组合。
    product_slug 在 registry 批量模式下恒为 null，避免 (brand_slug,url_hash) upsert 互相覆盖。
    """
    res = supabase.table("audit_products").select("brand, model, brand_slug").execute()
    rows = res.data or []
    best: dict[str, dict[str, str]] = {}
    for r in rows:
        bs = (r.get("brand_slug") or "").strip() or slugify(str(r.get("brand") or ""))
        if not bs:
            continue
        b = (r.get("brand") or "").strip()
        m = (r.get("model") or "").strip()
        query = f"{b} {m}".strip() or b
        name = (b or query)[:500]
        if bs not in best or len(query) > len(best[bs]["query"]):
            best[bs] = {"brand_slug": bs, "query": query, "brand_name": name}
    jobs = sorted(best.values(), key=lambda x: x["brand_slug"])
    if max_brands is not None and max_brands > 0:
        jobs = jobs[:max_brands]
    return jobs


def gather_corpus_hits(
    http_client: httpx.Client,
    brand_query: str,
    brand_slug: str,
    rq: int,
    bq: int,
    args: argparse.Namespace,
    use_brave: bool,
    brave_key: str,
) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    hits.extend(
        collect_reddit(
            http_client,
            brand_query,
            brand_slug,
            REDDIT_SUBQUERY_TEMPLATES,
            rq,
            args.reddit_limit,
            args.reddit_pages,
            args.sleep,
        )
    )
    if use_brave:
        hits.extend(
            collect_brave_amazon_trustpilot(
                http_client,
                brave_key,
                brand_query,
                brand_slug,
                BRAVE_QUERY_TEMPLATES,
                bq,
                args.brave_count,
                args.brave_offset_pages,
                args.sleep,
            )
        )
    merged: dict[str, dict[str, Any]] = {}
    for h in hits:
        fp = h.get("url_hash") or ""
        if fp and fp not in merged:
            merged[fp] = h
    return list(merged.values())


def build_corpus_rows(
    hits: list[dict[str, Any]],
    brand_slug: str,
    brand_name: str,
    product_slug: str | None,
) -> list[dict[str, Any]]:
    now = datetime.now(UTC).isoformat()
    ps = (product_slug or "").strip() or None
    rows: list[dict[str, Any]] = []
    for h in hits:
        rows.append(
            {
                "brand_slug": brand_slug,
                "brand_name": (brand_name or "")[:500],
                "product_slug": ps,
                "source_platform": h["source_platform"],
                "title": h.get("title"),
                "snippet": h["snippet"],
                "source_url": h["source_url"],
                "url_hash": h["url_hash"],
                "serp_query": h.get("serp_query"),
                "serp_page": int(h.get("serp_page") or 1),
                "collected_at": now,
            }
        )
    return rows


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(
        description="默认仅 Reddit search.json；加 --brave 且配置密钥时才采 Amazon/Trustpilot → brand_social_corpus。"
    )
    p.add_argument(
        "--brand",
        type=str,
        default=None,
        help='单品牌模式：查询串，如 "Saatva" 或 "Saatva Classic"（与 --from-registry 二选一）。',
    )
    p.add_argument(
        "--from-registry",
        action="store_true",
        help="从 audit_products 按 brand_slug 去重，批量写入 corpus（每品牌一条任务，product_slug 为空）。",
    )
    p.add_argument(
        "--registry-max-brands",
        type=int,
        default=0,
        help="批量模式下最多处理多少个品牌；0 表示不限制。",
    )
    p.add_argument(
        "--inter-brand-sleep",
        type=float,
        default=3.0,
        help="--from-registry 时每个品牌之间的休眠秒数，降 429 风险。",
    )
    p.add_argument(
        "--product-slug",
        type=str,
        default=None,
        help="仅单品牌模式：关联 audit_products.slug。",
    )
    p.add_argument(
        "--max-queries",
        type=int,
        default=0,
        help="每源使用的模板数上限；0 表示全部。",
    )
    p.add_argument("--reddit-limit", type=int, default=25, help="每条 Reddit 请求的 listing limit（1–100）。")
    p.add_argument(
        "--reddit-pages",
        type=int,
        default=3,
        help="每个 (模板 × global/sub) 组合下，after 分页最多翻几页。",
    )
    p.add_argument(
        "--brave",
        action="store_true",
        help="同时用 Brave Web Search 采 Amazon/Trustpilot（需 BRAVE_SEARCH_API_KEY；默认仅 Reddit）。",
    )
    p.add_argument("--brave-count", type=int, default=20, help="Brave 每页条数（通常 ≤20）。")
    p.add_argument("--brave-offset-pages", type=int, default=3, help="Brave 每个查询最多翻几页（offset 步进）。")
    p.add_argument("--sleep", type=float, default=0.75, help="请求间隔（秒）；Reddit 过频易 429。")
    p.add_argument("--batch-size", type=int, default=250, help="Supabase upsert 每批条数。")
    p.add_argument("--dry-run", action="store_true", help="只统计，不写库。")
    args = p.parse_args(argv)

    if not args.from_registry and not (args.brand or "").strip():
        p.error("请指定 --brand … 或 --from-registry")
    if args.from_registry and (args.brand or "").strip():
        p.error("--from-registry 时不要同时使用 --brand")

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        print("❌ SUPABASE_URL / SUPABASE_KEY missing (.env.local)")
        return 1

    brave_key = (
        (os.getenv("BRAVE_SEARCH_API_KEY") or os.getenv("BRAVE_API_KEY") or "").strip()
    )
    use_brave = bool(brave_key) and args.brave
    if args.brave and not brave_key:
        print("⚠️ 已指定 --brave 但未设置 BRAVE_SEARCH_API_KEY / BRAVE_API_KEY，跳过 Brave，仅 Reddit。")

    rq = args.max_queries if args.max_queries > 0 else len(REDDIT_SUBQUERY_TEMPLATES)
    rq = min(rq, len(REDDIT_SUBQUERY_TEMPLATES))
    bq = args.max_queries if args.max_queries > 0 else len(BRAVE_QUERY_TEMPLATES)
    bq = min(bq, len(BRAVE_QUERY_TEMPLATES))

    supabase = create_client(url, key)

    def run_one(
        brand_query: str,
        brand_slug: str,
        brand_name: str,
        product_slug: str | None,
        label: str,
    ) -> int:
        print(
            f"\n── {label} | slug={brand_slug} | Reddit 模板: {rq} | "
            f"Brave: {'on' if use_brave else 'off'} | dry_run={args.dry_run}"
        )
        with httpx.Client() as http_client:
            hits = gather_corpus_hits(
                http_client,
                brand_query,
                brand_slug,
                rq,
                bq,
                args,
                use_brave,
                brave_key,
            )
        print(f"去重后片段数: {len(hits)}")
        by_plat: dict[str, int] = {}
        for h in hits:
            by_plat[h["source_platform"]] = by_plat.get(h["source_platform"], 0) + 1
        print(f"按平台: {by_plat}")
        if args.dry_run:
            return 0
        rows = build_corpus_rows(hits, brand_slug, brand_name, product_slug)
        try:
            n = upsert_batches(supabase, rows, max(1, args.batch_size))
            print(f"✅ upsert 完成: {n} 行")
        except Exception as e:
            print(f"❌ Supabase 错误: {e}")
            print(
                "若提示表不存在：在 Supabase SQL Editor 执行 src/scripts/sql/brand_social_corpus.sql；"
                "若 42501 请确认 SUPABASE_KEY 为 service_role。"
            )
            return 1
        return 0

    if args.from_registry:
        cap = args.registry_max_brands if args.registry_max_brands > 0 else None
        jobs = registry_brand_jobs(supabase, cap)
        if not jobs:
            print("No rows in audit_products (or empty brand_slug).")
            return 0
        print(
            f"📋 --from-registry: {len(jobs)} brand_slug(s) | "
            f"inter_brand_sleep={args.inter_brand_sleep}s | dry_run={args.dry_run}"
        )
        for i, job in enumerate(jobs, 1):
            q = job["query"]
            bs = job["brand_slug"]
            bn = job["brand_name"]
            rc = run_one(q, bs, bn, None, f"[{i}/{len(jobs)}] {q!r}")
            if rc != 0:
                return rc
            if i < len(jobs):
                time.sleep(max(0.0, args.inter_brand_sleep))
        print("\n✅ 全部品牌处理完毕（brand_social_corpus）。")
        return 0

    brand = (args.brand or "").strip()
    brand_slug = slugify(brand)
    product_slug = (args.product_slug or "").strip() or None
    print(
        f"品牌: {brand} (slug={brand_slug}) | Reddit 模板: {rq} | "
        f"Brave: {'on' if use_brave else 'off（默认仅 Reddit）'} | dry_run={args.dry_run}"
    )
    return run_one(brand, brand_slug, brand[:500], product_slug, "single-brand")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
