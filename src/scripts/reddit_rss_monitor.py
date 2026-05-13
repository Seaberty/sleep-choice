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

    NEXT_PUBLIC_SITE_URL — Optional; canonical site root (no trailing slash).
        Used to build absolute links in Copy & Paste audit notes (``scg_url``);
        defaults to ``https://sleepchoiceguide.com`` (see ``src/lib/site-origin.ts``).

    REDDIT_RSS_USER_AGENT — Optional full ``User-Agent`` string for RSS HTTP
        requests. If Reddit returns ``403 Blocked``, set this to a current
        desktop browser UA (see DevTools) or route traffic via ``PROXY_URL``.

    SUPABASE_URL / SUPABASE_KEY — **Required** for reply-template numbers and links:
        candidates are read from ``audit_products``, compared on ``audit_scores``, and
        the **only** outbound audit URL is ``/registry/{slug}`` for the winning row
        (same page as the live registry dossier).

    REDDIT_REPLY_CANDIDATE_SLUGS_THERMAL — Optional comma-separated slugs to restrict
        tier-A / wool-pivot comparisons (otherwise brand/slug heuristics query the DB).

    REDDIT_REPLY_CANDIDATE_SLUGS_FLUFFCO — Same for tier-B (FluffCo-style picks).

    REDDIT_REPLY_CANDIDATE_SLUGS_SAATVA — Same for tier-C (Saatva picks).

    GMAIL_SMTP_TRY_DIRECT_FIRST — Set to ``1`` to try direct SMTP before the proxy.
    GMAIL_SMTP_DIRECT_TIMEOUT_SEC — Optional override for direct TCP timeout (seconds).

Run from repository root::

    python src/scripts/reddit_rss_monitor.py
    python src/scripts/reddit_rss_monitor.py --once   # single cycle (GitHub Actions)

State file (repository root): ``processed_posts.json``

**Strategy:** Brand / high-priority keywords trigger **immediate** email. Broad
(normal) keywords go to ``pending_normal_alerts`` and are sent as **one digest**
every ``BATCH_SEND_INTERVAL`` seconds. Pending queue is **not** persisted.

Each alert includes a **reply template** block (Detected Topic / Direct Link /
Copy & Paste Audit Note). The note is built by ``generate_reply_logic``: a single
expert-style blurb plus **one** ``/registry/{slug}`` URL from Supabase after score
comparison, with tier Sleep & Beyond (A) > FluffCo (B) > Saatva (C).
The main loop adjusts sleep so digest deadlines are
not missed by a full poll interval when the queue is non-empty.
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
from urllib.parse import quote, urlparse
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
    "natural materials",
    "pillow",
    "value",
    "hotel",
    "budget",
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


def sleepchoice_site_origin() -> str:
    """
    Canonical https origin for SleepChoiceGuide.com (no trailing slash).

    Reads ``NEXT_PUBLIC_SITE_URL`` after ``load_dotenv``; production default
    aligns with Next.js ``SITE_ORIGIN``.
    """
    raw = (os.getenv("NEXT_PUBLIC_SITE_URL") or "").strip().rstrip("/")
    if raw:
        if not re.match(r"^https?://", raw, re.I):
            raw = "https://" + raw.lstrip("/")
        return raw
    return "https://sleepchoiceguide.com"


def scg_url(path: str) -> str:
    """Absolute URL on SleepChoiceGuide (``path`` must start with ``/``)."""
    base = sleepchoice_site_origin().rstrip("/")
    p = path if path.startswith("/") else f"/{path}"
    return f"{base}{p}"


# Soft landing when no tier matches (not a product dossier).
PATH_METHODOLOGY = "/methodology"


def _ensure_dotenv_loaded() -> None:
    load_dotenv(_REPO_ROOT / ".env")
    load_dotenv(_REPO_ROOT / ".env.local")


