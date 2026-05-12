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

    GMAIL_SMTP_TRY_DIRECT_FIRST — Set to ``1`` to try direct SMTP before the proxy.
    GMAIL_SMTP_DIRECT_TIMEOUT_SEC — Optional override for direct TCP timeout (seconds).

Run from repository root::

    python src/scripts/reddit_rss_monitor.py

State file (repository root): ``processed_posts.json``

**Strategy:** Brand / high-priority keywords trigger **immediate** email. Broad
(normal) keywords go to ``pending_normal_alerts`` and are sent as **one digest**
every ``BATCH_SEND_INTERVAL`` seconds. Pending queue is **not** persisted.

Each alert includes a **reply template** block (Detected Topic / Direct Link /
Copy & Paste Audit Note). The main loop adjusts sleep so digest deadlines are
not missed by a full poll interval when the queue is non-empty.
"""

from __future__ import annotations

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
from urllib.parse import urlparse
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path
from typing import Any

import feedparser
from dotenv import load_dotenv

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

# --- Monitoring keywords (decoupled from reply snippets) ---
HIGH_PRIORITY_KEYWORDS: list[str] = [
    "Saatva",
    "Sleep & Beyond",
    "FluffCo",
    "MyMerino",
]
NORMAL_PRIORITY_KEYWORDS: list[str] = [
    "back pain",
    "hot sleeper",
    "mattress review",
    "topper",
]

HIGH_PRIORITY_SET = frozenset(HIGH_PRIORITY_KEYWORDS)
NORMAL_PRIORITY_SET = frozenset(NORMAL_PRIORITY_KEYWORDS)
# Scan union; routing uses tier sets.
ALL_MONITOR_KEYWORDS: list[str] = list(
    dict.fromkeys(HIGH_PRIORITY_KEYWORDS + NORMAL_PRIORITY_KEYWORDS)
)

POLL_INTERVAL_SEC = 60
FETCH_TIMEOUT_SEC = 45

# Normal-tier alerts: one digest email every 30 minutes.
BATCH_SEND_INTERVAL = 1800

# In-memory queue for normal-priority leads (not persisted).
# Keys: entry_id, title, link, summary, matches, feed_url.
pending_normal_alerts: list[dict[str, Any]] = []
# ``time.monotonic()`` deadline for the next digest send (wall-clock–stable intervals).
_next_digest_deadline: float = 0.0

# Gmail: when PROXY_URL is set, try SMTP through the proxy first (typical for
# regions where smtp.gmail.com is unreachable directly). Direct attempts then
# use a shorter timeout so WinError 10060 does not block ~60s twice.
SMTP_TUNNEL_TIMEOUT_SEC = 60
SMTP_DIRECT_TIMEOUT_SEC = 60
SMTP_DIRECT_TIMEOUT_SHORT_SEC = 15

# Reply paste-board lines keyed by exact keyword strings from ALL_MONITOR_KEYWORDS.
AUDIT_SNIPPETS_BY_KEYWORD: dict[str, str] = {
    "Saatva": (
        "Audit Data: Saatva scores 9.2 in Spinal Alignment. "
        "Note: Premium build, edge support is top-tier."
    ),
    "Sleep & Beyond": (
        "Audit Data: Sleep & Beyond MyMerino scores 9.5 in Breathability. "
        "Note: 100% Organic Wool, best for hot sleepers."
    ),
    "FluffCo": (
        "Audit Data: FluffCo Down Comforter scores 8.8 in Value-for-money. "
        "Note: Hotel-quality specs at 50% price."
    ),
    "MyMerino": (
        "Audit Data: MyMerino wool layers score highly on breathability and "
        "temperature regulation vs. synthetic fills."
    ),
    "back pain": (
        "Audit Data: For back pain, our database suggests Saatva (9.2) or "
        "luxury hybrids with targeted lumbar support."
    ),
    "hot sleeper": (
        "Audit Data: Hot sleepers prioritize breathable materials (wool, latex) "
        "and moisture-wicking covers — see wool/airflow audits in our database."
    ),
    "mattress review": (
        "Audit Data: Cross-check reviews against our spinal alignment and "
        "durability scores before trusting star ratings alone."
    ),
    "topper": (
        "Audit Data: Topper fixes depend on firmness gap — latex/wool toppers "
        "for pressure relief without sacrificing support."
    ),
}

USER_AGENT = (
    "sleep-choice-reddit-rss-monitor/1.0 "
    "(contact: local script; +https://www.reddit.com/wiki/api)"
)

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


def reply_material_block(matches: list[str], link: str) -> str:
    """
    Required footer for every alert (immediate or digest): detected topic, link,
    and audit paste notes keyed by matched keywords.
    """
    topics = ", ".join(matches)
    paste_parts: list[str] = []
    for kw in matches:
        snip = AUDIT_SNIPPETS_BY_KEYWORD.get(kw)
        if snip:
            paste_parts.append(snip)
    notes = (
        "\n\n".join(paste_parts)
        if paste_parts
        else "(No canned snippet for these topics — compose manually.)"
    )
    return (
        f"[Detected Topic]: {topics}\n"
        f"[Direct Link]: {link}\n"
        f"[Copy & Paste Audit Note]:\n"
        f"{notes}\n"
    )


def format_alert_email_body(
    title: str,
    link: str,
    summary: str,
    feed_url: str,
    matches: list[str],
) -> str:
    """Full plaintext body for one Reddit lead including reply template."""
    block = reply_material_block(matches, link)
    return (
        f"Title: {title}\n"
        f"Link: {link}\n"
        f"Summary: {summary or '(none)'}\n"
        f"Feed: {feed_url}\n\n"
        f"{block}"
    )


# -----------------------------------------------------------------------------
# Digest batch email
# -----------------------------------------------------------------------------


def build_digest_subject(items: list[dict[str, Any]]) -> str:
    """Subject line like ``[Reddit Digest] 5 New Leads Found (back pain, topper…)``."""
    n = len(items)
    ordered: list[str] = []
    seen: set[str] = set()
    for it in items:
        for m in it.get("matches") or []:
            if m not in seen:
                seen.add(m)
                ordered.append(m)
    preview = ", ".join(ordered[:6])
    if len(ordered) > 6:
        preview += ", ..."
    return f"[Reddit Digest] {n} New Leads Found ({preview})"


def send_digest_email(processed: set[str], items: list[dict[str, Any]]) -> None:
    """One email with all normal-tier leads; marks each ``entry_id`` processed."""
    chunks: list[str] = []
    for i, it in enumerate(items, 1):
        title = it.get("title", "")
        link = it.get("link", "")
        summary = it.get("summary") or ""
        feed_url = it.get("feed_url", "")
        matches = it.get("matches") or []
        body_one = format_alert_email_body(
            title, link, summary, feed_url, matches
        )
        chunks.append(f"--- Lead {i} ---\n{body_one}")
    body = "\n".join(chunks)
    subject = build_digest_subject(items)
    send_email(subject=subject, body=body)
    for it in items:
        processed.add(it["entry_id"])


# -----------------------------------------------------------------------------
# RSS fetch
# -----------------------------------------------------------------------------


def fetch_feed(url: str, timeout: int = FETCH_TIMEOUT_SEC) -> feedparser.FeedParserDict:
    """
    Download and parse a feed URL with timeout and a polite User-Agent.

    Raises urllib.error.URLError on network failure, TimeoutError on timeout.
    """
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
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
# Main loop — routing, digest deadline, adaptive sleep
# -----------------------------------------------------------------------------


def _try_flush_normal_digest(processed: set[str]) -> tuple[bool, int]:
    """
    If ``pending_normal_alerts`` is non-empty and ``_next_digest_deadline`` has
    passed, send one digest email and slide the deadline forward by
    ``BATCH_SEND_INTERVAL``.
    """
    global pending_normal_alerts, _next_digest_deadline

    if not pending_normal_alerts:
        return False, 0
    if time.monotonic() < _next_digest_deadline:
        return False, 0

    batch = list(pending_normal_alerts)
    try:
        send_digest_email(processed, batch)
    except Exception:
        logger.exception(
            "NORMAL digest email failed (%d leads remain queued)", len(batch)
        )
        return False, 0

    n = len(batch)
    pending_normal_alerts.clear()
    _next_digest_deadline = time.monotonic() + BATCH_SEND_INTERVAL
    logger.info(
        "NORMAL digest email sent | bundled_leads=%d | next_digest_in=%ss",
        n,
        BATCH_SEND_INTERVAL,
    )
    return True, n


def compute_poll_sleep_seconds() -> float:
    """
    Default ``POLL_INTERVAL_SEC``, but wake sooner when a digest deadline is
    near so batched mail is not delayed by a full poll interval.
    """
    if not pending_normal_alerts:
        return float(POLL_INTERVAL_SEC)
    gap = _next_digest_deadline - time.monotonic()
    if gap <= 0:
        return 1.0
    return min(float(POLL_INTERVAL_SEC), gap)


def process_cycle(processed: set[str]) -> None:
    """RSS poll + HIGH immediate email + NORMAL queue + timed digest flush."""
    global pending_normal_alerts

    dirty = False
    digest_leads_flushed = 0
    digest_emails_sent = 0

    flushed, n_flush = _try_flush_normal_digest(processed)
    if flushed:
        dirty = True
        digest_leads_flushed += n_flush
        digest_emails_sent += 1

    logger.info(
        "RSS fetch cycle starting (%d feeds, timeout %ss each)",
        len(RSS_FEEDS),
        FETCH_TIMEOUT_SEC,
    )
    pairs = collect_entries_from_feeds(RSS_FEEDS)
    pairs.sort(key=lambda p: published_unix(p[1]))

    n_feed_entries = len(pairs)
    n_skip_already_tracked = 0
    n_skip_pending = 0
    n_new_no_keyword = 0
    n_high_immediate = 0
    n_normal_queued_cycle = 0
    n_email_failed = 0

    pending_ids = {p["entry_id"] for p in pending_normal_alerts}

    for feed_url, entry in pairs:
        eid = entry_id_for(entry)
        if not eid:
            logger.warning("Skipping entry without id/link from %s", feed_url)
            continue
        if eid in processed:
            n_skip_already_tracked += 1
            continue
        if eid in pending_ids:
            n_skip_pending += 1
            continue

        title = getattr(entry, "title", "") or ""
        if not isinstance(title, str):
            title = str(title)
        summary_plain = entry_plain_summary(entry)
        link = getattr(entry, "link", "") or ""
        haystack = f"{title}\n{summary_plain}"
        matches = matched_keywords(haystack, ALL_MONITOR_KEYWORDS)

        if not matches:
            processed.add(eid)
            dirty = True
            n_new_no_keyword += 1
            continue

        if HIGH_PRIORITY_SET.intersection(matches):
            body = format_alert_email_body(
                title,
                link,
                summary_plain or "",
                feed_url,
                matches,
            )
            subject = f"[Reddit HIGH] {', '.join(matches)} — {title[:80]}"
            logger.info(
                "HIGH priority → immediate email | keywords=%s | id=%s | title=%r",
                ", ".join(matches),
                eid,
                title[:120],
            )
            try:
                send_email(subject=subject, body=body)
            except Exception:
                logger.exception("HIGH priority email failed | id=%s", eid)
                n_email_failed += 1
                continue
            processed.add(eid)
            dirty = True
            n_high_immediate += 1
            continue

        if NORMAL_PRIORITY_SET.intersection(matches):
            pending_normal_alerts.append(
                {
                    "entry_id": eid,
                    "title": title,
                    "link": link,
                    "summary": summary_plain or "",
                    "matches": matches,
                    "feed_url": feed_url,
                }
            )
            pending_ids.add(eid)
            n_normal_queued_cycle += 1
            logger.info(
                "NORMAL priority → digest queue | keywords=%s | queue_size=%d | "
                "id=%s | title=%r",
                ", ".join(matches),
                len(pending_normal_alerts),
                eid,
                title[:120],
            )
            continue

        processed.add(eid)
        dirty = True

    flushed2, n_flush2 = _try_flush_normal_digest(processed)
    if flushed2:
        dirty = True
        digest_leads_flushed += n_flush2
        digest_emails_sent += 1

    if dirty:
        save_processed_ids(STATE_PATH, processed)

    logger.info(
        "Cycle done: entries=%d, skip_tracked=%d, skip_pending=%d, "
        "no_keyword=%d, HIGH_immediate=%d, NORMAL_queued_cycle=%d, "
        "pending_backlog=%d, digest_flush_leads=%d, digest_emails=%d, "
        "failed=%d | poll=%ss digest_every=%ss",
        n_feed_entries,
        n_skip_already_tracked,
        n_skip_pending,
        n_new_no_keyword,
        n_high_immediate,
        n_normal_queued_cycle,
        len(pending_normal_alerts),
        digest_leads_flushed,
        digest_emails_sent,
        n_email_failed,
        POLL_INTERVAL_SEC,
        BATCH_SEND_INTERVAL,
    )


def run_forever() -> None:
    """Poll RSS on an adaptive interval; digest deadlines are not overslept."""
    global _next_digest_deadline

    load_env()
    processed = load_processed_ids(STATE_PATH)
    _next_digest_deadline = time.monotonic() + BATCH_SEND_INTERVAL
    tz_name = datetime.now().astimezone().tzname()
    logger.info(
        "Starting Reddit RSS monitor | state=%s (%d ids) | poll<=%ss | "
        "digest_deadline_interval=%ss | HIGH=%s | NORMAL=%s | tz=%s",
        STATE_PATH,
        len(processed),
        POLL_INTERVAL_SEC,
        BATCH_SEND_INTERVAL,
        ", ".join(HIGH_PRIORITY_KEYWORDS),
        ", ".join(NORMAL_PRIORITY_KEYWORDS),
        tz_name,
    )

    while True:
        now = datetime.now().astimezone()
        print(now.strftime("%Y-%m-%d %H:%M:%S %Z"), flush=True)
        try:
            process_cycle(processed)
        except Exception as e:
            logger.exception("Cycle error (continuing): %s", e)
        time.sleep(max(1.0, compute_poll_sleep_seconds()))


def main() -> None:
    try:
        run_forever()
    except KeyboardInterrupt:
        print("\nStopped by user.", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
