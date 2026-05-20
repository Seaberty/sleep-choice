#!/usr/bin/env python3
"""
Merge curated compare-seo-pairs.json with auto pairs from audit_products.

Writes src/data/compare-seo-pairs.generated.json (full merge snapshot for CI/review).
Curated entries in compare-seo-pairs.json always win on pairSlug conflict.

Run from repo root::

    python src/scripts/generate_compare_pairs.py
    python src/scripts/generate_compare_pairs.py --write   # overwrite generated only

Requires SUPABASE_URL + SUPABASE_KEY in .env / .env.local.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from itertools import combinations
from pathlib import Path

from dotenv import load_dotenv

_REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(_REPO / ".env")
load_dotenv(_REPO / ".env.local")

CURATED_PATH = _REPO / "src" / "data" / "compare-seo-pairs.json"
GENERATED_PATH = _REPO / "src" / "data" / "compare-seo-pairs.generated.json"

MAX_AUTO = 72
MAX_PER_BRAND = 6
MAX_CROSS_BRANDS = 8


def canonical_pair(slug_a: str, slug_b: str) -> str:
    a, b = sorted([slug_a.strip(), slug_b.strip()])
    return f"{a}-vs-{b}"


def quiz_shelf(slug: str, model: str, category: str) -> str:
    blob = f"{slug} {model} {category}".lower()
    if re.search(r"pillow|枕|bolster", blob):
        return "pillow"
    if re.search(r"robe|loungewear|bathrobe|towel|waffle", blob):
        return "lifestyle"
    if re.search(r"topper|protector", blob):
        return "other"
    if re.search(r"mattress|hybrid|innerspring|latex|foam\s*mattress", blob):
        return "mattress"
    return "mattress"


def is_listable(row: dict) -> bool:
    price = float(row.get("price") or 0)
    if price <= 0:
        return False
    img = (row.get("image_url") or "").strip()
    if not img or img == "/placeholder-product.png":
        scores = row.get("audit_scores") or {}
        overall = float(scores.get("overall") or 0)
        if overall <= 0:
            return False
    return True


def auto_copy(a: dict, b: dict) -> dict:
    def label(r: dict) -> str:
        n = (r.get("model") or "").strip() or r["slug"]
        return f"{r['brand']} {n}".strip()

    la, lb = label(a), label(b)
    shelf_note = ""
    if a["shelf"] == b["shelf"] and a["shelf"] != "other":
        shelf_note = f" Both SKUs sit in our {a['shelf']} shelf."
    return {
        "title": f"{la} vs {lb}",
        "description": (
            f"Side-by-side SleepChoice audit scores for {la} and {lb}"
            "—support, cooling, pressure relief, and durability."
        ),
        "intro": (
            "Registry-backed comparison on the same forensic grid."
            f"{shelf_note} Indices reflect aggregated owner-review intelligence."
        ),
    }


def generate_auto(rows: list[dict], curated_slugs: set[str]) -> list[dict]:
    out: list[dict] = []
    seen = set(curated_slugs)
    by_slug = {r["slug"]: r for r in rows}

    by_shelf: dict[str, list[dict]] = {}
    for r in rows:
        by_shelf.setdefault(r["shelf"], []).append(r)

    def add_pair(slug_a: str, slug_b: str) -> None:
        nonlocal out
        if len(out) >= MAX_AUTO:
            return
        key = canonical_pair(slug_a, slug_b)
        if key in seen or slug_a == slug_b:
            return
        a, b = by_slug.get(slug_a), by_slug.get(slug_b)
        if not a or not b:
            return
        seen.add(key)
        lo, hi = sorted([slug_a, slug_b])
        copy = auto_copy(a, b)
        out.append(
            {
                "pairSlug": key,
                "slugA": lo,
                "slugB": hi,
                **copy,
            }
        )

    for shelf_rows in by_shelf.values():
        if len(shelf_rows) < 2:
            continue
        by_brand: dict[str, list[dict]] = {}
        for r in shelf_rows:
            by_brand.setdefault(r["brand"], []).append(r)

        for brand_rows in by_brand.values():
            if len(brand_rows) < 2:
                continue
            top = sorted(brand_rows, key=lambda x: -x["overall"])[:4]
            n = 0
            for sa, sb in combinations(top, 2):
                if n >= MAX_PER_BRAND:
                    break
                before = len(out)
                add_pair(sa["slug"], sb["slug"])
                if len(out) > before:
                    n += 1

        leaders = []
        for _brand, blist in by_brand.items():
            best = max(blist, key=lambda x: x["overall"])
            leaders.append(best)
        leaders.sort(key=lambda x: -x["overall"])
        leaders = leaders[:MAX_CROSS_BRANDS]
        for sa, sb in combinations(leaders, 2):
            add_pair(sa["slug"], sb["slug"])

    return out


def fetch_rows() -> list[dict]:
    url = (os.getenv("SUPABASE_URL") or "").strip()
    key = (os.getenv("SUPABASE_KEY") or "").strip()
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_KEY", file=sys.stderr)
        sys.exit(1)
    from supabase import create_client

    client = create_client(url, key)
    res = (
        client.table("audit_products")
        .select("slug, brand, model, category, price, image_url, audit_scores")
        .gt("price", 0)
        .execute()
    )
    rows = []
    for item in res.data or []:
        if not is_listable(item):
            continue
        slug = str(item.get("slug") or "").strip()
        brand = str(item.get("brand") or "").strip()
        if not slug or not brand:
            continue
        scores = item.get("audit_scores") or {}
        overall = float(scores.get("overall") or 0)
        model = str(item.get("model") or "").strip()
        category = str(item.get("category") or "").strip()
        rows.append(
            {
                "slug": slug,
                "brand": brand,
                "model": model,
                "overall": overall,
                "shelf": quiz_shelf(slug, model, category),
            }
        )
    rows.sort(key=lambda x: -x["overall"])
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write compare-seo-pairs.generated.json",
    )
    args = parser.parse_args()

    curated = json.loads(CURATED_PATH.read_text(encoding="utf-8"))
    curated_slugs = {p["pairSlug"] for p in curated}
    auto = generate_auto(fetch_rows(), curated_slugs)

    by_slug = {p["pairSlug"]: p for p in auto}
    for p in curated:
        by_slug[p["pairSlug"]] = p
    merged = sorted(by_slug.values(), key=lambda x: x["title"])

    print(f"curated={len(curated)} auto={len(auto)} merged={len(merged)}")

    if args.write:
        GENERATED_PATH.write_text(
            json.dumps(merged, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"Wrote {GENERATED_PATH}")


if __name__ == "__main__":
    main()