def _parse_audit_scores(raw: Any) -> dict[str, float]:
    if raw is None:
        return {}
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return {}
    if not isinstance(raw, dict):
        return {}
    out: dict[str, float] = {}
    for k, v in raw.items():
        try:
            fv = float(v)
            if fv > 0:
                out[str(k)] = fv
        except (TypeError, ValueError):
            continue
    return out


def _get_supabase_client() -> Any | None:
    _ensure_dotenv_loaded()
    url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
    key = (
        (os.getenv("SUPABASE_KEY") or "").strip()
        or (os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or "").strip()
    )
    if not url or not key:
        return None
    try:
        from supabase import create_client

        return create_client(url, key)
    except Exception as exc:
        logging.getLogger(__name__).debug("Supabase client init failed: %s", exc)
        return None


def _comma_env_slugs(var_name: str) -> list[str]:
    raw = (os.getenv(var_name) or "").strip()
    if not raw:
        return []
    return [p.strip() for p in raw.split(",") if p.strip()]


def _audit_product_select() -> str:
    return "slug, brand, model, audit_scores, price"


def _fetch_audit_rows_by_slugs(client: Any, slugs: list[str]) -> list[dict[str, Any]]:
    uniq = list(dict.fromkeys(s.strip() for s in slugs if s and str(s).strip()))
    if not uniq:
        return []
    try:
        res = (
            client.table("audit_products")
            .select(_audit_product_select())
            .in_("slug", uniq)
            .execute()
        )
        return list(res.data or [])
    except Exception as exc:
        logging.getLogger(__name__).debug("audit_products in(slug) failed: %s", exc)
        return []


def _fetch_audit_rows_or(client: Any, or_filter: str, *, limit: int) -> list[dict[str, Any]]:
    try:
        res = (
            client.table("audit_products")
            .select(_audit_product_select())
            .or_(or_filter)
            .limit(int(limit))
            .execute()
        )
        return list(res.data or [])
    except Exception as exc:
        logging.getLogger(__name__).debug("audit_products or() failed: %s", exc)
        return []


def _fetch_candidates_tier_a(client: Any) -> list[dict[str, Any]]:
    """Hot sleeper / wool / MyMerino — compare ``audit_scores`` on DB rows."""
    slugs = _comma_env_slugs("REDDIT_REPLY_CANDIDATE_SLUGS_THERMAL")
    if slugs:
        return _fetch_audit_rows_by_slugs(client, slugs)
    or_filter = (
        "brand.ilike.%Sleep%Beyond%,"
        "brand.ilike.%sleep%beyond%,"
        "brand.ilike.%Sleep and Beyond%,"
        "slug.ilike.%sleep-beyond%,"
        "slug.ilike.%mymerino%,"
        "model.ilike.%Merino%"
    )
    return _fetch_audit_rows_or(client, or_filter, limit=120)


def _fetch_candidates_tier_b(client: Any) -> list[dict[str, Any]]:
    slugs = _comma_env_slugs("REDDIT_REPLY_CANDIDATE_SLUGS_FLUFFCO")
    if slugs:
        return _fetch_audit_rows_by_slugs(client, slugs)
    try:
        res = (
            client.table("audit_products")
            .select(_audit_product_select())
            .ilike("brand", "%FluffCo%")
            .limit(120)
            .execute()
        )
        return list(res.data or [])
    except Exception as exc:
        logging.getLogger(__name__).debug("audit_products FluffCo ilike failed: %s", exc)
        return []


def _fetch_candidates_tier_c(client: Any) -> list[dict[str, Any]]:
    slugs = _comma_env_slugs("REDDIT_REPLY_CANDIDATE_SLUGS_SAATVA")
    if slugs:
        return _fetch_audit_rows_by_slugs(client, slugs)
    try:
        res = (
            client.table("audit_products")
            .select(_audit_product_select())
            .ilike("brand", "%Saatva%")
            .limit(120)
            .execute()
        )
        return list(res.data or [])
    except Exception as exc:
        logging.getLogger(__name__).debug("audit_products Saatva ilike failed: %s", exc)
        return []


