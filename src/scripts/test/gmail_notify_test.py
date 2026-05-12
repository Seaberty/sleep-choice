#!/usr/bin/env python3
"""
Verify Gmail credentials from repo-root ``.env`` / ``.env.local`` and optionally send a test mail.

Uses the same variables as ``reddit_rss_monitor.py``:

    GMAIL_USER, GMAIL_PASS  (Google App Password)
    GMAIL_TO                  (optional; defaults to GMAIL_USER)

When not ``--dry-run``, sends **one** message whose body is built with
``format_alert_email_body`` (same layout as live Reddit alerts: title / link /
summary / feed + ``[Detected Topic]`` / ``[Direct Link]`` / ``[Copy & Paste Audit Note]``
with forensic snippets and ``{SCG}`` expanded from ``NEXT_PUBLIC_SITE_URL``).

Run from repository root::

    python src/scripts/test/gmail_notify_test.py
    python src/scripts/test/gmail_notify_test.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

# Allow ``import reddit_rss_monitor`` when running this file directly.
_SCRIPTS_DIR = Path(__file__).resolve().parent.parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from reddit_rss_monitor import (  # noqa: E402
    format_alert_email_body,
    load_env,
    send_email,
    sleepchoice_site_origin,
)


def _check_vars() -> tuple[str, str, str]:
    """Return (user, password, to_addr); exit non-zero if missing."""
    user = os.environ.get("GMAIL_USER", "").strip()
    password = os.environ.get("GMAIL_PASS", "").strip()
    to_addr = os.environ.get("GMAIL_TO", "").strip() or user
    if not user:
        print("缺少 GMAIL_USER（请在 .env.local 中配置）", file=sys.stderr)
        sys.exit(1)
    if not password:
        print("缺少 GMAIL_PASS（请使用 Google 应用专用密码）", file=sys.stderr)
        sys.exit(1)
    return user, password, to_addr


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Test Gmail SMTP with the same env as reddit_rss_monitor.py.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only load .env and verify variables; do not connect to SMTP.",
    )
    args = parser.parse_args()

    load_env()
    user, _password, to_addr = _check_vars()

    print(f"[ok] 已读取配置：发件人={user!r}，收件人={to_addr!r}", flush=True)

    stamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")
    origin = sleepchoice_site_origin()
    print(f"[ok] 模板站点根 SCG = {origin!r}", flush=True)

    if args.dry_run:
        print("[dry-run] 未连接 SMTP，未发送邮件。", flush=True)
        return

    subject = "[sleep-choice] Reddit monitor 模板预览（gmail_notify_test）"
    body = (
        "本邮件为 gmail_notify_test.py 连通性测试，正文与 reddit_rss_monitor 告警邮件\n"
        "使用同一套 format_alert_email_body 模板（含法医审计 Copy & Paste 块）。\n\n"
        f"生成时间（本地）：{stamp}\n"
        f"SCG 展开为：{origin}\n\n"
        "--- 以下为模板正文（样例数据）---\n\n"
        + format_alert_email_body(
            title="[样例] /u/sleep-choice-bot on Saatva vs. lower back pain — worth it?",
            link="https://www.reddit.com/r/Mattress/comments/EXAMPLE123/sample_thread/",
            summary=(
                "Synthetic preview row. Real alerts use live RSS title + summary + link."
            ),
            feed_url="https://www.reddit.com/r/Mattress/new/.rss",
            matches=["Saatva", "back pain"],
        )
    )

    try:
        send_email(subject=subject, body=body)
    except Exception as e:
        print(f"[fail] 发送失败：{e}", file=sys.stderr)
        sys.exit(1)

    print(f"[ok] 模板测试邮件已发送到 {to_addr!r}。", flush=True)


if __name__ == "__main__":
    main()
