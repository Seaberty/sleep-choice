#!/usr/bin/env python3
"""
Production Reddit RSS monitor: polls subreddit ``new`` and ``comments`` RSS feeds,
matches keywords, emails alerts.

RSS only — no Reddit API key required.

Environment variables (loaded from repo-root ``.env`` / ``.env.local``):

    GMAIL_USER   — Gmail address used to send mail (SMTP login).
    GMAIL_PASS   — Google App Password (not your normal Gmail password).
    GMAIL_TO     — Optional recipient; defaults to GMAIL_USER.

    PROXY_URL    — Optional; same convention as ``forensic_engine.py``: when set,
                   copied to ``HTTP_PROXY`` / ``HTTPS_PROXY`` so RSS fetches via
                   ``urllib`` use the proxy. You may also set ``HTTP_PROXY`` /
                   ``HTTPS_PROXY`` directly after loading ``.env``.
                   If Gmail SMTP fails directly (e.g. WinError 10054 / 10060), the
                   same ``PROXY_URL`` is reused with PySocks. By default SMTP tries
                   the proxy **before** direct dial (see ``GMAIL_SMTP_TRY_DIRECT_FIRST``).

    REDDIT_RSS_USER_AGENT — Optional full ``User-Agent`` string for RSS HTTP
        requests. If Reddit returns ``403 Blocked``, set this to a current
        desktop browser UA (see DevTools) or route traffic via ``PROXY_URL``.

    GMAIL_SMTP_TRY_DIRECT_FIRST — Set to ``1`` to try direct SMTP before the proxy.
    GMAIL_SMTP_DIRECT_TIMEOUT_SEC — Optional override for direct TCP timeout (seconds).

Run from repository root::

    python src/scripts/reddit_rss_monitor.py
    python src/scripts/reddit_rss_monitor.py --once   # single cycle (GitHub Actions)

State file (repository root): ``processed_posts.json``

**Strategy:** ``KEYWORDS_HIGH`` hit → classify thread topic → email only when
relevant to the affiliate catalog (see ``reddit_reply_engine.py``). Each alert
includes a contextual **Copy & Paste Audit Note** (not fixed brand scripts).

Set ``REDDIT_ALERT_SKIP_IRRELEVANT=0`` to still email off-topic hits with a SKIP draft.
"""

from __future__ import annotations

import argparse
import calendar
import html as html_module
import json
import logging
import os
import re
import smtplib
import ssl
import sys
import time
from contextlib import contextmanager
import urllib.error
import urllib.request
from urllib.error import HTTPError
from urllib.parse import urlparse
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from reddit_reply_engine import (
    BRAND_KEYWORDS,
    INTENT_KEYWORDS,
    ThreadAnalysis,
    analyze_thread,
    assert_reply_copy_safe,
    format_analysis_header,
    generate_reply_draft,
)

# -----------------------------------------------------------------------------
# Paths & constants
# -----------------------------------------------------------------------------

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
STATE_PATH = _REPO_ROOT / "processed_posts.json"

RSS_FEEDS = [
    "https://www.reddit.com/r/Mattress/new/.rss",
    "https://www.reddit.com/r/Bedding/new/.rss",
    "https://www.reddit.com/r/Sleep/new/.rss",
    # Recent comments (subreddit-wide); catches mentions in replies.
    "https://www.reddit.com/r/Mattress/comments/.rss",
    "https://www.reddit.com/r/Bedding/comments/.rss",
]

# --- Monitoring keywords (brand + intent; intent gated by topic in reply engine) ---
KEYWORDS_HIGH: list[str] = list(
    dict.fromkeys([*BRAND_KEYWORDS, *INTENT_KEYWORDS])
)
KEYWORDS_NORMAL: list[str] = []

KEYWORDS_HIGH_SET = frozenset(KEYWORDS_HIGH)
KEYWORDS_ALL: list[str] = list(dict.fromkeys(KEYWORDS_HIGH + KEYWORDS_NORMAL))

POLL_INTERVAL_SEC = 60
FETCH_TIMEOUT_SEC = 45