def _scores_from_audit_row(row: dict[str, Any]) -> dict[str, float]:
    return _parse_audit_scores(row.get("audit_scores"))


def _row_sort_tuple(row: dict[str, Any], keys: tuple[str, ...]) -> tuple[float, ...]:
    sc = _scores_from_audit_row(row)
    return tuple(_pick_score(sc, k) or -1.0 for k in keys)


def _best_audit_product(
    rows: list[dict[str, Any]], sort_keys: tuple[str, ...]
) -> dict[str, Any] | None:
    rows = [r for r in rows if r.get("slug")]
    if not rows:
        return None
    return max(rows, key=lambda r: _row_sort_tuple(r, sort_keys))


def _registry_dossier_url(slug: str) -> str:
    """Single allowed product link: live audit dossier ``/registry/{slug}``."""
    s = (slug or "").strip()
    if not s:
        return ""
    return scg_url(f"/registry/{quote(s, safe='')}")


def _product_line_label(row: dict[str, Any]) -> str:
    brand = str(row.get("brand") or "").strip()
    model = str(row.get("model") or "").strip()
    if brand and model:
        return f"{brand} **{model}**"
    return brand or model or "this product"


def _no_db_candidates_message(pool: str) -> str:
    return (
        f"✍️ **SleepChoiceGuide** — no matching rows in ``audit_products`` for: {pool}. "
        "Add listings in Supabase or set ``REDDIT_REPLY_CANDIDATE_SLUGS_*`` to an explicit "
        "comma-separated slug list so we can compare ``audit_scores`` and link the dossier."
    )


def _missing_supabase_message() -> str:
    return (
        "✍️ **SleepChoiceGuide** — configure ``SUPABASE_URL`` and ``SUPABASE_KEY`` (or "
        "``NEXT_PUBLIC_SUPABASE_ANON_KEY``) so this reply can read ``audit_products`` and "
        "emit a single ``/registry/{slug}`` audit URL."
    )


def _pick_score(row: dict[str, float], *keys: str) -> float | None:
    for k in keys:
        v = row.get(k)
        if v is not None and isinstance(v, (int, float)) and float(v) > 0:
            return float(v)
    return None


def _explicit_saatva_intent(haystack_lower: str, match_set: set[str]) -> bool:
    """Priority C: only when the post clearly names Saatva."""
    if "saatva" in haystack_lower:
        return True
    return "Saatva" in match_set


def _match_priority_a(haystack_lower: str, match_set: set[str]) -> bool:
    """
    Priority A — authorized high-conversion: hot sleeper, topper, natural materials
    (plus MyMerino product-line hits → same single Sleep & Beyond recommendation).
    """
    if "hot sleeper" in haystack_lower or "hot sleeper" in match_set:
        return True
    if "topper" in haystack_lower or "topper" in match_set:
        return True
    if "natural materials" in haystack_lower or "natural materials" in match_set:
        return True
    if "MyMerino" in match_set or "mymerino" in haystack_lower:
        return True
    return False


def _match_priority_b(haystack_lower: str, match_set: set[str]) -> bool:
    """Priority B — pillow / value / hotel / budget (and close variants)."""
    if "FluffCo" in match_set:
        return True
    needles = (
        "pillow",
        "pillows",
        "value",
        "hotel",
        "budget",
        "affordable",
        "cheap",
    )
    return any(n in haystack_lower for n in needles)


def _resolve_reply_tier(
    haystack_lower: str, match_set: set[str]
) -> str | None:
    """
    Single-diagnosis tier. If multiple keyword families hit, keep:
    Sleep & Beyond (A) > FluffCo (B) > Saatva audit (C).
    """
    a = _match_priority_a(haystack_lower, match_set)
    b = _match_priority_b(haystack_lower, match_set)
    c = _explicit_saatva_intent(haystack_lower, match_set)
    if a:
        return "A"
    if b:
        return "B"
    if c:
        return "C"
    return None


