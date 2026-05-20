# -*- coding: utf-8 -*-
"""
Ping IndexNow (Bing, Yandex, etc.) with registry + static URLs after catalog updates.

Requires a key file on the live site: https://{host}/{INDEXNOW_KEY}.txt
(contents = the key string). Generate locally once:

  cd src/scripts && python indexnow_ping.py --write-key-file

Commit public/{key}.txt (or deploy via your host). Set the same value in
INDEXNOW_KEY (local .env / GitHub Actions secret).

Usage:
  python indexnow_ping.py
  python indexnow_ping.py --dry-run
  python indexnow_ping.py --limit 50
  python indexnow_ping.py --write-key-file

Env: INDEXNOW_KEY, NEXT_PUBLIC_SITE_URL (or SITE_URL), SUPABASE_URL, SUPABASE_KEY
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

_ROOT = Path(__file__).resolve().parents[2]
_ENV = _ROOT / ".env.local"
if not _ENV.is_file():
    _ENV = Path(__file__).resolve().parents[1] / ".env.local"
try:
    from dotenv import load_dotenv

    load_dotenv(dotenv_path=_ENV)
except ImportError:
    pass  # use shell env; install: pip install -r requirements.txt

INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
MAX_URLS_PER_POST = 10_000

STATIC_PATHS = [
    "/",
    "/about",
    "/best-picks",
    "/calculator",
    "/compare",
    "/guides",
    "/contact",
    "/deals",
    "/disclosure",
    "/docs",
    "/intelligence",
    "/lab",
    "/methodology",
    "/privacy",
    "/quiz",
    "/registry",
    "/terms",
]


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


def _site_origin() -> str:
    for key in ("NEXT_PUBLIC_SITE_URL", "SITE_URL", "VERCEL_URL"):
        raw = (os.getenv(key) or "").strip().rstrip("/")
        if raw:
            if key == "VERCEL_URL" and not raw.startswith("http"):
                raw = "https://" + raw.lstrip("/")
            return raw
    return "https://sleepchoiceguide.com"


def _is_listable(row: dict[str, Any]) -> bool:
    img = row.get("image_url") and str(row.get("image_url")).strip()
    if not img or img == "/placeholder-product.png":
        return False
    try:
        price_num = float(row.get("price"))
    except (TypeError, ValueError):
        return False
    return price_num > 0


def _seo_content_urls(repo_root: Path, base: str) -> list[str]:
    """Compare pair + guide URLs from src/data JSON (kept in sync with sitemap)."""
    out: list[str] = []
    data_dir = repo_root / "src" / "data"
    for filename, prefix in (
        ("compare-seo-pairs.json", "/compare/"),
        ("seo-guides.json", "/guides/"),
    ):
        path = data_dir / filename
        if not path.is_file():
            continue
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            print(f"Skip {filename}: {e}", file=sys.stderr)
            continue
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            if prefix == "/compare/":
                seg = str(row.get("pairSlug") or "").strip()
            else:
                seg = str(row.get("slug") or "").strip()
            if seg:
                out.append(f"{base}{prefix}{quote(seg, safe='')}")
    return out


def _collect_urls(origin: str, limit: int) -> list[str]:
    base = origin.rstrip("/")
    urls = [f"{base}{p}" for p in STATIC_PATHS]
    urls.extend(_seo_content_urls(_ROOT, base))

    url = (os.getenv("SUPABASE_URL") or "").strip()
    key = (os.getenv("SUPABASE_KEY") or "").strip()
    if url and key:
        try:
            from supabase import create_client

            client = create_client(url, key)
            res = (
                client.from_("audit_products")
                .select("slug, image_url, price")
                .execute()
            )
            rows = res.data or []
            for row in rows:
                if not _is_listable(row):
                    continue
                slug = str(row.get("slug") or "").strip()
                if not slug:
                    continue
                seg = quote(slug, safe="")
                urls.append(f"{base}/registry/{seg}")
        except Exception as e:
            print(f"Supabase URL fetch skipped: {e}", file=sys.stderr)

    # stable dedupe
    seen: set[str] = set()
    out: list[str] = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    if limit > 0:
        out = out[:limit]
    return out


def _host_from_origin(origin: str) -> str:
    parsed = urlparse(origin)
    if not parsed.netloc:
        raise ValueError(f"Invalid site origin: {origin}")
    return parsed.netloc


def _write_key_file(repo_root: Path, key: str) -> Path:
    k = key.strip()
    if not k or not re.fullmatch(r"[a-zA-Z0-9-]+", k):
        raise ValueError("INDEXNOW_KEY must be alphanumeric/hyphen (8–128 chars).")
    public = repo_root / "public"
    public.mkdir(parents=True, exist_ok=True)
    path = public / f"{k}.txt"
    path.write_text(k + "\n", encoding="utf-8")
    return path


def _post_indexnow(
    *,
    host: str,
    key: str,
    key_location: str,
    url_list: list[str],
    dry_run: bool,
) -> int:
    if not url_list:
        print("No URLs to submit.", file=sys.stderr)
        return 0

    chunks = [
        url_list[i : i + MAX_URLS_PER_POST]
        for i in range(0, len(url_list), MAX_URLS_PER_POST)
    ]
    for idx, chunk in enumerate(chunks):
        payload = {
            "host": host,
            "key": key,
            "keyLocation": key_location,
            "urlList": chunk,
        }
        if dry_run:
            print(
                f"[dry-run] chunk {idx + 1}/{len(chunks)}: {len(chunk)} URLs "
                f"(first: {chunk[0]})"
            )
            continue

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            INDEXNOW_ENDPOINT,
            data=data,
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                code = resp.getcode()
                print(f"IndexNow chunk {idx + 1}/{len(chunks)}: HTTP {code} ({len(chunk)} URLs)")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:500]
            print(
                f"IndexNow HTTP {e.code}: {body}",
                file=sys.stderr,
            )
            return 1
        except urllib.error.URLError as e:
            print(f"IndexNow request failed: {e}", file=sys.stderr)
            return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Submit sitemap URLs to IndexNow.")
    parser.add_argument(
        "--write-key-file",
        action="store_true",
        help=f"Write public/{{key}}.txt under repo root ({_ROOT})",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print URLs only.")
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Max URLs (0 = all).",
    )
    args = parser.parse_args()

    key = (os.getenv("INDEXNOW_KEY") or "").strip()
    if args.write_key_file:
        if not key:
            print("Set INDEXNOW_KEY before --write-key-file.", file=sys.stderr)
            return 1
        path = _write_key_file(_ROOT, key)
        print(f"Wrote {path}")
        print(f"Deploy then verify: {_site_origin().rstrip('/')}/{key}.txt")
        return 0

    if not key:
        print(
            "Missing INDEXNOW_KEY. Generate: openssl rand -hex 16",
            file=sys.stderr,
        )
        return 1

    origin = _site_origin()
    host = _host_from_origin(origin)
    key_location = f"{origin.rstrip('/')}/{key}.txt"

    urls = _collect_urls(origin, args.limit)
    print(f"Site: {origin} | URLs: {len(urls)} | keyLocation: {key_location}")

    return _post_indexnow(
        host=host,
        key=key,
        key_location=key_location,
        url_list=urls,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    raise SystemExit(main())