# Gmail: when PROXY_URL is set, try SMTP through the proxy first (typical for
# regions where smtp.gmail.com is unreachable directly). Direct attempts then
# use a shorter timeout so WinError 10060 does not block ~60s twice.
SMTP_TUNNEL_TIMEOUT_SEC = 60
SMTP_DIRECT_TIMEOUT_SEC = 60
SMTP_DIRECT_TIMEOUT_SHORT_SEC = 15


def _skip_irrelevant_alerts_enabled() -> bool:
    return os.getenv("REDDIT_ALERT_SKIP_IRRELEVANT", "1").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def format_copy_paste_audit_note(
    matches: list[str],
    haystack: str,
    *,
    title: str = "",
    summary: str = "",
) -> str:
    """Contextual draft for email alerts (topic-aware, not fixed lanes)."""
    t = title.strip() or haystack.split("\n", 1)[0].strip()
    s = summary.strip()
    if not s and "\n" in haystack:
        s = haystack.split("\n", 1)[1].strip()
    analysis = analyze_thread(
        t,
        s,
        matches,
        skip_irrelevant_alerts=_skip_irrelevant_alerts_enabled(),
    )
    return generate_reply_draft(analysis)


def audit_appendix(
    matches: list[str],
    haystack: str,
    *,
    title: str = "",
    summary: str = "",
) -> str:
    return format_copy_paste_audit_note(
        matches, haystack, title=title, summary=summary
    )


