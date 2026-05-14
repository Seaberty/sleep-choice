# -*- coding: utf-8 -*-
"""
Promotion asset pipeline: Supabase → promo_bundle JSON, Pinterest-style PNG pins,
Reddit drafts, and Pinterest “audit matrix” metadata (board, pain-hook title, alt text).

Usage:
  cd src/scripts && python promo_assets.py
  python promo_assets.py --output-dir ./promo_output --base-url https://example.com
  python promo_assets.py --json-only
  python promo_assets.py --skip-images

Env: SUPABASE_URL, SUPABASE_KEY (service_role recommended for full SELECT),
     NEXT_PUBLIC_SITE_URL or SITE_URL for canonical links.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from datetime import datetime, UTC
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import create_client

_ROOT = Path(__file__).resolve().parents[2]
_ENV = _ROOT / ".env.local"
if not _ENV.is_file():
    _ENV = Path(__file__).resolve().parents[1] / ".env.local"
load_dotenv(dotenv_path=_ENV)


def _bootstrap_supabase_env_from_aliases() -> None:
    if not (os.getenv("SUPABASE_URL") or "").strip():
        alt = (os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
        if alt:
            os.environ["SUPABASE_URL"] = alt
    if not (os.getenv("SUPABASE_KEY") or "").strip():
        alt = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
        if alt:
            os.environ["SUPABASE_KEY"] = alt


_bootstrap_supabase_env_from_aliases()


def _resolve_base_url() -> str:
    for key in ("NEXT_PUBLIC_SITE_URL", "SITE_URL", "VERCEL_URL"):
        raw = (os.getenv(key) or "").strip().rstrip("/")
        if raw:
            if key == "VERCEL_URL" and not raw.startswith("http"):
                raw = "https://" + raw
            return raw
    return "https://localhost:3000"


def _parse_json_field(val: Any, fallback: Any) -> Any:
    if val is None:
        return fallback
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except json.JSONDecodeError:
            return fallback
    return fallback


def _audit_hash_from_row(row: dict[str, Any]) -> str | None:
    ad = _parse_json_field(row.get("audit_data"), {})
    if isinstance(ad, dict):
        h = ad.get("audit_hash")
        if isinstance(h, str) and h.strip():
            return h.strip()
    return None


def _normalize_scores(raw: Any) -> dict[str, float]:
    d = _parse_json_field(raw, {})
    if not isinstance(d, dict):
        return {"overall": 0.0, "support": 0.0, "cooling": 0.0, "pressure": 0.0, "durability": 0.0}
    out: dict[str, float] = {}
    for k in ("overall", "support", "cooling", "pressure", "durability"):
        v = d.get(k)
        try:
            fv = float(v)
        except (TypeError, ValueError):
            fv = 0.0
        if 0 < fv <= 1.0:
            fv = round(fv * 10, 1)
        out[k] = fv
    return out


def _board_for_brand(brand: str) -> str:
    """Pinterest board name — create these boards once in Pinterest, map IDs in env."""
    b = (brand or "").lower().strip()
    if "saatva" in b:
        return "Saatva Forensic Audits"
    if "fluff" in b:
        return "Hotel-Luxury Bedding (FluffCo)"
    if "sleep" in b and "beyond" in b:
        return "Organic Sleep Solutions (Sleep & Beyond)"
    return "Forensic Sleep Audits"


def _pinterest_pain_hook(model: str, slug: str) -> str:
    """Short intent phrase for the pin title (English, Pinterest-search friendly)."""
    m = (model or "").lower()
    s = (slug or "").lower()
    if "hd" in s or " hd" in m or m.strip().endswith("hd"):
        return "heavy sleepers"
    if "rx" in s or "-rx" in s or " rx" in m:
        return "back pain and spinal support"
    if "crib" in m or "crib" in s:
        return "infants and nursery safety"
    if "youth" in m or "youth" in s:
        return "kids and growing bodies"
    if "pillow" in m:
        return "neck alignment and loft"
    if any(x in m for x in ("sheet", "sateen", "percale")) or "sheet" in s:
        return "cool, breathable sheets"
    if "comforter" in m or "duvet" in m:
        return "all-season bedding layers"
    if "pillowcase" in m or "silk" in m:
        return "hair and skin (luxury pillowcases)"
    if "travel" in m or "mytravel" in s:
        return "travel and portability"
    if "latex" in m or "zenhaven" in s:
        return "natural latex and cooling"
    if "memory" in m or "loom" in s or "leaf" in m:
        return "motion isolation and pressure relief"
    if "solaire" in m:
        return "adjustable firmness for couples"
    if "merino" in m or "wool" in m or "organic" in m:
        return "organic and natural materials"
    return "support, cooling, and durability"


def _pinterest_pin_title(brand: str, model: str, slug: str) -> str:
    """Pain-forward title (example: Saatva HD Review: Is it best for heavy sleepers?)."""
    hook = _pinterest_pain_hook(model, slug)
    # Prefer "Brand Model Review: ..." when it fits; else shorten model.
    candidate = f"{brand} {model} Review: Is it best for {hook}?"
    if len(candidate) <= 100:
        return candidate
    short = f"{model} Review: Best for {hook}? · {brand}"
    if len(short) <= 100:
        return short
    return short[:97] + "..."


def _pin_alt_text(row: dict[str, Any]) -> str:
    raw = (row.get("seo_keywords") or "").strip()
    base = "forensic mattress audit, sleep scores, technical specs matrix, independent review"
    if not raw:
        return base
    merged = f"{raw}, {base}"
    return merged[:500]


def _pin_copy(row: dict[str, Any], scores: dict[str, float], base_url: str) -> dict[str, str]:
    brand = str(row.get("brand") or "").strip()
    model = str(row.get("model") or "").strip()
    slug = str(row.get("slug") or "").strip()
    seo_title = (row.get("seo_title") or "").strip()
    ov = scores.get("overall", 0.0)
    url = f"{base_url.rstrip('/')}/registry/{slug}"
    board = _board_for_brand(brand)
    pain_title = _pinterest_pin_title(brand, model, slug)
    alt = _pin_alt_text(row)
    desc_parts = [
        f"{brand} {model} · Independent forensic audit (support, cooling, pressure, durability).",
        f"Overall {ov:.1f}/10. Full specs matrix + methodology: {url}",
    ]
    description = " ".join(desc_parts)[:800]
    return {
        "pinterest_board": board,
        "pin_title": pain_title,
        "pin_title_seo_variant": (seo_title[:100] + "…") if len(seo_title) > 100 else seo_title,
        "pin_description": description,
        "pinterest_alt_text": alt,
        "canonical_url": url,
    }


def _reddit_draft(row: dict[str, Any], scores: dict[str, float], base_url: str) -> str:
    brand = str(row.get("brand") or "").strip()
    model = str(row.get("model") or "").strip()
    slug = str(row.get("slug") or "").strip()
    url = f"{base_url.rstrip('/')}/registry/{slug}"
    rc = row.get("review_count")
    rc_s = f"{int(rc)} SERP organic hits indexed in our audit pipeline" if isinstance(rc, int) else "SERP corpus size varies by model"
    note = (row.get("audit_note") or "").strip()
    evidence = (row.get("evidence_log") or "").strip()
    ev_short = re.sub(r"\s+", " ", evidence)[:650]
    if len(evidence) > 650:
        ev_short += "…"
    ts = _parse_json_field(row.get("technical_specs"), {})
    cert = ""
    if isinstance(ts, dict):
        cert = str(ts.get("Certifications") or "").strip()

    lines = [
        f"**{brand} {model}** — quick intelligence pull (not affiliated; methodology on site).",
        "",
        f"- **Scores (10-pt model):** overall {scores.get('overall', 0):.1f}, support {scores.get('support', 0):.1f}, cooling {scores.get('cooling', 0):.1f}, pressure {scores.get('pressure', 0):.1f}, durability {scores.get('durability', 0):.1f}.",
        f"- **Social evidence index:** {rc_s}.",
    ]
    if cert:
        lines.append(f"- **Certifications (from listing synthesis):** {cert[:280]}{'…' if len(cert) > 280 else ''}")
    if note:
        lines.append(f"- **Auditor note:** {note}")
    lines.extend(
        [
            "",
            "**Social / forum excerpt (truncated):**",
            ev_short if ev_short else "[No social evidence block stored for this row yet.]",
            "",
            f"Deep-dive forensic page: {url}",
            "",
            "Disclaimer: Aggregated public listings + community signals — verify certifications and policies on the merchant before buying.",
        ]
    )
    return "\n".join(lines)


def _try_font(size: int, bold: bool = False):
    from PIL import ImageFont

    paths = []
    if bold:
        paths.extend(
            [
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                "/System/Library/Fonts/Helvetica.ttc",
            ]
        )
    paths.extend(
        [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/Library/Fonts/Arial.ttf",
        ]
    )
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()


def render_pin_png(
    row: dict[str, Any],
    scores: dict[str, float],
    out_path: Path,
    pin_title: str,
) -> None:
    from PIL import Image, ImageDraw

    W, H = 1000, 1500
    bg = (248, 250, 252)
    img = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(img)
    margin = 48
    font_title = _try_font(28, bold=True)
    font_sub = _try_font(18)
    font_small = _try_font(14)
    font_axis = _try_font(12)

    # Title block
    brand = str(row.get("brand") or "")
    model = str(row.get("model") or "")
    y = margin
    draw.text((margin, y), pin_title[:90], fill=(15, 23, 42), font=font_title)
    y += 44
    draw.text((margin, y), f"{brand} {model}", fill=(59, 130, 246), font=font_sub)
    y += 36
    overall = scores.get("overall", 0.0)
    draw.text(
        (margin, y),
        f"OVERALL  {overall:.1f} / 10",
        fill=(30, 41, 59),
        font=_try_font(22, bold=True),
    )
    y += 40

    # Radar chart
    cx, cy = W // 2, y + 280
    R = 220
    axes = [
        ("SUPPORT", scores.get("support", 0)),
        ("COOLING", scores.get("cooling", 0)),
        ("PRESSURE", scores.get("pressure", 0)),
        ("DURABILITY", scores.get("durability", 0)),
        ("INTEGRITY", scores.get("overall", 0)),
    ]
    n = len(axes)
    pts: list[tuple[float, float]] = []
    for i, (_, val) in enumerate(axes):
        ang = -math.pi / 2 + i * (2 * math.pi / n)
        rad = max(0.0, min(10.0, float(val))) / 10.0 * R
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))

    # Grid rings
    for ring in (0.25, 0.5, 0.75, 1.0):
        ring_pts = []
        for i in range(n):
            ang = -math.pi / 2 + i * (2 * math.pi / n)
            ring_pts.append((cx + ring * R * math.cos(ang), cy + ring * R * math.sin(ang)))
        draw.polygon(ring_pts, outline=(203, 213, 225))
    # Spokes
    for i in range(n):
        ang = -math.pi / 2 + i * (2 * math.pi / n)
        x2 = cx + R * math.cos(ang)
        y2 = cy + R * math.sin(ang)
        draw.line([(cx, cy), (x2, y2)], fill=(226, 232, 240), width=2)
    # Data polygon (solid fill — readable on Pinterest)
    if len(pts) == n:
        draw.polygon(pts, fill=(191, 219, 254), outline=(37, 99, 235))

    # Axis labels
    for i, (label, _) in enumerate(axes):
        ang = -math.pi / 2 + i * (2 * math.pi / n)
        lx = cx + (R + 28) * math.cos(ang)
        ly = cy + (R + 28) * math.sin(ang)
        bbox = draw.textbbox((0, 0), label, font=font_axis)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        draw.text((lx - tw / 2, ly - th / 2), label, fill=(100, 116, 139), font=font_axis)

    y = cy + R + 56

    # Specs matrix snippet
    ad = _parse_json_field(row.get("audit_data"), {})
    matrix = ad.get("specs_matrix") if isinstance(ad, dict) else {}
    if not isinstance(matrix, dict):
        matrix = {}
    draw.text((margin, y), "SPECS MATRIX (excerpt)", fill=(15, 23, 42), font=_try_font(16, bold=True))
    y += 28
    for k, v in list(matrix.items())[:6]:
        line = f"{k.replace('_', ' ')}: {str(v)[:120]}"
        draw.text((margin, y), line, fill=(71, 85, 105), font=font_small)
        y += 22
        if y > H - margin - 80:
            break

    # Footer
    draw.text(
        (margin, H - margin - 36),
        "Sleep Choice · Forensic Audit · Specs Matrix",
        fill=(148, 163, 184),
        font=font_small,
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG", optimize=True)


def fetch_products(client, limit: int | None) -> list[dict[str, Any]]:
    q = (
        client.table("audit_products")
        .select(
            "slug, brand, model, audit_scores, technical_specs, audit_data, "
            "seo_title, seo_description, seo_keywords, audit_note, evidence_log, "
            "review_count, last_audited_at"
        )
        .order("last_audited_at", desc=True)
    )
    if limit is not None and limit > 0:
        q = q.limit(limit)
    res = q.execute()
    return list(res.data or [])


def main() -> int:
    parser = argparse.ArgumentParser(description="Export promo JSON, Pin PNGs, Reddit drafts.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent / "promo_output",
        help="Directory for promo_bundle.json, pins/, reddit_drafts/",
    )
    parser.add_argument("--base-url", type=str, default="", help="Canonical site origin (override env).")
    parser.add_argument("--limit", type=int, default=0, help="Max products (0 = all).")
    parser.add_argument("--json-only", action="store_true", help="Skip PNG + reddit files.")
    parser.add_argument("--skip-images", action="store_true", help="JSON + reddit only.")
    args = parser.parse_args()

    url = (os.getenv("SUPABASE_URL") or "").strip()
    key = (os.getenv("SUPABASE_KEY") or "").strip()
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_KEY.", file=sys.stderr)
        return 1

    base_url = (args.base_url or "").strip() or _resolve_base_url()
    out_dir = args.output_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    client = create_client(url, key)
    lim = args.limit if args.limit > 0 else None
    rows = fetch_products(client, lim)

    bundle: list[dict[str, Any]] = []
    for row in rows:
        scores = _normalize_scores(row.get("audit_scores"))
        pin = _pin_copy(row, scores, base_url)
        entry = {
            "slug": row.get("slug"),
            "brand": row.get("brand"),
            "model": row.get("model"),
            "last_audited_at": row.get("last_audited_at"),
            "audit_hash": _audit_hash_from_row(row),
            "audit_scores": scores,
            "seo_title": row.get("seo_title"),
            "seo_description": row.get("seo_description"),
            "seo_keywords": row.get("seo_keywords"),
            "pinterest_board": pin["pinterest_board"],
            "pin_title": pin["pin_title"],
            "pin_title_seo_variant": pin["pin_title_seo_variant"],
            "pin_description": pin["pin_description"],
            "pinterest_alt_text": pin["pinterest_alt_text"],
            "canonical_url": pin["canonical_url"],
            "review_count": row.get("review_count"),
        }
        bundle.append(entry)

    bundle_path = out_dir / "promo_bundle.json"
    meta = {
        "generated_at": datetime.now(UTC).isoformat(),
        "base_url": base_url,
        "product_count": len(bundle),
        "pinterest_boards": [
            {
                "name": "Saatva Forensic Audits",
                "hint": "Saatva SKUs — pain-hook titles + registry deep links",
            },
            {
                "name": "Organic Sleep Solutions (Sleep & Beyond)",
                "hint": "Sleep & Beyond — wool/organic pillows and bedding",
            },
            {
                "name": "Hotel-Luxury Bedding (FluffCo)",
                "hint": "FluffCo — comforter / silk / luxury positioning",
            },
            {
                "name": "Forensic Sleep Audits",
                "hint": "Fallback for other brands in the registry",
            },
        ],
    }
    bundle_path.write_text(
        json.dumps({"meta": meta, "products": bundle}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {bundle_path} ({len(bundle)} products).")

    matrix_path = out_dir / "pinterest_audit_matrix.json"
    matrix_doc = {
        "meta": meta,
        "pins": [
            {
                "slug": p["slug"],
                "pinterest_board": p["pinterest_board"],
                "pin_title": p["pin_title"],
                "pin_description": p["pin_description"],
                "pinterest_alt_text": p["pinterest_alt_text"],
                "canonical_url": p["canonical_url"],
                "local_image": f"pins/{p['slug']}.png",
            }
            for p in bundle
        ],
    }
    matrix_path.write_text(
        json.dumps(matrix_doc, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {matrix_path}")

    if args.json_only:
        return 0

    reddit_dir = out_dir / "reddit_drafts"
    reddit_dir.mkdir(parents=True, exist_ok=True)
    pins_dir = out_dir / "pins"
    if not args.skip_images:
        pins_dir.mkdir(parents=True, exist_ok=True)

    for row in rows:
        slug = str(row.get("slug") or "")
        if not slug:
            continue
        scores = _normalize_scores(row.get("audit_scores"))
        pin = _pin_copy(row, scores, base_url)
        draft_path = reddit_dir / f"{slug}.txt"
        draft_path.write_text(_reddit_draft(row, scores, base_url), encoding="utf-8")

        if not args.skip_images:
            try:
                render_pin_png(row, scores, pins_dir / f"{slug}.png", pin["pin_title"])
            except Exception as e:
                print(f"⚠️ PNG failed for {slug}: {e}", file=sys.stderr)

    print(f"Reddit drafts → {reddit_dir}")
    if not args.skip_images:
        print(f"Pinterest PNGs → {pins_dir}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
