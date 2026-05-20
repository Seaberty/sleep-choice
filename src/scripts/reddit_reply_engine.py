# -*- coding: utf-8 -*-
"""
Contextual Reddit reply drafts for ``reddit_rss_monitor.py``.

- Classifies thread topic (mattress / comforter / pillow / sheets / …).
- Skips misleading alerts (e.g. ``hot sleeper`` on a sheets-only thread).
- Builds paste-safe drafts from topic + matched affiliate lane (no fixed killer blocks).
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_REGISTRY_JSON = _REPO_ROOT / "src" / "data" / "registry.json"

_COPY_URL_PATTERN = re.compile(
    r"(?i)(https?://|www\.|\b[a-z0-9][-a-z0-9]*\.com\b)"
)

# --- Keywords (monitor imports BRAND / INTENT splits) ---

BRAND_KEYWORDS: tuple[str, ...] = (
    "Saatva",
    "Sleep & Beyond",
    "FluffCo",
    "MyMerino",
)

INTENT_KEYWORDS: tuple[str, ...] = (
    "night sweats",
    "hot sleeper",
    "natural materials",
)

BRAND_KEYWORDS_SET = frozenset(BRAND_KEYWORDS)
INTENT_KEYWORDS_SET = frozenset(INTENT_KEYWORDS)

LANE_ORDER: tuple[str, ...] = ("sleep_beyond", "fluffco", "saatva")

LANE_TRIGGERS: dict[str, tuple[str, ...]] = {
    "sleep_beyond": (
        "sleep & beyond",
        "sleep and beyond",
        "mymerino",
        "merino",
        "wool comforter",
    ),
    "fluffco": ("fluffco", "down alternative"),
    "saatva": ("saatva",),
}

# Intent keywords only fire when thread looks like these categories (not sheets).
INTENT_REQUIRES_TOPIC: frozenset[str] = frozenset(
    {"mattress", "comforter", "pillow", "topper", "bedding_general", "unknown"}
)

TOPIC_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "sheets",
        (
            "sheet",
            "sheets",
            "pillowcase",
            "pillow case",
            "percale",
            "sateen",
            "linen sheet",
            "boll & branch",
            "boll and branch",
            "thread count",
            "sheet set",
        ),
    ),
    (
        "mattress",
        (
            "mattress",
            "hybrid mattress",
            "innerspring",
            "coil count",
            "latex mattress",
            "bed in a box",
            "saatva classic",
            "saatva hd",
            "side sleeper",
            "too firm",
            "firmness",
            "lower back",
        ),
    ),
    (
        "comforter",
        (
            "comforter",
            "duvet",
            "down alternative",
            "down comforter",
            "mymerino",
            "wool fill",
            "blanket",
        ),
    ),
    ("pillow", ("pillow", "cervical", "head-neck", "loft")),
    ("topper", ("topper", "mattress pad", "mattress topper")),
)

SEARCH_PRODUCT_BY_LANE: dict[str, str] = {
    "sleep_beyond": "Sleep and Beyond MyMerino comforter",
    "fluffco": "FluffCo down alternative comforter",
    "saatva": "Saatva Classic mattress",
}


@dataclass(frozen=True)
class CatalogProduct:
    slug: str
    brand: str
    name: str
    cooling: float | None = None


@dataclass
class ThreadAnalysis:
    title: str
    summary: str
    matches: list[str]
    topic: str
    lane: str | None
    relevant: bool
    should_alert: bool
    skip_reason: str | None
    action: str  # REPLY | SKIP


def assert_reply_copy_safe(text: str, *, context: str = "reply") -> None:
    if _COPY_URL_PATTERN.search(text):
        raise ValueError(
            f"{context} contains a banned URL pattern: {text[:200]!r}..."
        )


def load_catalog() -> dict[str, Any]:
    if not _REGISTRY_JSON.is_file():
        return {"reddit_audit_slugs": {}, "products": {}}
    return json.loads(_REGISTRY_JSON.read_text(encoding="utf-8"))


def catalog_product_for_lane(lane: str | None) -> CatalogProduct | None:
    if not lane:
        return None
    data = load_catalog()
    slugs = data.get("reddit_audit_slugs") or {}
    slug = slugs.get(lane)
    if not slug:
        return None
    prod = (data.get("products") or {}).get(slug) or {}
    scores = prod.get("audit_scores") or {}
    cooling = scores.get("cooling")
    return CatalogProduct(
        slug=str(slug),
        brand=str(prod.get("brand") or ""),
        name=str(prod.get("name") or slug),
        cooling=float(cooling) if cooling is not None else None,
    )


def detect_topic(haystack_lower: str) -> str:
    best = "unknown"
    best_score = 0
    for topic, needles in TOPIC_RULES:
        score = sum(1 for n in needles if n in haystack_lower)
        if score > best_score:
            best_score = score
            best = topic
    if best == "unknown" and "saatva" in haystack_lower:
        return "mattress"
    if best == "unknown" and any(
        x in haystack_lower for x in ("mymerino", "fluffco", "sleep & beyond")
    ):
        return "comforter"
    return best


def resolve_lane(haystack_lower: str, match_set: set[str]) -> str | None:
    for lane in LANE_ORDER:
        for trigger in LANE_TRIGGERS[lane]:
            if trigger in haystack_lower:
                return lane
            if any(trigger in m.lower() for m in match_set):
                return lane
    return None


def _brand_matches(matches: list[str]) -> list[str]:
    return [m for m in matches if m in BRAND_KEYWORDS_SET]


def _intent_only_matches(matches: list[str]) -> bool:
    return bool(matches) and all(m in INTENT_KEYWORDS_SET for m in matches)


def assess_relevance(
    topic: str,
    matches: list[str],
    haystack_lower: str,
    lane: str | None,
) -> tuple[bool, str | None]:
    brands = _brand_matches(matches)
    intent_only = _intent_only_matches(matches)

    if topic == "sheets":
        if brands:
            return (
                False,
                "Thread is about sheets — site audits mattresses/comforters, not sheet sets.",
            )
        return (
            False,
            "Intent keyword on a sheets thread (e.g. hot sleeper) — avoid comforter/mattress pitch.",
        )

    if topic in ("mattress", "comforter", "pillow", "topper"):
        return True, None

    if intent_only and topic not in INTENT_REQUIRES_TOPIC:
        return False, f"Intent keywords do not match topic '{topic}'."

    if intent_only and topic == "unknown":
        return (
            False,
            "Intent keyword hit but product category unclear — review manually.",
        )

    if lane or brands:
        return True, None

    if intent_only:
        return False, "Intent-only match without mattress/comforter context."

    return True, None


def analyze_thread(
    title: str,
    summary: str,
    matches: list[str],
    *,
    skip_irrelevant_alerts: bool = True,
) -> ThreadAnalysis:
    haystack = f"{title}\n{summary}".strip()
    h = haystack.lower()
    ms = set(matches)
    topic = detect_topic(h)
    lane = resolve_lane(h, ms)
    relevant, skip_reason = assess_relevance(topic, matches, h, lane)
    should_alert = relevant or not skip_irrelevant_alerts
    action = "REPLY" if relevant else "SKIP"
    return ThreadAnalysis(
        title=title,
        summary=summary,
        matches=matches,
        topic=topic,
        lane=lane,
        relevant=relevant,
        should_alert=should_alert,
        skip_reason=skip_reason,
        action=action,
    )


def _topic_paragraph(topic: str, matches: list[str]) -> str:
    brands = _brand_matches(matches)
    brand_note = (
        f" (thread mentions {', '.join(brands)})" if brands else ""
    )

    if topic == "sheets":
        return (
            "This thread is really about **sheets** — weave (percale vs sateen), staple length, "
            "and wash feel matter more than comforter marketing. I do not run sheet SKU audits; "
            "compare hand-feel after wash #3–5 before judging on night one."
            + brand_note
        )
    if topic == "mattress":
        return (
            "Mattress threads usually hinge on firmness vs floor models, return fees, and whether "
            "heat/softening show up in owner posts — not the hero coil photo. Match your sleep position "
            "to pressure/support data before brand loyalty."
            + brand_note
        )
    if topic == "comforter":
        return (
            "Comforter/value questions are about loft retention, fill type (down vs synthetic vs wool), "
            "and whether the shell traps vapor. Thread count on the label is often a distraction."
            + brand_note
        )
    if topic == "pillow":
        return (
            "Pillow fit is loft + fill + shoulder width — a mattress fix will not fix the wrong cervical loft."
            + brand_note
        )
    if topic == "topper":
        return (
            "Toppers change feel without replacing the base — check depth, strap fit, and whether the "
            "underlying mattress is still the heat source."
            + brand_note
        )
    return (
        "Clarify whether the pain point is the surface (mattress/topper), mid-layer (comforter), "
        "or contact layer (pillow/sheets) before swapping brands."
        + brand_note
    )


def _lane_paragraph(lane: str, topic: str) -> str:
    prod = catalog_product_for_lane(lane)
    if not prod:
        return ""

    if topic == "sheets":
        return (
            f"If heat persists after sheet swaps, the stack under the sheets "
            f"({prod.brand} {prod.name} is one audited mid-layer) may matter more than the top sheet brand."
        )

    if lane == "saatva" and topic == "mattress":
        return (
            f"For Saatva-specific debates, owner data on the Classic often clusters around "
            f"early firmness vs showroom, white-glove timing, and the return processing fee — "
            f"not coil marketing names. Cross-check listing specs vs aggregated review signals."
        )
    if lane == "fluffco" and topic == "comforter":
        return (
            f"FluffCo down-alternative listings emphasize baffle loft vs flat cluster fill; "
            f"worth lining that up against how {prod.name} scores on cooling/loft in third-party posts."
        )
    if lane == "sleep_beyond" and topic in ("comforter", "bedding_general", "unknown"):
        return (
            f"For hot sleepers discussing **fill** (not sheets), wool comforters like "
            f"{prod.brand} {prod.name} aim at vapor movement vs trapping heat in polyester shells — "
            f"different physics than gel marketing copy."
        )
    if lane == "sleep_beyond" and topic == "mattress":
        return (
            "If the mattress is foam-heavy and you run hot, the comforter layer may be storing humidity; "
            f"natural-fill paths ({prod.brand} {prod.name}) are a separate lever from swapping coil brands."
        )

    return (
        f"Registry audit with aggregated review signals: {prod.brand} {prod.name} "
        f"(slug `{prod.slug}`) — compare cooling/support indices to your priority."
    )


def _search_guidance(lane: str | None, topic: str) -> str:
    if topic == "sheets":
        return (
            "SleepChoiceGuide does not index sheet sets yet — skip a product search CTA here."
        )
    product = SEARCH_PRODUCT_BY_LANE.get(lane or "", "sleep product forensic audit")
    return f"Search Google for [SleepChoiceGuide + {product}] for aggregated audit indices (no affiliate links in replies)."


def _engagement_hook(topic: str, lane: str | None) -> str:
    hooks = {
        "sheets": "Are you chasing percale cool-hand-feel or sateen softness — and what did wash #3 feel like?",
        "mattress": "Side, back, or stomach — and did you trial past the 30-night firmness break-in window?",
        "comforter": "What fill weight/loft are you targeting — and is heat or flat fill the bigger issue?",
        "pillow": "What loft height are you on now vs shoulder width?",
        "topper": "Is the base mattress foam or coil — and how thick is the topper stack?",
    }
    if topic in hooks:
        return hooks[topic] + " Happy to narrow it down."
    if lane:
        return "What category is the thread actually about — mattress, comforter, or pillow? Let me know."
    return "What product layer are you trying to fix first? Let me know."


def generate_reply_draft(analysis: ThreadAnalysis) -> str:
    """Paste-safe draft tailored to topic; not a fixed brand script."""
    if not analysis.relevant:
        hint = analysis.skip_reason or "Off-topic for affiliate catalog."
        manual = _topic_paragraph(analysis.topic, analysis.matches)
        out = (
            "[Automated: do not paste as-is — thread misaligned with catalog]\n\n"
            f"Reason: {hint}\n\n"
            f"If you still reply manually:\n{manual}"
        )
        assert_reply_copy_safe(out, context="skip_draft")
        return out

    parts = [
        "Not affiliated — notes tailored to this thread (edit before posting).",
        _topic_paragraph(analysis.topic, analysis.matches),
    ]
    if analysis.lane:
        lane_bit = _lane_paragraph(analysis.lane, analysis.topic)
        if lane_bit:
            parts.append(lane_bit)
    parts.append(_search_guidance(analysis.lane, analysis.topic))
    parts.append(_engagement_hook(analysis.topic, analysis.lane))
    out = "\n\n".join(parts)
    assert_reply_copy_safe(out, context="reply_draft")
    return out


def format_analysis_header(analysis: ThreadAnalysis) -> str:
    return (
        f"[Action]: {analysis.action}\n"
        f"[Topic]: {analysis.topic}\n"
        f"[Lane]: {analysis.lane or 'none'}\n"
        f"[Relevant]: {'yes' if analysis.relevant else 'no — ' + (analysis.skip_reason or '')}\n"
    )


def generate_reply_logic(matches: list[str], haystack: str) -> str:
    """Backward-compatible entry: title + summary in haystack first line split."""
    lines = haystack.split("\n", 1)
    title = lines[0].strip()
    summary = lines[1].strip() if len(lines) > 1 else ""
    skip = os.getenv("REDDIT_ALERT_SKIP_IRRELEVANT", "1").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    analysis = analyze_thread(title, summary, matches, skip_irrelevant_alerts=skip)
    return generate_reply_draft(analysis)
