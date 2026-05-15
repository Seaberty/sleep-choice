# -*- coding: utf-8 -*-
"""Gemini HTTP 请求节流：与 forensic_engine / brand_intel_bulk_ingest 共用进程内时钟。"""

from __future__ import annotations

import asyncio
import os
import time

_GEMINI_LAST_REQUEST_DONE_MONO: float = 0.0


def _gemini_min_interval_seconds() -> float:
    """两次 Gemini 请求之间的最小间隔秒数；0 表示不节流。环境变量 GEMINI_MIN_INTERVAL_SEC。"""
    try:
        x = float((os.getenv("GEMINI_MIN_INTERVAL_SEC") or "1.5").strip())
    except ValueError:
        x = 1.5
    return max(0.0, min(120.0, x))


def _gemini_rate_limit_wait_sync() -> None:
    global _GEMINI_LAST_REQUEST_DONE_MONO
    gap = _gemini_min_interval_seconds()
    if gap <= 0:
        return
    now = time.monotonic()
    if _GEMINI_LAST_REQUEST_DONE_MONO > 0:
        need = gap - (now - _GEMINI_LAST_REQUEST_DONE_MONO)
        if need > 0:
            time.sleep(need)


async def _gemini_rate_limit_wait_async() -> None:
    global _GEMINI_LAST_REQUEST_DONE_MONO
    gap = _gemini_min_interval_seconds()
    if gap <= 0:
        return
    now = time.monotonic()
    if _GEMINI_LAST_REQUEST_DONE_MONO > 0:
        need = gap - (now - _GEMINI_LAST_REQUEST_DONE_MONO)
        if need > 0:
            await asyncio.sleep(need)


def _gemini_mark_request_complete() -> None:
    global _GEMINI_LAST_REQUEST_DONE_MONO
    _GEMINI_LAST_REQUEST_DONE_MONO = time.monotonic()