def _body_tier_a(winner: dict[str, Any]) -> str:
    sc = _scores_from_audit_row(winner)
    label = _product_line_label(winner)
    cool = _pick_score(sc, "cooling", "thermal")
    overall = _pick_score(sc, "overall")
    if cool is not None:
        score_clause = f"**{label}** leads our compared pool at **{cool:.1f}/10** on **cooling**"
    elif overall is not None:
        score_clause = f"**{label}** leads our compared pool at **{overall:.1f}/10** overall (full ``audit_scores`` on the dossier)"
    else:
        score_clause = f"**{label}** is the compared-pool pick (scores live on the dossier)"
    return (
        f"🔍 Quick Audit: For hot sleepers / wool toppers, {score_clause} in ``audit_products``. "
        "Wool protein fibers wick moisture instead of parking humidity on your skin like a lot of gel-marketing stacks."
    )


def _body_tier_b(winner: dict[str, Any]) -> str:
    sc = _scores_from_audit_row(winner)
    label = _product_line_label(winner)
    overall = _pick_score(sc, "overall")
    sup = _pick_score(sc, "support")
    if overall is not None:
        bits = f"**{overall:.1f}/10** overall"
        if sup is not None:
            bits += f", **{sup:.1f}/10** support"
        score_clause = f"{label} tops our FluffCo pool at {bits}"
    else:
        score_clause = f"{label} is the compared-pool value pick (see dossier for scores)"
    return (
        f"🔍 Quick Audit: On value-for-money vs hotel-style specs, {score_clause} in ``audit_products``. "
        "Same rubric we render on the registry page—no separate marketing URL."
    )


def _body_tier_c(winner: dict[str, Any]) -> str:
    sc = _scores_from_audit_row(winner)
    label = _product_line_label(winner)
    sup = _pick_score(sc, "support", "pressure")
    cool = _pick_score(sc, "cooling")
    if sup is not None:
        spine = f"**{sup:.1f}/10** on **support** / pressure (spinal-alignment axis in our sheet)"
    else:
        spine = "support / pressure scores on the dossier (we read the same JSON the site uses)"
    cool_clause = ""
    if cool is not None:
        cool_clause = f" **Cooling** on that row is **{cool:.1f}/10**—still line it up against natural fills if heat is the complaint."
    return (
        f"🔍 Quick Audit: In our **Saatva** pool, **{label}** prints {spine}.{cool_clause} "
        "**Break-in** still matters: dual-coil faces can read firmer than people expect early."
    )


def _body_tier_c_pivot_wool(winner: dict[str, Any]) -> str:
    label = _product_line_label(winner)
    sc = _scores_from_audit_row(winner)
    cool = _pick_score(sc, "cooling", "thermal")
    if cool is not None:
        tail = f"Compared wool-side rows land **{label}** at **{cool:.1f}/10** on **cooling** in ``audit_products``."
    else:
        tail = f"Compared wool-side pick: **{label}** (scores on dossier)."
    return (
        "🔍 Quick Audit (troubleshooting): **Sagging / pain** next to a Saatva-class hybrid is often "
        "**comfort-layer groove** vs true structural collapse—different failure mode. "
        f"If trapped heat rides along with softening, {tail}"
    )


def _mentions_sagging_or_pain(haystack_lower: str) -> bool:
    """Pain / sagging threads: no pure-praise copy; switch to troubleshooting + pivot."""
    if "sagging" in haystack_lower:
        return True
    return re.search(r"\bpain\b", haystack_lower) is not None


