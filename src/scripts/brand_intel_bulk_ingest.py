# -*- coding: utf-8 -*-
"""
Bulk-fill brand_intelligence from public.brand_social_corpus + DeepSeek（不经过 Serper）。

每个 registry 产品：按 brand_slug + slug 读取 corpus → 按平台块调用 DeepSeek → upsert brand_intelligence。

前置：
  - public.brand_social_corpus 已有数据（见 brand_social_corpus_ingest.py --from-registry）。
  - public.brand_intelligence 表已存在。
  - SUPABASE_KEY 建议为 service_role。
  - DEEPSEEK_API_KEY；503/429 等可自动重试。

用法：
  cd src/scripts
  python brand_intel_bulk_ingest.py --limit 30
  python brand_intel_bulk_ingest.py --limit 0          # 全站 audit_products
  python brand_intel_bulk_ingest.py --slug saatva-classic
  python brand_intel_bulk_ingest.py --dry-run
  python brand_intel_bulk_ingest.py --skip-llm         # 占位行，无 LLM
  CI：.github/workflows/brand-social-corpus-weekly.yml（Step 2 需 DEEPSEEK_API_KEY）
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from supabase import create_client

_ROOT = Path(__file__).resolve().parents[2]
_ENV = _ROOT / ".env.local"
if not _ENV.is_file():
    _ENV = Path(__file__).resolve().parents[1] / ".env.local"
load_dotenv(dotenv_path=_ENV)

DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_MODEL_ID = "deepseek-chat"


def slugify(text: str) -> str:
    text = text.lower().replace("&", "and")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def confidence_from_density(n: int) -> float:
    if n <= 0:
        return 0.05
    return round(min(1.0, n / 30.0), 4)


def _trimmed_platforms_for_llm(
    brand: str, model: str, blocks: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], str, dict[str, int]]:
    trimmed: list[dict[str, Any]] = []
    for b in blocks:
        trimmed.append(
            {
                "source_platform": b["source_platform"],
                "signal_density": int(b["signal_density"]),
                "evidence_excerpt": (b["evidence_text"] or "")[:3200],
            }
        )
    ctx = json.dumps(
        {"brand": brand, "model": model, "platforms": trimmed},
        ensure_ascii=False,
    )
    density_map = {x["source_platform"]: x["signal_density"] for x in trimmed}
    return trimmed, ctx, density_map


def _parse_json_object_text(raw: str) -> dict[str, Any]:
    text = (raw or "").strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return json.loads(text)


def _rows_from_parsed_items(
    parsed: dict[str, Any], density_map: dict[str, int]
) -> list[dict[str, Any]]:
    from forensic_engine import _sanitize_key_issue_tags

    items = parsed.get("items") or []
    out: list[dict[str, Any]] = []
    for it in items:
        plat = (it.get("source_platform") or "").strip()
        if plat not in density_map:
            continue
        tags = _sanitize_key_issue_tags(it.get("key_issue_tags"))
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


def _deepseek_error_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in (408, 425, 429, 500, 502, 503, 504)
    s = str(exc).lower()
    return any(
        x in s
        for x in (
            "timeout",
            "timed out",
            "connection",
            "reset",
            "temporar",
            "503",
            "429",
            "502",
            "504",
            "unavailable",
            "overloaded",
            "rate",
            "quota",
            "try again",
        )
    )


def deepseek_batch_extract_once(
    api_key: str, brand: str, model: str, blocks: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    from forensic_engine import _DEEPSEEK_BRAND_INTEL_SYSTEM

    trimmed, ctx, density_map = _trimmed_platforms_for_llm(brand, model, blocks)
    if not trimmed:
        return []
    user = (
        "INPUT_JSON:\n"
        + ctx
        + "\n\nReturn exactly one JSON object with top-level key \"items\" only, "
        "per your system instructions."
    )
    timeout = httpx.Timeout(connect=20.0, read=120.0, write=30.0, pool=20.0)
    with httpx.Client(timeout=timeout, trust_env=True) as client:
        resp = client.post(
            DEEPSEEK_CHAT_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": DEEPSEEK_MODEL_ID,
                "messages": [
                    {"role": "system", "content": _DEEPSEEK_BRAND_INTEL_SYSTEM},
                    {"role": "user", "content": user},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
            },
        )
        resp.raise_for_status()
        data = resp.json()
    content = (
        data.get("choices", [{}])[0].get("message", {}).get("content", "") or ""
    )
    if not content.strip():
        raise RuntimeError("DeepSeek 返回空内容")
    parsed = _parse_json_object_text(content)
    return _rows_from_parsed_items(parsed, density_map)


def deepseek_batch_extract_with_retries(
    api_key: str,
    brand: str,
    model: str,
    blocks: list[dict[str, Any]],
    max_retries: int,
    base_delay_s: float,
) -> list[dict[str, Any]]:
    trimmed, _, _ = _trimmed_platforms_for_llm(brand, model, blocks)
    if not trimmed:
        return []
    last: BaseException | None = None
    attempts = max(1, int(max_retries))
    for attempt in range(1, attempts + 1):
        try:
            return deepseek_batch_extract_once(api_key, brand, model, blocks)
        except Exception as e:
            last = e
            if attempt >= attempts or not _deepseek_error_retryable(e):
                raise
            delay = min(120.0, float(base_delay_s) * (2 ** (attempt - 1)))
            print(
                f"  ⏳ DeepSeek 可重试错误（{attempt}/{attempts}），{delay:.1f}s 后重试: {e!s}"
            )
            time.sleep(delay)
    assert last is not None
    raise last


def extract_brand_intel_llm_rows(
    brand: str,
    model: str,
    blocks: list[dict[str, Any]],
    deepseek_key: str,
    max_retries: int,
    base_delay_s: float,
) -> list[dict[str, Any]]:
    dk = (deepseek_key or "").strip()
    if not dk:
        raise RuntimeError("未配置 DEEPSEEK_API_KEY")
    return deepseek_batch_extract_with_retries(
        dk, brand, model, blocks, max_retries, base_delay_s
    )


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
    p = argparse.ArgumentParser(
        description="Bulk ingest brand_intelligence from brand_social_corpus + DeepSeek（无 Serper）。"
    )
    p.add_argument(
        "--limit",
        type=int,
        default=50,
        help="audit_products 最多处理条数；设为 0 表示不限制（全站产品）。--slug 时忽略。",
    )
    p.add_argument("--slug", type=str, default=None, help="仅该 registry slug。")
    p.add_argument(
        "--sleep-between-products",
        type=float,
        default=1.0,
        help="每个产品之间的休眠秒数（降 API 限流风险）。",
    )
    p.add_argument(
        "--deepseek-max-retries",
        type=int,
        default=6,
        help="DeepSeek 503/429 等可重试错误时的最大尝试次数（含首次）。",
    )
    p.add_argument(
        "--deepseek-retry-base-seconds",
        type=float,
        default=3.0,
        help="首次重试前等待秒数，之后指数退避（上限 120s）。",
    )
    p.add_argument("--dry-run", action="store_true", help="只打印 corpus 块数量，不写库、不调 LLM。")
    p.add_argument("--skip-llm", action="store_true", help="Upsert 占位行，不调用 DeepSeek。")
    args = p.parse_args(argv)

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    deepseek_key = (os.getenv("DEEPSEEK_API_KEY") or "").strip()

    if not url or not key:
        print("❌ SUPABASE_URL / SUPABASE_KEY missing (.env.local)")
        return 1
    if not args.skip_llm and not args.dry_run and not deepseek_key:
        print("❌ 需要 DEEPSEEK_API_KEY（或加 --skip-llm / --dry-run）")
        return 1

    from forensic_engine import load_social_evidence_from_brand_corpus

    supabase = create_client(url, key)
    products = fetch_products(supabase, args.limit, args.slug)
    if not products:
        print("No audit_products rows matched.")
        return 0

    print(
        f"📋 Products: {len(products)} | source=brand_social_corpus | "
        f"dry_run={args.dry_run} | skip_llm={args.skip_llm}"
    )

    for i, pr in enumerate(products, 1):
        slug = pr["slug"]
        brand = pr["brand"]
        model = pr["model"]
        brand_slug = pr["brand_slug"]
        print(f"\n[{i}/{len(products)}] {slug} ({brand} {model})")

        _, total_n, platform_blocks = load_social_evidence_from_brand_corpus(
            supabase, brand_slug, slug
        )
        blocks = [b for b in platform_blocks if (b.get("evidence_text") or "").strip()]
        print(f"  corpus: {len(blocks)} platform block(s), ~{total_n} snippet rows indexed")

        if args.dry_run:
            continue

        if not blocks:
            print("  ⏭ skip (no corpus evidence for this slug)")
            continue

        if args.skip_llm:
            rows = [
                {
                    "source_platform": b["source_platform"],
                    "sentiment_score": 0.5,
                    "key_issue_tags": ["Corpus_Only"],
                    "verdict_summary": "Bulk ingest from brand_social_corpus without LLM; re-run with DeepSeek or use forensic audit.",
                    "signal_density": b["signal_density"],
                }
                for b in blocks
            ]
        else:
            try:
                rows = extract_brand_intel_llm_rows(
                    brand,
                    model,
                    blocks,
                    deepseek_key,
                    args.deepseek_max_retries,
                    args.deepseek_retry_base_seconds,
                )
            except Exception as e:
                print(f"  ⚠️ LLM 失败（DeepSeek 重试后仍不可用）: {e}")
                continue

        if not rows:
            print("  ⏭ no LLM rows")
            continue

        try:
            upsert_rows(supabase, brand_slug, slug, rows)
            print(f"  ✅ upserted {len(rows)} platform row(s)")
        except Exception as e:
            print(f"  ❌ Supabase upsert: {e}")

        time.sleep(max(0.0, args.sleep_between_products))

    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
