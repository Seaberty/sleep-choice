# -*- coding: utf-8 -*-
"""
Bulk-fill brand_intelligence using Serper (Google organic via API) + Gemini.

Use when you need more coverage than the single-pass forensic audit:
  - Multiple search queries per product
  - Dedupe by URL
  - Bucket snippets by destination domain → Reddit / Amazon / Trustpilot / SleepLine / Other
  - One Gemini JSON pass per product → upsert into brand_intelligence

Prerequisites:
  - Table public.brand_intelligence exists (migration applied).
  - SUPABASE_KEY should be the service_role key (RLS allows SELECT only for anon; inserts need bypass).
  - SERPER_API_KEY, GEMINI_API_KEY

Compliance:
  - Respect Serper / Google program terms, rate limits, and target sites’ ToS.
  - This script does not scrape merchant pages directly; it uses Serper search results only.

Usage:
  cd src/scripts
  python brand_intel_bulk_ingest.py --limit 30
  python brand_intel_bulk_ingest.py --slug saatva-classic
  python brand_intel_bulk_ingest.py --queries 10 --serper-num 50 --dry-run

  按品牌名沉淀大量平台片段（不经 Serper / 不经 LLM、写入 brand_social_corpus）见：
  python brand_social_corpus_ingest.py --brand Saatva
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, urlunparse

import httpx
from dotenv import load_dotenv
from google import genai
from google.genai import types
from supabase import create_client

_ROOT = Path(__file__).resolve().parents[2]
_ENV = _ROOT / ".env.local"
if not _ENV.is_file():
    _ENV = Path(__file__).resolve().parents[1] / ".env.local"
load_dotenv(dotenv_path=_ENV)

SERPER_URL = "https://google.serper.dev/search"
GEMINI_MODEL_ID = "gemini-2.5-flash"

# Broad query templates — increase variety = more unique SERP rows (and Serper API spend).
DEFAULT_QUERY_TEMPLATES: tuple[str, ...] = (
    "{brand} {model} mattress review",
    "{brand} {model} mattress reddit",
    "site:reddit.com {brand} {model} mattress",
    "site:amazon.com {brand} {model} mattress",
    "{brand} {model} mattress trustpilot",
    "site:trustpilot.com {brand}",
    "{brand} {model} site:sleepline.com",
    "{brand} {model} mattress complaints",
    "{brand} {model} mattress experience",
    "{brand} {model} mattress owner review",
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
    if "sleepline.com" in u:
        return "SleepLine"
    return "Other"


def confidence_from_density(n: int) -> float:
    if n <= 0:
        return 0.05
    return round(min(1.0, n / 30.0), 4)


def serper_organic(
    client: httpx.Client, api_key: str, q: str, num: int
) -> list[dict[str, Any]]:
    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    payload = {"q": q, "num": min(int(num), 100), "page": 1}
    r = client.post(SERPER_URL, headers=headers, json=payload, timeout=30.0)
    if r.status_code != 200:
        print(f"  ❌ Serper HTTP {r.status_code}: {r.text[:400]}")
        return []
    data = r.json()
    return data.get("organic", []) or []


def collect_buckets(
    client: httpx.Client,
    serper_key: str,
    brand: str,
    model: str,
    templates: tuple[str, ...],
    max_queries: int,
    serper_num: int,
    sleep_s: float,
) -> dict[str, list[dict[str, Any]]]:
    seen: set[str] = set()
    all_items: list[dict[str, Any]] = []
    used = templates[: max(1, max_queries)]
    for tpl in used:
        q = tpl.format(brand=brand.strip(), model=model.strip())
        organic = serper_organic(client, serper_key, q, serper_num)
        for item in organic:
            link = item.get("link") or ""
            key = norm_link(link) if link else f"t:{item.get('title')}"
            if key in seen:
                continue
            seen.add(key)
            all_items.append(item)
        time.sleep(sleep_s)

    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in all_items:
        plat = classify_platform(item.get("link") or "")
        buckets[plat].append(item)
    return dict(buckets)


def buckets_to_blocks(
    buckets: dict[str, list[dict[str, Any]]], max_snippets_per_platform: int
) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for platform_name, items in sorted(buckets.items()):
        if not items:
            continue
        chunk_lines = []
        for it in items[:max_snippets_per_platform]:
            chunk_lines.append(
                f"🔍 SOURCE: {it.get('title')}\nCONTEXT: {it.get('snippet')}"
            )
        merged = "\n\n".join(chunk_lines)
        if not merged.strip():
            continue
        blocks.append(
            {
                "source_platform": platform_name,
                "evidence_text": merged[:12000],
                "signal_density": len(items),
            }
        )
    return blocks


def gemini_batch_extract(
    api_key: str, brand: str, model: str, blocks: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    trimmed = []
    for b in blocks:
        trimmed.append(
            {
                "source_platform": b["source_platform"],
                "signal_density": int(b["signal_density"]),
                "evidence_excerpt": (b["evidence_text"] or "")[:3200],
            }
        )
    if not trimmed:
        return []

    prompt = """
You are a consumer mattress research analyst. For EACH platform object in the JSON input, read only the evidence_excerpt.
Return a single JSON object with key "items" — an array with one entry per input platform:
- source_platform: exact copy from input
- sentiment_score: float 0.0 (very negative consensus in snippets) to 1.0 (very positive)
- key_issue_tags: array of 2 to 8 short labels (e.g. Edge_Support, Off-gassing, Shipping_Delay)
- verdict_summary: one paragraph, max 85 words, neutral forensic tone; themes only, no URLs or invented facts