def reddit_rss_request_headers() -> dict[str, str]:
    """
    Headers for anonymous Reddit RSS fetches.

    Reddit often returns ``403 Blocked`` for bare script User-Agents or certain
    exit IPs. Set ``REDDIT_RSS_USER_AGENT`` in ``.env.local`` to a full browser
    string if needed (must stay compliant with Reddit's terms).
    """
    custom = (os.getenv("REDDIT_RSS_USER_AGENT") or "").strip()
    if custom:
        ua = custom
    else:
        ua = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 "
            "sleep-choice-rss-monitor/1.0 (SleepChoiceGuide RSS; no outbound links in replies)"
        )
    return {
        "User-Agent": ua,
        "Accept": (
            "application/rss+xml, application/atom+xml, application/xml, "
            "text/xml;q=0.9, */*;q=0.8"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.reddit.com/",
    }

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# Proxy (aligned with forensic_engine.py)
# -----------------------------------------------------------------------------


def format_proxy_for_log(server: str) -> str:
    """Mask credentials in proxy URL for logs (user:pass@host → ***@host)."""
    try:
        pr = urlparse(server)
        if pr.username or pr.password:
            host = pr.hostname or ""
            port = f":{pr.port}" if pr.port else ""
            return f"{pr.scheme}://***@{host}{port}"
        return server
    except Exception:
        return server[:48]


def apply_proxy_from_env() -> None:
    """
    If PROXY_URL is set, mirror it to HTTP_PROXY and HTTPS_PROXY.

    Matches ``forensic_engine.py`` so one variable configures httpx/playwright
    and this script's urllib RSS requests. Loaded after dotenv so ``.env.local``
    values apply.
    """
    proxy = (os.getenv("PROXY_URL") or "").strip()
    if not proxy:
        return
    os.environ["HTTP_PROXY"] = proxy
    os.environ["HTTPS_PROXY"] = proxy
    logger.info("Proxy enabled for RSS fetch: %s", format_proxy_for_log(proxy))


# -----------------------------------------------------------------------------
# State persistence
# -----------------------------------------------------------------------------


def load_processed_ids(path: Path) -> set[str]:
    """Load persisted entry ids from JSON; return empty set if missing or invalid."""
    if not path.exists():
        return set()
    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
        ids = data.get("processed_ids")
        if isinstance(ids, list):
            return {str(x) for x in ids}
    except (json.JSONDecodeError, OSError, TypeError) as e:
        logger.warning("Could not load state file %s: %s", path, e)
    return set()


def save_processed_ids(path: Path, ids: set[str]) -> None:
    """Atomically persist processed ids (sorted for stable diffs)."""
    payload = {"processed_ids": sorted(ids)}
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    try:
        path.write_text(text, encoding="utf-8")
    except OSError as e:
        logger.error("Failed to write state file %s: %s", path, e)


# -----------------------------------------------------------------------------
# Text & matching
# -----------------------------------------------------------------------------


def strip_html(raw: str | None) -> str:
    """Remove simple HTML tags and unescape entities for plain-text matching."""
    if not raw:
        return ""
    text = re.sub(r"<[^>]+>", " ", str(raw))
    text = html_module.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def entry_plain_summary(entry: Any) -> str:
    """Best-effort plain-text summary for an RSS/Atom entry."""
    for key in ("summary", "description", "content"):
        val = getattr(entry, key, None)
        if val is None and isinstance(entry, dict):
            val = entry.get(key)
        if not val:
            continue
        if isinstance(val, list) and val:
            val = val[0].get("value", val[0])
        if isinstance(val, str):
            return strip_html(val)
    return ""


def entry_id_for(entry: Any) -> str:
    """Stable id: prefer id, else link."""
    eid = getattr(entry, "id", None) or (
        entry.get("id", "") if isinstance(entry, dict) else ""
    )
    link = getattr(entry, "link", None) or (
        entry.get("link", "") if isinstance(entry, dict) else ""
    )
    out = (eid or link or "").strip()
    return out


def matched_keywords(haystack: str, keywords: list[str]) -> list[str]:
    """Return keywords whose lowercase form appears in haystack (substring)."""
    lower = haystack.lower()
    found: list[str] = []
    for kw in keywords:
        if kw.lower() in lower:
            found.append(kw)
    return found


def _reddit_feed_label(feed_url: str) -> str:
    """Human label for RSS source without emitting a paste-ready URL."""
    m = re.search(r"reddit\.com/r/([^/]+)(?:/([^/.]+))?", feed_url, re.I)
    if m:
        sub, kind = m.group(1), m.group(2) or "feed"
        return f"r/{sub}/{kind}"
    return "reddit RSS feed"


def reply_material_block(
    matches: list[str],
    post_link: str,
    entry_id: str,
    haystack: str,
    *,
    title: str = "",
    summary: str = "",
) -> str:
    """
    Alert footer: classification + operator post link + paste-safe draft.
    """
    t = title.strip() or haystack.split("\n", 1)[0].strip()
    s = summary.strip()
    if not s and "\n" in haystack:
        s = haystack.split("\n", 1)[1].strip()
    analysis = analyze_thread(
        t,
        s,
        matches,
        skip_irrelevant_alerts=_skip_irrelevant_alerts_enabled(),
    )
    notes = generate_reply_draft(analysis)
    assert_reply_copy_safe(notes, context="copy_paste_audit_note")
    link_line = post_link.strip() if post_link.strip() else "(none)"
    kw_line = ", ".join(matches)
    return (
        f"[Keywords]: {kw_line}\n"
        f"{format_analysis_header(analysis)}\n"
        f"[Post link]: {link_line}\n"
        f"[Entry id]: {entry_id or '(unknown)'}\n\n"
        f"[Suggested reply draft]\n"
        f"────────────────────────────────────────\n"
        f"{notes}\n"
        f"────────────────────────────────────────\n"
    )


def format_alert_email_body(
    title: str,
    post_link: str,
    entry_id: str,
    summary: str,
    feed_url: str,
    matches: list[str],
) -> str:
    """Email alert: includes Reddit post URL for you; paste block stays URL-free."""
    haystack = f"{title}\n{summary}"
    block = reply_material_block(
        matches,
        post_link,
        entry_id,
        haystack,
        title=title,
        summary=summary,
    )
    link_line = post_link.strip() if post_link.strip() else "(none)"
    return (
        f"Title: {title}\n"
        f"Post link: {link_line}\n"
        f"Entry id: {entry_id or '(unknown)'}\n"
        f"Summary: {summary or '(none)'}\n"
        f"Feed: {_reddit_feed_label(feed_url)}\n\n"
        f"{block}"
    )


# -----------------------------------------------------------------------------
# RSS fetch
# -----------------------------------------------------------------------------


def fetch_feed(url: str, timeout: int = FETCH_TIMEOUT_SEC):
    """
    Download and parse a feed URL with timeout and a polite User-Agent.

    Raises urllib.error.URLError on network failure, TimeoutError on timeout.
    """
    import feedparser

    req = urllib.request.Request(
        url,
        headers=reddit_rss_request_headers(),
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
    except HTTPError as e:
        if e.code == 403:
            logger.error(
                "Feed 403 Blocked %s — Reddit rejected the request (anti-bot / IP). "
                "Try: REDDIT_RSS_USER_AGENT=<browser UA from DevTools>, or change "
                "PROXY_URL / network.",
                url,
            )
        raise
    parsed = feedparser.parse(data)
    return parsed


def published_unix(entry: Any) -> int:
    """UTC unix time from feedparser's published_parsed, or 0."""
    t = getattr(entry, "published_parsed", None)
    if t:
        try:
            return int(calendar.timegm(t))
        except (TypeError, ValueError):
            pass
    return 0


def collect_entries_from_feeds(urls: list[str]) -> list[tuple[str, Any]]:
    """Fetch each feed URL; return list of (feed_url, entry). Logs errors per URL."""
    out: list[tuple[str, Any]] = []
    for url in urls:
        logger.info("Fetching RSS: %s", url)
        try:
            feed = fetch_feed(url)
        except TimeoutError as e:
            logger.error("Feed timeout %s: %s", url, e)
            continue
        except urllib.error.URLError as e:
            logger.error("Feed network error %s: %s", url, e)
            continue
        except OSError as e:
            logger.error("Feed OS error %s: %s", url, e)
            continue
        if getattr(feed, "bozo", False) and feed.bozo_exception:
            logger.warning(
                "Feed may be ill-formed %s: %s", url, feed.bozo_exception
            )
        entries = getattr(feed, "entries", None) or []
        logger.info("Fetched RSS ok: %s (%d entries)", url, len(entries))
        for entry in entries:
            out.append((url, entry))
    return out


# -----------------------------------------------------------------------------
# Email
# -----------------------------------------------------------------------------

_PROXY_ENV_KEYS = (
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
)


@contextmanager
def _smtp_direct_env():
    """
    Temporarily unset proxy env vars so SMTP uses a direct TCP route.

    RSS fetch needs PROXY_URL; Gmail SMTP should connect straight to Google.
    Some stacks mis-route SMTP when HTTP proxies are set globally (rare).
    """
    saved: dict[str, str] = {}
    for key in _PROXY_ENV_KEYS:
        if key in os.environ:
            saved[key] = os.environ.pop(key)
    try:
        yield
    finally:
        os.environ.update(saved)


def _smtp_upgrade_starttls_gmail(
    smtp: smtplib.SMTP, ctx: ssl.SSLContext
) -> None:
    """
    Perform STARTTLS with smtp.gmail.com as TLS server name.

    Python 3.9 and older ``SMTP.starttls`` have no ``server_hostname`` keyword.
    On ``TypeError`` we must issue the SMTP ``STARTTLS`` command *before*
    ``wrap_socket``. Wrapping the plaintext SMTP socket without that step
    produces ``[SSL: WRONG_VERSION_NUMBER]``.
    """
    try:
        smtp.starttls(context=ctx, server_hostname="smtp.gmail.com")
    except TypeError:
        code, reply = smtp.docmd("STARTTLS")
        if code != 220:
            raise smtplib.SMTPException(
                f"STARTTLS not accepted: {code} {reply!r}"
            )
        smtp.sock = ctx.wrap_socket(
            smtp.sock,
            server_hostname="smtp.gmail.com",
        )
        smtp.file = smtp.sock.makefile("rb")


def _send_gmail_starttls(
    msg: EmailMessage, user: str, password: str, *, timeout: float = 60
) -> None:
    """smtp.gmail.com:587 with STARTTLS."""
    ctx = ssl.create_default_context()
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=timeout) as smtp:
        smtp.ehlo()
        _smtp_upgrade_starttls_gmail(smtp, ctx)
        smtp.ehlo()
        smtp.login(user, password)
        smtp.send_message(msg)


def _send_gmail_ssl(
    msg: EmailMessage, user: str, password: str, *, timeout: float = 60
) -> None:
    """smtp.gmail.com:465 implicit TLS (fallback when 587 fails)."""
    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL(
        "smtp.gmail.com", 465, timeout=timeout, context=ctx
    ) as smtp:
        smtp.login(user, password)
        smtp.send_message(msg)


def _tcp_through_proxy_socket(
    proxy_url: str, dest_host: str, dest_port: int, timeout: float
):
    """
    Open TCP to dest_host:dest_port through PROXY_URL using PySocks.

    Supports http(s), socks5, socks4. Used when Gmail SMTP is blocked on a
    direct path but the same local proxy can reach Google.
    """
    try:
        import socks
    except ImportError as e:
        raise RuntimeError(
            "SMTP via proxy requires PySocks: pip install PySocks"
        ) from e

    pr = urlparse(proxy_url.strip())
    scheme = (pr.scheme or "http").lower().replace("socks5h", "socks5")
    phost = pr.hostname
    pport = pr.port
    if not phost:
        raise ValueError(f"Invalid PROXY_URL for SMTP tunnel: {proxy_url!r}")
    if pport is None:
        pport = 8080 if scheme in ("http", "https") else 1080

    sock = socks.socksocket()
    if scheme in ("http", "https"):
        sock.set_proxy(socks.HTTP, phost, pport)
    elif scheme in ("socks5", "socks"):
        sock.set_proxy(socks.SOCKS5, phost, pport)
    elif scheme == "socks4":
        sock.set_proxy(socks.SOCKS4, phost, pport)
    else:
        raise ValueError(
            f"Unsupported proxy scheme {scheme!r} for SMTP (use http, socks5, socks4)."
        )

    sock.settimeout(timeout)
    sock.connect((dest_host, dest_port))
    return sock


class _SMTPViaProxy(smtplib.SMTP):
    """SMTP client that dials through PROXY_URL (HTTP CONNECT or SOCKS)."""

    def __init__(self, proxy_url: str, **kwargs):
        self._proxy_url = proxy_url.strip()
        super().__init__(**kwargs)

    def _get_socket(self, host, port, timeout):
        to = float(timeout if timeout is not None else self.timeout or 60)
        return _tcp_through_proxy_socket(self._proxy_url, host, port, to)


def _send_gmail_starttls_via_proxy(
    msg: EmailMessage,
    user: str,
    password: str,
    proxy_url: str,
    *,
    timeout: float = SMTP_TUNNEL_TIMEOUT_SEC,
) -> None:
    """STARTTLS on 587 with TCP tunnelled through proxy."""
    ctx = ssl.create_default_context()
    with _SMTPViaProxy(proxy_url, timeout=timeout) as smtp:
        smtp.connect("smtp.gmail.com", 587)
        smtp.ehlo()
        _smtp_upgrade_starttls_gmail(smtp, ctx)
        smtp.ehlo()
        smtp.login(user, password)
        smtp.send_message(msg)


def _send_gmail_ssl_via_proxy(
    msg: EmailMessage,
    user: str,
    password: str,
    proxy_url: str,
    *,
    sock_timeout: float = SMTP_TUNNEL_TIMEOUT_SEC,
) -> None:
    """Implicit TLS on 465 with TCP tunnelled through proxy."""
    ctx = ssl.create_default_context()
    raw = _tcp_through_proxy_socket(
        proxy_url, "smtp.gmail.com", 465, sock_timeout
    )
    ssl_sock = ctx.wrap_socket(raw, server_hostname="smtp.gmail.com")
    smtp = smtplib.SMTP(timeout=sock_timeout)
    smtp.sock = ssl_sock
    smtp.file = ssl_sock.makefile("rb")
    (code, reply) = smtp.getreply()
    if code != 220:
        raise smtplib.SMTPConnectError(code, reply)
    smtp.ehlo()
    smtp.login(user, password)
    smtp.send_message(msg)
    smtp.quit()


def _smtp_try_direct(
    msg: EmailMessage,
    user: str,
    password: str,
    *,
    timeout: float,
) -> str | None:
    """
    Try direct 587 then 465. Returns route label on success.

    Uses ``_smtp_direct_env()`` so global HTTP_PROXY does not affect the socket.
    """
    with _smtp_direct_env():
        try:
            _send_gmail_starttls(msg, user, password, timeout=timeout)
            return "STARTTLS:587 direct"
        except (OSError, ssl.SSLError, smtplib.SMTPException) as e:
            logger.warning("Gmail direct STARTTLS failed: %s", e)
        try:
            _send_gmail_ssl(msg, user, password, timeout=timeout)
            return "SMTP_SSL:465 direct"
        except (OSError, ssl.SSLError, smtplib.SMTPException) as e2:
            logger.warning("Gmail direct SMTP_SSL failed: %s", e2)
    return None


def _smtp_try_proxy(
    msg: EmailMessage, user: str, password: str, proxy_url: str
) -> str | None:
    """Try STARTTLS and SMTP_SSL through PROXY_URL (PySocks)."""
    try:
        _send_gmail_starttls_via_proxy(msg, user, password, proxy_url)
        return "STARTTLS:587 via PROXY_URL"
    except (OSError, ssl.SSLError, smtplib.SMTPException, RuntimeError, ValueError) as e:
        logger.warning("Gmail STARTTLS via proxy failed: %s", e)
    try:
        _send_gmail_ssl_via_proxy(msg, user, password, proxy_url)
        return "SMTP_SSL:465 via PROXY_URL"
    except (OSError, ssl.SSLError, smtplib.SMTPException, RuntimeError, ValueError) as e:
        logger.warning("Gmail SMTP_SSL via proxy failed: %s", e)
    return None


def send_email(subject: str, body: str) -> None:
    """
    Send plain-text via Gmail using GMAIL_USER / GMAIL_PASS.

    If ``PROXY_URL`` is set, **SMTP via proxy is tried first** (same idea as RSS),
    then a short-timeout direct fallback — avoids WinError 10060 long waits when
    Google SMTP is unreachable directly.

    Set ``GMAIL_SMTP_TRY_DIRECT_FIRST=1`` to use direct-then-proxy instead.

    Optional: ``GMAIL_SMTP_DIRECT_TIMEOUT_SEC`` overrides the direct TCP timeout
    (seconds).
    """
    user = os.environ.get("GMAIL_USER", "").strip()
    # App passwords are often pasted as "xxxx xxxx xxxx xxxx"; Gmail expects no spaces.
    password = os.environ.get("GMAIL_PASS", "").strip().replace(" ", "")
    to_addr = os.environ.get("GMAIL_TO", "").strip() or user
    proxy_url = (os.environ.get("PROXY_URL") or "").strip()
    prefer_direct_first = os.getenv(
        "GMAIL_SMTP_TRY_DIRECT_FIRST", ""
    ).strip().lower() in ("1", "true", "yes")

    raw_direct_timeout = os.getenv("GMAIL_SMTP_DIRECT_TIMEOUT_SEC", "").strip()
    direct_timeout_override: float | None = None
    if raw_direct_timeout:
        try:
            direct_timeout_override = float(raw_direct_timeout)
        except ValueError:
            logger.warning(
                "Ignoring invalid GMAIL_SMTP_DIRECT_TIMEOUT_SEC=%r",
                raw_direct_timeout,
            )

    if not user or not password:
        raise RuntimeError(
            "GMAIL_USER and GMAIL_PASS must be set (Google App Password)."
        )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = user
    msg["To"] = to_addr
    msg.set_content(body)

    if direct_timeout_override is not None:
        t_direct = direct_timeout_override
    elif proxy_url and not prefer_direct_first:
        # Second-stage direct after proxy failed: fail fast
        t_direct = float(SMTP_DIRECT_TIMEOUT_SHORT_SEC)
    else:
        t_direct = float(SMTP_DIRECT_TIMEOUT_SEC)

    route: str | None = None

    if proxy_url and not prefer_direct_first:
        logger.info(
            "Gmail SMTP: trying PROXY_URL first "
            "(set GMAIL_SMTP_TRY_DIRECT_FIRST=1 to try direct first).",
        )
        route = _smtp_try_proxy(msg, user, password, proxy_url)
        if route is None:
            logger.info(
                "Gmail SMTP: proxy failed; trying direct (timeout=%ss).",
                t_direct,
            )
            route = _smtp_try_direct(msg, user, password, timeout=t_direct)
    else:
        if proxy_url and prefer_direct_first:
            logger.info(
                "Gmail SMTP: trying direct first (GMAIL_SMTP_TRY_DIRECT_FIRST=1).",
            )
        route = _smtp_try_direct(msg, user, password, timeout=t_direct)
        if route is None and proxy_url:
            logger.info("Gmail SMTP: direct failed; trying PROXY_URL.")
            route = _smtp_try_proxy(msg, user, password, proxy_url)

    if route is not None:
        logger.info(
            "Sent email to %s via %s subject=%r",
            to_addr,
            route,
            subject[:120],
        )
        return

    if not proxy_url:
        raise RuntimeError(
            "Gmail SMTP failed (direct smtp.gmail.com 587/465). "
            "WinError 10060 means timeout — no route or firewall. "
            "Set PROXY_URL and pip install PySocks to tunnel through your client.",
        )

    raise RuntimeError(
        "Gmail SMTP failed after proxy and direct attempts. "
        "Confirm PySocks is installed, PROXY_URL uses http or socks5 as your "
        "proxy expects, and the proxy allows CONNECT to smtp.gmail.com:587/465.",
    )


def load_env() -> None:
    """Load dotenv from repository root (``.env`` then ``.env.local``)."""
    load_dotenv(_REPO_ROOT / ".env")
    load_dotenv(_REPO_ROOT / ".env.local")
    apply_proxy_from_env()


# -----------------------------------------------------------------------------
# Main loop
# -----------------------------------------------------------------------------


def process_cycle(processed: set[str]) -> None:
    """Fetch RSS → match KEYWORDS_HIGH → email → persist processed ids."""
    dirty = False

    logger.info(
        "RSS fetch cycle starting (%d feeds, timeout %ss each)",
        len(RSS_FEEDS),
        FETCH_TIMEOUT_SEC,
    )
    pairs = collect_entries_from_feeds(RSS_FEEDS)
    pairs.sort(key=lambda p: published_unix(p[1]))

    n_feed_entries = len(pairs)
    n_skip_tracked = 0
    n_no_keyword = 0
    n_skip_irrelevant = 0
    n_alerted = 0
    n_email_failed = 0

    for feed_url, entry in pairs:
        eid = entry_id_for(entry)
        if not eid:
            logger.warning("Skipping entry without id/link from %s", feed_url)
            continue
        if eid in processed:
            n_skip_tracked += 1
            continue

        title = getattr(entry, "title", "") or ""
        if not isinstance(title, str):
            title = str(title)
        summary_plain = entry_plain_summary(entry)
        post_link = getattr(entry, "link", "") or ""
        if not isinstance(post_link, str):
            post_link = str(post_link)
        haystack = f"{title}\n{summary_plain}"
        matches = matched_keywords(haystack, KEYWORDS_ALL)
        high_hits = [m for m in matches if m in KEYWORDS_HIGH_SET]

        if not high_hits:
            processed.add(eid)
            dirty = True
            n_no_keyword += 1
            continue

        analysis = analyze_thread(
            title,
            summary_plain or "",
            high_hits,
            skip_irrelevant_alerts=_skip_irrelevant_alerts_enabled(),
        )
        if not analysis.should_alert:
            processed.add(eid)
            dirty = True
            n_skip_irrelevant += 1
            logger.info(
                "SKIP irrelevant (no email) | topic=%s | keywords=%s | id=%s | %s",
                analysis.topic,
                ", ".join(high_hits),
                eid,
                analysis.skip_reason or "",
            )
            continue

        body = format_alert_email_body(
            title,
            post_link,
            eid,
            summary_plain or "",
            feed_url,
            high_hits,
        )
        subject = (
            f"[Reddit/{analysis.action}] {analysis.topic} | "
            f"{', '.join(high_hits)} — {title[:60]}"
        )
        logger.info(
            "HIGH match → email | action=%s topic=%s lane=%s | keywords=%s | id=%s | title=%r",
            analysis.action,
            analysis.topic,
            analysis.lane or "-",
            ", ".join(high_hits),
            eid,
            title[:120],
        )
        try:
            send_email(subject=subject, body=body)
        except Exception:
            logger.exception("Alert email failed | id=%s", eid)
            n_email_failed += 1
            continue

        processed.add(eid)
        dirty = True
        n_alerted += 1

    if dirty:
        save_processed_ids(STATE_PATH, processed)

    logger.info(
        "Cycle done: entries=%d, skip_tracked=%d, no_match=%d, "
        "skip_irrelevant=%d, alerted=%d, failed=%d | poll=%ss",
        n_feed_entries,
        n_skip_tracked,
        n_no_keyword,
        n_skip_irrelevant,
        n_alerted,
        n_email_failed,
        POLL_INTERVAL_SEC,
    )


def preview_reply(title: str, summary: str, keywords: str) -> None:
    """CLI helper: classify a thread and print the draft without RSS."""
    matches = [k.strip() for k in keywords.split(",") if k.strip()]
    if not matches:
        matches = matched_keywords(f"{title}\n{summary}", KEYWORDS_ALL)
    analysis = analyze_thread(
        title,
        summary,
        matches,
        skip_irrelevant_alerts=_skip_irrelevant_alerts_enabled(),
    )
    print(format_analysis_header(analysis))
    print()
    print(generate_reply_draft(analysis))


def run_once() -> None:
    """Single RSS poll + email step; for CI (e.g. GitHub Actions)."""
    load_env()
    processed = load_processed_ids(STATE_PATH)
    logger.info(
        "Reddit RSS monitor — single run | state=%s (%d ids)",
        STATE_PATH,
        len(processed),
    )
    print(datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z"), flush=True)
    try:
        process_cycle(processed)
    except Exception as e:
        logger.exception("Cycle error: %s", e)
        raise


def run_forever() -> None:
    """Poll RSS every ``POLL_INTERVAL_SEC``."""
    load_env()
    processed = load_processed_ids(STATE_PATH)
    tz_name = datetime.now().astimezone().tzname()
    logger.info(
        "Starting Reddit RSS monitor | state=%s (%d ids) | poll=%ss | "
        "KEYWORDS_HIGH=%s | tz=%s",
        STATE_PATH,
        len(processed),
        POLL_INTERVAL_SEC,
        ", ".join(KEYWORDS_HIGH),
        tz_name,
    )

    while True:
        now = datetime.now().astimezone()
        print(now.strftime("%Y-%m-%d %H:%M:%S %Z"), flush=True)
        try:
            process_cycle(processed)
        except Exception as e:
            logger.exception("Cycle error (continuing): %s", e)
        time.sleep(float(POLL_INTERVAL_SEC))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Reddit RSS keyword monitor → Gmail (see module docstring).",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single poll cycle then exit (for GitHub Actions / cron).",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Print topic classification + reply draft for --title/--summary (no RSS).",
    )
    parser.add_argument("--title", default="", help="Post title for --preview.")
    parser.add_argument("--summary", default="", help="Post body for --preview.")
    parser.add_argument(
        "--keywords",
        default="",
        help="Comma-separated keyword hits for --preview (default: auto-detect).",
    )
    args = parser.parse_args()

    try:
        if args.preview:
            load_env()
            preview_reply(args.title, args.summary, args.keywords)
        elif args.once:
            run_once()
        else:
            run_forever()
    except KeyboardInterrupt:
        print("\nStopped by user.", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
