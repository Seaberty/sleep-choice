#!/usr/bin/env python3
"""
Quick check: can we reach Reddit RSS through the same proxy/env as reddit_rss_monitor?

Run from repository root::

    python src/scripts/test/reddit_rss_connectivity.py

Uses ``.env`` / ``.env.local`` and ``PROXY_URL`` → ``HTTP_PROXY`` / ``HTTPS_PROXY``
the same way as ``reddit_rss_monitor.py``. Exits 0 on success, 1 on failure.
"""

from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

# src/scripts/test → repo root is four levels up
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_TEST_URL = "https://www.reddit.com/r/Mattress/new/.rss"
_TIMEOUT_SEC = 25
_USER_AGENT = "sleep-choice-reddit-connectivity-test/1.0"


def _mask_proxy(url: str) -> str:
    try:
        pr = urlparse(url)
        if pr.username or pr.password:
            host = pr.hostname or ""
            port = f":{pr.port}" if pr.port else ""
            return f"{pr.scheme}://***@{host}{port}"
        return url
    except Exception:
        return url[:48]


def _apply_proxy() -> None:
    proxy = (os.getenv("PROXY_URL") or "").strip()
    if proxy:
        os.environ["HTTP_PROXY"] = proxy
        os.environ["HTTPS_PROXY"] = proxy
        print(f"[proxy] PROXY_URL → urllib: {_mask_proxy(proxy)}", flush=True)
    else:
        print(
            "[proxy] PROXY_URL 未设置；若直接访问失败，可在 .env.local 设置 PROXY_URL",
            flush=True,
        )


def main() -> None:
    load_dotenv(_REPO_ROOT / ".env")
    load_dotenv(_REPO_ROOT / ".env.local")
    _apply_proxy()

    req = urllib.request.Request(
        _TEST_URL,
        headers={
            "User-Agent": _USER_AGENT,
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
        method="GET",
    )

    print(f"[fetch] GET {_TEST_URL}", flush=True)
    print(f"[fetch] timeout={_TIMEOUT_SEC}s（若卡住请看是否卡在代理或防火墙）", flush=True)

    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT_SEC) as resp:
            chunk = resp.read(8192)
    except TimeoutError as e:
        print(f"[fail] 超时: {e}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.HTTPError as e:
        print(f"[fail] HTTP {e.code}: {e.reason}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"[fail] URL error: {e.reason}", file=sys.stderr)
        sys.exit(1)
    except OSError as e:
        print(f"[fail] OS/socket: {e}", file=sys.stderr)
        sys.exit(1)

    n = len(chunk)
    preview = chunk[:200].decode("utf-8", errors="replace").replace("\n", " ")
    print(f"[ok] 读取首块 {n} 字节，看起来像 RSS/XML: {preview[:120]}…", flush=True)
    sys.exit(0)


if __name__ == "__main__":
    main()