If snippets are thin or contradictory, sentiment ~0.45–0.55 and include tag "Thin_Signal".
"""
    ctx = json.dumps(
        {"brand": brand, "model": model, "platforms": trimmed},
        ensure_ascii=False,
    )
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=GEMINI_MODEL_ID,
        contents=[prompt.strip(), ctx],
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    parsed = json.loads(response.text)
    items = parsed.get("items") or []
    density_map = {x["source_platform"]: x["signal_density"] for x in trimmed}
    out = []
    for it in items:
        plat = (it.get("source_platform") or "").strip()
        if plat not in density_map:
            continue
        tags = it.get("key_issue_tags") or []
        if isinstance(tags, str):
            tags = [tags]
        tags = [str(t).strip() for t in tags if str(t).strip()][:12]
        try:
            ss = float(it.get("sentiment_score") if it.get("sentiment_score") is not None else 0.5)
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


def upsert_rows(
    supabase,
    brand_slug: str,
    product_slug: str,
    rows: list[dict[str, Any]],
) -> None:
    now = datetime.now(UTC).isoformat()
    for row in rows:
        dens = int(row.get("signal_density") or 0)
        payload = {
            "brand_slug": brand_slug,
            "product_slug": product_slug,
            "source_platform": row["source_platform"],
            "sentiment_score": row.get("sentiment_score", 0.5),
            "key_issue_tags": row.get("key_issue_tags") or [],
            "verdict_summary": row.get("verdict_summary") or "",
            "signal_density": dens,
            "confidence_score": confidence_from_density(dens),
            "updated_at": now,
            "collected_at": now,
        }
        supabase.table("brand_intelligence").upsert(
            payload,
            on_conflict="brand_slug,product_slug,source_platform",
        ).execute()


def fetch_products(
    supabase,
    limit: int | None,
    slug: str | None,
) -> list[dict[str, Any]]:
    q = supabase.table("audit_products").select(
        "slug, brand, model, brand_slug"
    )
    if slug:
        q = q.eq("slug", slug.strip())
    q = q.order("updated_at", desc=True)
    if limit and not slug:
        q = q.limit(limit)
    res = q.execute()
    rows = res.data or []
    out = []
    for r in rows:
        bs = r.get("brand_slug") or slugify(str(r.get("brand") or ""))
        out.append(
            {
                "slug": r["slug"],
                "brand": r.get("brand") or "",
                "model": r.get("model") or "",
                "brand_slug": bs,
            }
        )
    return out


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description="Bulk ingest brand_intelligence via Serper + Gemini.")
    p.add_argument("--limit", type=int, default=50, help="Max products from audit_products (ignored if --slug set).")
    p.add_argument("--slug", type=str, default=None, help="Only this registry slug.")
    p.add_argument("--queries", type=int, default=10, help="How many query templates to run per product.")
    p.add_argument("--serper-num", type=int, default=50, help="Serper organic count per query (max 100).")
    p.add_argument("--sleep", type=float, default=0.35, help="Seconds between Serper calls.")
    p.add_argument("--dry-run", action="store_true", help="Print counts only; no Gemini / no DB writes.")
    p.add_argument("--skip-llm", action="store_true", help="Upsert neutral rows without Gemini (fast, lower quality).")
    args = p.parse_args(argv)

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    serper_key = os.getenv("SERPER_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")

    if not url or not key:
        print("❌ SUPABASE_URL / SUPABASE_KEY missing (.env.local)")
        return 1
    if not serper_key:
        print("❌ SERPER_API_KEY missing")
        return 1
    if not args.skip_llm and not args.dry_run and not gemini_key:
        print("❌ GEMINI_API_KEY missing (use --skip-llm or --dry-run to bypass)")
        return 1

    supabase = create_client(url, key)
    products = fetch_products(supabase, args.limit, args.slug)
    if not products:
        print("No audit_products rows matched.")
        return 0

    templates = DEFAULT_QUERY_TEMPLATES
    mq = min(args.queries, len(templates))

    print(
        f"📋 Products: {len(products)} | queries/product: {mq} | "
        f"organic/query: {args.serper_num} | dry_run={args.dry_run}"
    )

    with httpx.Client() as http_client:
        for i, pr in enumerate(products, 1):
            slug = pr["slug"]
            brand = pr["brand"]
            model = pr["model"]
            brand_slug = pr["brand_slug"]
            print(f"\n[{i}/{len(products)}] {slug} ({brand} {model})")

            buckets = collect_buckets(
                http_client,
                serper_key,
                brand,
                model,
                templates,
                mq,
                args.serper_num,
                args.sleep,
            )
            total_hits = sum(len(v) for v in buckets.values())
            print(f"  Serper unique hits: {total_hits} | buckets: { {k: len(v) for k, v in buckets.items()} }")

            blocks = buckets_to_blocks(buckets, max_snippets_per_platform=45)
            if args.dry_run:
                continue

            if not blocks:
                print("  ⏭ skip (no evidence)")
                continue

            if args.skip_llm:
                rows = [
                    {
                        "source_platform": b["source_platform"],
                        "sentiment_score": 0.5,
                        "key_issue_tags": ["Auto_Ingest"],
                        "verdict_summary": "Automated bulk ingest without LLM scoring; replace via dashboard or re-run with Gemini.",
                        "signal_density": b["signal_density"],
                    }
                    for b in blocks
                ]
            else:
                try:
                    rows = gemini_batch_extract(gemini_key, brand, model, blocks)
                except Exception as e:
                    print(f"  ⚠️ Gemini failed: {e}")
                    continue

            if not rows:
                print("  ⏭ no LLM rows")
                continue

            try:
                upsert_rows(supabase, brand_slug, slug, rows)
                print(f"  ✅ upserted {len(rows)} platform row(s)")
            except Exception as e:
                print(f"  ❌ Supabase upsert: {e}")

            time.sleep(1.0)

    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
