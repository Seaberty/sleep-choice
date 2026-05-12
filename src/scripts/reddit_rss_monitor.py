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

    SUPABASE_URL / SUPABASE_KEY — Optional; when set, reply-template scores are
        read from ``audit_products.audit_scores`` (same source as ``src/lib/registry.ts``).
        Falls back to ``src/data/registry.json`` if the query fails or returns no row.

    REDDIT_AUDIT_SLUG_THERMAL / REDDIT_AUDIT_SLUG_FLUFFCO — Optional registry slugs
        whose ``audit_scores`` power MyMerino/thermal and FluffCo value sentences.
        You can instead set ``reddit_audit_slugs.thermal`` / ``fluffco_value`` in
        ``src/data/registry.json``.

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
Copy & Paste Audit Note). The main loop adjusts sleep so digest deadlines are
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
from urllib.parse import urlparse
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path
from typing import Any, NamedTuple

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


# Deep links aligned with Next.js routes (``sitemap.ts``: ``/registry/{slug}``,
# ``/journal/{slug}``; ``registry.json`` + ``hero.tsx`` slugs).
PATH_SAATVA_CLASSIC = "/registry/saatva-classic"
PATH_SAATVA_HD = "/registry/saatva-hd"
PATH_BEST_PICKS = "/best-picks"
PATH_COMPARE = "/compare"
PATH_METHODOLOGY = "/methodology"
PATH_INTELLIGENCE = "/intelligence"
PATH_DEALS = "/deals"
PATH_REGISTRY = "/registry"

# Registry slugs (same as ``/registry/[slug]`` and ``audit_products.slug``).
SLUG_SAATVA_CLASSIC = "saatva-classic"
SLUG_SAATVA_HD = "saatva-hd"
REGISTRY_JSON_PATH = _REPO_ROOT / "src" / "data" / "registry.json"


# --- Multi-dimensional reply library (blogger tone; paths via ``scg_url``) ---
# ``forensic_data`` is optional when scores are assembled dynamically (Saatva / S&B / FluffCo / back_pain).
AUDIT_SNIPPETS_BY_KEYWORD: dict[str, dict[str, str]] = {
    "Saatva": {
        "professional_intro": (
            "Hey — dropping in from **SleepChoiceGuide** where we keep an "
            "independent audit trail on mattresses (no brand pays us for scores)."
        ),
        "target_path": PATH_SAATVA_CLASSIC,
        "secondary_path": PATH_SAATVA_HD,
    },
    "Sleep & Beyond": {
        "professional_intro": (
            "When a thread goes **hot sleeper**, **topper**, or **cooling**, this "
            "is basically **Sleep & Beyond / MyMerino** territory in our data."
        ),
        "target_path": PATH_BEST_PICKS,
        "secondary_path": PATH_METHODOLOGY,
    },
    "FluffCo": {
        "professional_intro": (
            "If the vibe is **pillows**, **budget**, or **value-for-money**, I reach "
            "for **FluffCo** first in our value audits."
        ),
        "target_path": PATH_DEALS,
        "secondary_path": PATH_REGISTRY,
    },
    "MyMerino": {
        "professional_intro": (
            "Quick take on **MyMerino / wool toppers** from our topper audits."
        ),
        "forensic_data": (
            "I read these layers on **loft + wool GSM** and how they mate with your "
            "base mattress—otherwise you’re tuning pressure and heat blind."
        ),
        "target_path": PATH_BEST_PICKS,
        "secondary_path": PATH_COMPARE,
    },
    "back_pain": {
        "professional_intro": (
            "For **back pain** threads, I anchor on alignment first—not just softer foam."
        ),
        "target_path": PATH_SAATVA_CLASSIC,
        "secondary_path": PATH_BEST_PICKS,
    },
    "mattress_review": {
        "professional_intro": "Mattress **review** threads: I never trust star averages alone.",
        "forensic_data": (
            "I cross-check owner narratives with our **alignment + durability** "
            "signals before I paste a pick—marketing stars and real spine fit diverge "
            "all the time."
        ),
        "target_path": PATH_METHODOLOGY,
        "secondary_path": PATH_REGISTRY,
    },
}

