# -*- coding: utf-8 -*-
"""
Sleep & Beyond 专用入口（与合并前的 sb_batch_scanner 用法一致）。

等价：python batch_scanner.py --brand "Sleep & Beyond"

逻辑已全部并入 batch_scanner.IntelBatchScanner / SBBatchScanner。
"""
from __future__ import annotations

import asyncio

from batch_scanner import SBBatchScanner


def main() -> None:
    asyncio.run(SBBatchScanner(force_update=False).main_loop())


if __name__ == "__main__":
    main()
