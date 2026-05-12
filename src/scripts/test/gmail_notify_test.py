#!/usr/bin/env python3
"""
Verify Gmail credentials from repo-root ``.env`` / ``.env.local`` and optionally send a test mail.

Uses the same variables as ``reddit_rss_monitor.py``:

    GMAIL_USER, GMAIL_PASS  (Google App Password)
    GMAIL_TO                  (optional; defaults to GMAIL_USER)

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

from reddit_rss_monitor import load_env, send_email  # noqa: E402


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

    if args.dry_run:
        print("[dry-run] 未连接 SMTP，未发送邮件。", flush=True)
        return

    stamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")
    subject = "[sleep-choice] Gmail 测试邮件"
    body = (
        "这是一封来自 sleep-choice 仓库脚本的连通性测试。\n\n"
        f"发送时间（本地）：{stamp}\n"
        "若收到此邮件，说明 GMAIL_USER / GMAIL_PASS / GMAIL_TO 配置可用。\n"
    )

    try:
        send_email(subject=subject, body=body)
    except Exception as e:
        print(f"[fail] 发送失败：{e}", file=sys.stderr)
        sys.exit(1)

    print(f"[ok] 测试邮件已发送到 {to_addr!r}。", flush=True)


if __name__ == "__main__":
    main()