def generate_reply_logic(matches: list[str], haystack: str) -> str:
    """
    Single expert blurb + **one** URL: the winning row's ``/registry/{slug}`` dossier.

    Flow: resolve tier → fetch ``audit_products`` candidates from Supabase → sort by
    the relevant ``audit_scores`` keys → link only the recommended slug's registry page.
    """
    h = haystack.lower()
    ms = set(matches)
    tier = _resolve_reply_tier(h, ms)
    client = _get_supabase_client()
    if not client:
        return _missing_supabase_message()

    if tier == "A":
        rows = _fetch_candidates_tier_a(client)
        winner = _best_audit_product(rows, ("cooling", "thermal", "overall"))
        if not winner:
            return _no_db_candidates_message("thermal / wool (tier A)")
        url = _registry_dossier_url(str(winner.get("slug") or ""))
        return f"{_body_tier_a(winner)}\n{url}"

    if tier == "B":
        rows = _fetch_candidates_tier_b(client)
        winner = _best_audit_product(rows, ("overall", "pressure", "cooling"))
        if not winner:
            return _no_db_candidates_message("FluffCo (tier B)")
        url = _registry_dossier_url(str(winner.get("slug") or ""))
        return f"{_body_tier_b(winner)}\n{url}"

    if tier == "C":
        if _mentions_sagging_or_pain(h):
            rows = _fetch_candidates_tier_a(client)
            winner = _best_audit_product(rows, ("cooling", "thermal", "overall"))
            if not winner:
                return _no_db_candidates_message("wool pivot after pain/sagging (tier-A pool)")
            url = _registry_dossier_url(str(winner.get("slug") or ""))
            return f"{_body_tier_c_pivot_wool(winner)}\n{url}"
        rows = _fetch_candidates_tier_c(client)
        winner = _best_audit_product(rows, ("support", "pressure", "overall"))
        if not winner:
            return _no_db_candidates_message("Saatva (tier C)")
        url = _registry_dossier_url(str(winner.get("slug") or ""))
        return f"{_body_tier_c(winner)}\n{url}"

    return (
        "✍️ **SleepChoiceGuide** — no single-brand tier matched this thread yet "
        f"(see methodology: {scg_url(PATH_METHODOLOGY)}). "
        "When a tier hits, the note links only the winning ``audit_products`` dossier."
    )


def format_copy_paste_audit_note(matches: list[str], haystack: str) -> str:
    """
    Copy-and-paste block for email alerts (same body as ``generate_reply_logic``).

    Numbers and the single outbound link come from Supabase ``audit_products`` after
    score comparison; the URL is always ``/registry/{slug}`` for the recommended row.
    """
    return generate_reply_logic(matches, haystack)


def audit_appendix(matches: list[str], haystack: str) -> str:
    """Alias for ``format_copy_paste_audit_note`` (single combined audit note)."""
    return format_copy_paste_audit_note(matches, haystack)


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
            "sleep-choice-rss-monitor/1.0 (+https://sleepchoiceguide.com)"
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


def reply_material_block(matches: list[str], link: str, haystack: str) -> str:
    """
    Footer for alerts: detected topic, Reddit link, and modular Copy & Paste note.
    """
    topics = ", ".join(matches)
    notes = format_copy_paste_audit_note(matches, haystack)
    return (
        f"[Detected Topic]: {topics}\n"
        f"[Direct Link]: {link}\n\n"
        f"[Copy & Paste Audit Note]\n"
        f"────────────────────────────────────────\n"
        f"{notes}\n"
        f"────────────────────────────────────────\n"
    )


def format_alert_email_body(
    title: str,
    link: str,
    summary: str,
    feed_url: str,
    matches: list[str],
) -> str:
    """Full plaintext body for one Reddit lead including reply template."""
    haystack = f"{title}\n{summary}"
    block = reply_material_block(matches, link, haystack)
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


def run_once() -> None:
    """Single RSS poll + email/digest step; for CI (e.g. GitHub Actions)."""
    global _next_digest_deadline

    load_env()
    processed = load_processed_ids(STATE_PATH)
    _next_digest_deadline = time.monotonic() + BATCH_SEND_INTERVAL
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
    parser = argparse.ArgumentParser(
        description="Reddit RSS keyword monitor → Gmail (see module docstring).",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single poll cycle then exit (for GitHub Actions / cron).",
    )
    args = parser.parse_args()

    try:
        if args.once:
            run_once()
        else:
            run_forever()
    except KeyboardInterrupt:
        print("\nStopped by user.", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