HARDCORE_TRIGGERS = (
    "latex",
    "chemical",
    "foam",
    "off-gassing",
    "offgassing",
    "voc",
    "allergy",
    "allergic",
    "formaldehyde",
)


class _ReplyScoreContext(NamedTuple):
    """Live ``audit_scores`` keyed by slug (Supabase overrides local JSON)."""

    by_slug: dict[str, dict[str, float]]
    thermal_slug: str | None
    fluff_slug: str | None


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


def _load_registry_blob() -> dict[str, Any]:
    if not REGISTRY_JSON_PATH.is_file():
        return {}
    try:
        with REGISTRY_JSON_PATH.open(encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _reddit_audit_slugs_from_registry(reg: dict[str, Any]) -> dict[str, str]:
    raw = reg.get("reddit_audit_slugs")
    if not isinstance(raw, dict):
        return {}
    return {
        str(k): str(v).strip()
        for k, v in raw.items()
        if isinstance(v, str) and v.strip()
    }


def _scores_from_product_blob(blob: Any) -> dict[str, float]:
    if not isinstance(blob, dict):
        return {}
    ac = blob.get("audit_scores")
    if isinstance(ac, dict) and ac:
        return _parse_audit_scores(ac)
    return _parse_audit_scores(blob.get("metrics"))


def _supabase_audit_scores_by_slug(slugs: list[str]) -> dict[str, dict[str, float]]:
    _ensure_dotenv_loaded()
    url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
    key = (
        (os.getenv("SUPABASE_KEY") or "").strip()
        or (os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or "").strip()
    )
    if not url or not key or not slugs:
        return {}
    uniq = list(dict.fromkeys(s for s in slugs if s))
    try:
        from supabase import create_client

        client = create_client(url, key)
        res = (
            client.table("audit_products")
            .select("slug, audit_scores")
            .in_("slug", uniq)
            .execute()
        )
        out: dict[str, dict[str, float]] = {}
        for row in res.data or []:
            slug = row.get("slug")
            if not slug:
                continue
            parsed = _parse_audit_scores(row.get("audit_scores"))
            if parsed:
                out[str(slug)] = parsed
        return out
    except Exception as exc:
        logging.getLogger(__name__).debug("audit_products audit_scores fetch skipped: %s", exc)
        return {}


def _merge_scores_from_registry(
    slugs: list[str], reg: dict[str, Any]
) -> dict[str, dict[str, float]]:
    products = reg.get("products") or {}
    if not isinstance(products, dict):
        return {}
    merged: dict[str, dict[str, float]] = {}
    for slug in slugs:
        if not slug:
            continue
        blob = products.get(slug)
        sc = _scores_from_product_blob(blob)
        if sc:
            merged[slug] = sc
    return merged


def _build_reply_score_context() -> _ReplyScoreContext:
    """
    Scores for reply templates: Supabase ``audit_products.audit_scores`` wins,
    then local ``registry.json`` (same merge order as ``mergeAuditProductRow`` for scores).
    """
    reg = _load_registry_blob()
    aliases = _reddit_audit_slugs_from_registry(reg)
    thermal_slug = (
        (os.getenv("REDDIT_AUDIT_SLUG_THERMAL") or "").strip()
        or aliases.get("thermal")
        or aliases.get("thermal_wool")
        or None
    )
    fluff_slug = (
        (os.getenv("REDDIT_AUDIT_SLUG_FLUFFCO") or "").strip()
        or aliases.get("fluffco_value")
        or aliases.get("fluffco")
        or None
    )
    want = [SLUG_SAATVA_CLASSIC, SLUG_SAATVA_HD]
    if thermal_slug:
        want.append(thermal_slug)
    if fluff_slug:
        want.append(fluff_slug)
    want = list(dict.fromkeys(want))

    merged = _merge_scores_from_registry(want, reg)
    remote = _supabase_audit_scores_by_slug(want)
    for slug, scores in remote.items():
        if scores:
            merged[slug] = scores

    return _ReplyScoreContext(
        by_slug=merged,
        thermal_slug=thermal_slug if thermal_slug else None,
        fluff_slug=fluff_slug if fluff_slug else None,
    )


def _pick_score(row: dict[str, float], *keys: str) -> float | None:
    for k in keys:
        v = row.get(k)
        if v is not None and isinstance(v, (int, float)) and float(v) > 0:
            return float(v)
    return None


def _forensic_saatva(ctx: _ReplyScoreContext) -> str:
    cl = ctx.by_slug.get(SLUG_SAATVA_CLASSIC) or {}
    hd = ctx.by_slug.get(SLUG_SAATVA_HD) or {}
    if not cl and not hd:
        return (
            "**Saatva Classic / HD** — open the registry dossiers below for live "
            "**audit_scores** (same JSON fields we store on ``audit_products`` in Supabase)."
        )
    parts: list[str] = []
    if cl:
        o = _pick_score(cl, "overall")
        sup = _pick_score(cl, "support")
        cool = _pick_score(cl, "cooling")
        seg: list[str] = []
        if o is not None:
            seg.append(f"**{o:.1f}/10** overall")
        if sup is not None:
            seg.append(f"**{sup:.1f}/10** support (spine / lumbar fit)")
        if cool is not None:
            seg.append(f"**{cool:.1f}/10** cooling")
        if seg:
            parts.append(
                "**Saatva Classic** in our sheet: "
                + ", ".join(seg)
                + "—strong zoning for chronic back issues. If you care **more about sleeping cool**, "
                "I’d still line that up against **natural materials** (wool / latex stacks) "
                "instead of chasing foam-only cooling marketing."
            )
        else:
            parts.append(
                "**Saatva Classic** — numeric scores are on the dossier below (pulled from our DB row)."
            )
    if hd:
        o2 = _pick_score(hd, "overall")
        sup2 = _pick_score(hd, "support")
        cool2 = _pick_score(hd, "cooling")
        seg2: list[str] = []
        if o2 is not None:
            seg2.append(f"**{o2:.1f}/10** overall")
        if sup2 is not None:
            seg2.append(f"**{sup2:.1f}/10** support")
        if cool2 is not None:
            seg2.append(f"**{cool2:.1f}/10** cooling")
        if seg2:
            parts.append(
                "**Saatva HD / RX-class hybrid** row: " + ", ".join(seg2) + " (same scoring rubric)."
            )
    return " ".join(parts) if parts else (
        "**Saatva Classic / HD** — see live **audit_scores** on the registry links below."
    )


def _forensic_sleep_beyond_thermal(ctx: _ReplyScoreContext) -> str:
    slug = ctx.thermal_slug
    row = ctx.by_slug.get(slug) if slug else {}
    if not isinstance(row, dict):
        row = {}
    cool = _pick_score(row, "cooling", "thermal")
    if cool is not None and slug:
        return (
            f"**MyMerino** is printing **{cool:.1f}/10** on "
            "**cooling** in our audit sheet—the field we use for heat / vapor migration "
            "instead of marketing “chill” labels. Wool’s **protein-rich fibers** behave like "
            "a wicking layer: they move humidity off the skin so you’re not fighting that "
            "sticky 2 AM micro-climate synthetic “cooling gels” often paper over."
        )
    return (
        "**MyMerino / wool** layers have been a thermal outlier in our topper audits—"
        "set ``REDDIT_AUDIT_SLUG_THERMAL`` (or ``reddit_audit_slugs.thermal`` in "
        "``registry.json``) to the live registry slug so this line can echo the exact "
        "**cooling** score from our **audit_products** row."
    )


def _forensic_thermal_lane_short(ctx: _ReplyScoreContext) -> str:
    slug = ctx.thermal_slug
    row = ctx.by_slug.get(slug) if slug else {}
    if not isinstance(row, dict):
        row = {}
    cool = _pick_score(row, "cooling", "thermal")
    if cool is not None:
        return (
            "🐑 **Thermal lane — Sleep & Beyond MyMerino**\n\n"
            f"Separate from the coil story: **MyMerino** is still a **{cool:.1f}/10** "
            "**cooling** pick in our workbook. Wool’s **protein-rich fibers** pull "
            "moisture off the skin so you’re not stuck in that 2 AM pillow flip cycle "
            "synthetic cooling stories love to ignore."
        )
    return (
        "🐑 **Thermal lane — Sleep & Beyond MyMerino**\n\n"
        "Separate from the coil story: **MyMerino** is still our wool thermal anchor—"
        "open the dossier below for the live **cooling** score from our database."
    )


def _forensic_fluffco(ctx: _ReplyScoreContext) -> str:
    slug = ctx.fluff_slug
    row = ctx.by_slug.get(slug) if slug else {}
    if not isinstance(row, dict):
        row = {}
    overall = _pick_score(row, "overall")
    sup = _pick_score(row, "support")
    cool = _pick_score(row, "cooling")
    if overall is not None and slug:
        bits = [f"**{overall:.1f}/10** overall (headline audit index)"]
        if sup is not None:
            bits.append(f"**{sup:.1f}/10** support")
        if cool is not None:
            bits.append(f"**{cool:.1f}/10** cooling")
        return (
            "**FluffCo** — "
            + ", ".join(bits)
            + " in our sheet—basically **five-star hotel fill specs** without the resort markup when "
            "people want “feels expensive” without the invoice shock."
        )
    return (
        "**FluffCo** — set ``REDDIT_AUDIT_SLUG_FLUFFCO`` (or ``reddit_audit_slugs.fluffco_value``) "
        "to your live registry slug so this line can quote the same **overall** / comfort "
        "scores as the **audit_products** row."
    )


def _forensic_back_pain(ctx: _ReplyScoreContext) -> str:
    cl = ctx.by_slug.get(SLUG_SAATVA_CLASSIC) or {}
    sup = _pick_score(cl, "support")
    cool = _pick_score(cl, "cooling")
    if sup is not None:
        lead = (
            f"We still use **Saatva Classic** as a **{sup:.1f}/10** **support** reference "
            "when lumbar load is the headline pain."
        )
    else:
        lead = (
            "We still anchor on **Saatva Classic** in the registry when lumbar load is the headline pain."
        )
    if cool is not None:
        mid = f" Its **cooling** reads **{cool:.1f}/10**—if you need more breathability, "
    else:
        mid = " If you need more breathability, "
    return (
        lead
        + mid
        + "I’d also eye **organic wool toppers** so you’re not trading spine support for a swampy climate."
    )


def _scenario_b_thermal(haystack_lower: str, match_set: set[str]) -> bool:
    """Hot sleeper / topper / cooling → Sleep & Beyond primary story."""
    if match_set & {"hot sleeper", "topper"}:
        return True
    for token in (
        "cooling",
        "sleeps hot",
        "sleep hot",
        "night sweats",
        "overheat",
        "sleep too hot",
    ):
        if token in haystack_lower:
            return True
    return False


def _scenario_c_value(haystack_lower: str) -> bool:
    """Pillow / value / budget → FluffCo primary story."""
    for token in (
        "pillow",
        "pillows",
        "budget",
        "value",
        "affordable",
        "cheap",
        "worth it",
        "under $",
        "under$",
    ):
        if token in haystack_lower:
            return True
    return False


def _hardcore_mode(haystack: str) -> bool:
    """Long, materials-heavy posts → add technical vocabulary block."""
    h = haystack.lower()
    if len(haystack) < 200:
        return False
    return any(t in h for t in HARDCORE_TRIGGERS)


def _hardcore_paragraph() -> str:
    return (
        "🔬 **If you want the nerdy framing:** I sometimes explain comfort failures as "
        "**thermal saturation**—when the comfort stack can’t dump **latent heat** "
        "fast enough. **Bi-component fibers** (blended natural + synthetic) move "
        "moisture differently than single-origin fills, which changes how **latent "
        "heat** shows up in real bedrooms vs. lab charts."
    )


def _append_snippet_block(
    key: str,
    body_parts: list[str],
    link_bucket: list[str],
    *,
    forensic_override: str | None = None,
) -> None:
    row = AUDIT_SNIPPETS_BY_KEYWORD[key]
    intro = row["professional_intro"]
    data = (
        forensic_override
        if forensic_override is not None
        else (row.get("forensic_data") or "")
    )
    body_parts.append(f"{intro}\n\n{data}")
    link_bucket.append(scg_url(row["target_path"]))
    sec = row.get("secondary_path")
    if sec:
        link_bucket.append(scg_url(sec))


def _dedupe_preserve_order(urls: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def format_copy_paste_audit_note(matches: list[str], haystack: str) -> str:
    """
    One cohesive Copy & Paste block: scene priority + optional hardcore + link rail.

    Numeric claims come from ``audit_products.audit_scores`` when
    ``SUPABASE_URL`` / ``SUPABASE_KEY`` are set, else from ``src/data/registry.json``
    (same fields as ``mergeAuditProductRow`` in ``src/lib/registry.ts``).
    """
    h = haystack.lower()
    ms = set(matches)
    parts: list[str] = []
    links: list[str] = []
    ctx = _build_reply_score_context()

    saatva_hit = "saatva" in h or "Saatva" in ms
    thermal_hit = _scenario_b_thermal(h, ms)
    value_hit = _scenario_c_value(h)

    # Scene A — Saatva (objective audit; “未批下来” → independent framing)
    if saatva_hit:
        _append_snippet_block(
            "Saatva",
            parts,
            links,
            forensic_override=_forensic_saatva(ctx),
        )

    # Scene B — Sleep & Beyond / thermal (主场; with or without brand in post)
    if thermal_hit:
        if saatva_hit:
            parts.append(_forensic_thermal_lane_short(ctx))
            links.append(scg_url(PATH_BEST_PICKS))
            links.append(scg_url(PATH_METHODOLOGY))
        else:
            _append_snippet_block(
                "Sleep & Beyond",
                parts,
                links,
                forensic_override=_forensic_sleep_beyond_thermal(ctx),
            )

    # Scene C — FluffCo (pillow / value / budget)
    if value_hit:
        _append_snippet_block(
            "FluffCo",
            parts,
            links,
            forensic_override=_forensic_fluffco(ctx),
        )
    elif "FluffCo" in ms:
        _append_snippet_block(
            "FluffCo",
            parts,
            links,
            forensic_override=_forensic_fluffco(ctx),
        )

    # Keyword-only tails (avoid repeating Saatva block if Scene A already ran)
    if "back pain" in ms and not saatva_hit:
        _append_snippet_block(
            "back_pain",
            parts,
            links,
            forensic_override=_forensic_back_pain(ctx),
        )
    elif "back pain" in ms and saatva_hit and not thermal_hit:
        parts.append(
            "🌿 **Layering note:** for **back pain + breathability**, I’d still look at "
            "**organic wool toppers** so support doesn’t come with a swampy climate."
        )
        links.append(scg_url(PATH_BEST_PICKS))

    if "mattress review" in ms:
        _append_snippet_block("mattress_review", parts, links)

    # Brand keyword hits without Scene B already covering S&B / MyMerino story
    if "Sleep & Beyond" in ms and not thermal_hit:
        _append_snippet_block(
            "Sleep & Beyond",
            parts,
            links,
            forensic_override=_forensic_sleep_beyond_thermal(ctx),
        )

    if "MyMerino" in ms and not thermal_hit and "Sleep & Beyond" not in ms:
        _append_snippet_block("MyMerino", parts, links)

    if _hardcore_mode(haystack):
        parts.append(_hardcore_paragraph())

    if not parts:
        u_m = scg_url(PATH_METHODOLOGY)
        u_r = scg_url(PATH_REGISTRY)
        return (
            "✍️ **SleepChoiceGuide**\n\n"
            "I don’t have a perfect canned fit for this exact wording yet—compose "
            f"one tailored line, and anchor claims here:\n{u_m}\nLive rows: {u_r}"
        )

    unique_links = _dedupe_preserve_order(links)
    link_rail = "\n".join(f"• {u}" for u in unique_links)
    core = "\n\n".join(parts)
    return (
        f"✨ **Ready-to-paste reply (SleepChoiceGuide)**\n\n"
        f"{core}\n\n"
        f"📎 **Our links (open before you post):**\n{link_rail}"
    )


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
