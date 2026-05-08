# -*- coding: utf-8 -*-
import asyncio
import os
import re
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from forensic_engine import ForensicAuditEngine

# 加载环境变量
_ROOT = Path(__file__).resolve().parents[2]
env_path = _ROOT / ".env.local"
if not env_path.is_file():
    env_path = Path(__file__).resolve().parents[1] / ".env.local"
load_dotenv(dotenv_path=env_path)

# --- 建议的任务矩阵：按“价格梯度”获取 ---
# 每个产品只取核心规格，避免数量爆炸，同时保证价格覆盖
FLUFFCO_TARGETS = [
    # 1. PILLOWS (枕头系列)
    {
        "model": "Down Feather Pillow", 
        "spec_label": "Standard / Soft/Medium",
        "url": "https://fluff.co/products/down-feather-pillow?variant=35113578889377"
    },
    {
        "model": "Down Alternative Pillow", 
        "spec_label": "Standard / Soft/Medium",
        "url": "https://fluff.co/products/down-alternative-pillow?variant=35113580527777"
    },

    # 2. COMFORTERS (被褥系列)
    {
        "model": "Down Blended Comforter", 
        "spec_label": "Queen / All Season",
        "url": "https://fluff.co/products/down-blended-comforter-1?variant=39752258519201"
    },
    {
        "model": "Down Alternative Comforter", 
        "spec_label": "Queen / All Season",
        "url": "https://fluff.co/products/down-alternative-comforter?variant=40396635078817"
    },

    # 3. BATH (修正后的浴袍与毛巾系列 - 对应截图 Bath 栏目)
    {
        "model": "Hotel Lounge Robe", 
        "spec_label": "White / L/XL",
        "url": "https://fluff.co/products/hotel-lounge-robe?variant=39752183447713"
    },
    {
        "model": "Hotel Waffle Robe", 
        "spec_label": "White / L/XL",
        "url": "https://fluff.co/products/hotel-waffle-robe?variant=49119638749478"
    },
    {
        "model": "Hotel Towel", 
        "spec_label": "White / Standard",
        "url": "https://fluff.co/products/hotel-towel?variant=40808608858273"
    },

    # 4. SHEETS & SILK (床单与真丝系列)
    {
        "model": "Silk Pillowcase", 
        "spec_label": "White / Queen",
        "url": "https://fluff.co/products/silk-pillowcase?variant=35113585016865"
    },

    # 5. BUNDLES (截图右侧强力推荐的高佣金套装)
    {
        "model": "2x Hotel Pillows & Pillowcase Set", 
        "spec_label": "Down Alternative / Standard",
        "url": "https://fluff.co/products/2x-hotel-pillows-pillowcase-set-down-alternative?variant=44681905733926"
    },
    {
        "model": "Pillow & Comforter Kit", 
        "spec_label": "Standard / Queen",
        "url": "https://fluff.co/products/pillow-comforter-kit?variant=35113586032705"
    }
]

class FluffCoForensicScanner:
    def __init__(self, force_update=False):
        self.brand = "FluffCo"
        self.force_update = force_update

        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise ValueError("❌ SUPABASE 配置缺失")
        self.supabase: Client = create_client(url, key)

    @staticmethod
    def _slugify(text: str) -> str:
        """与 ForensicAuditEngine 内逻辑一致：brand-model → URL slug。"""
        text = text.lower().replace("&", "and")
        text = re.sub(r"[^a-z0-9]+", "-", text)
        return text.strip("-")

    def slug_for_model(self, model: str) -> str:
        return self._slugify(f"{self.brand}-{model}")

    async def execute_audit(self, task):
        # slug 与 ForensicAuditEngine 默认规则一致：slugify("{brand}-{model}")，不传 slug_override
        slug = self.slug_for_model(task["model"])
        engine = ForensicAuditEngine(self.brand, task["model"])
        print(f"\n📑 启动审计存档: {task['model']}")

        # 1. 检查数据库是否存在该规格存档
        res = self.supabase.table("audit_products").select("id").eq("slug", slug).execute()
        existing = res.data[0] if res.data else None

        if existing and not self.force_update:
            print(f"⏩ 已存在，跳过。")
            return

        # 2. 调用法医引擎 (ForensicAuditEngine) 抓取真实 DOM
        try:
            # 抓取包含特定 Variant 的价格、图片和参数
            await engine.execute_and_sync(task['url'])
            
            # 获取新生成的 ID（slug 必须与引擎 upsert 一致，见 slug_override）
            res = self.supabase.table("audit_products").select("id").eq("slug", slug).execute()
            if not res.data:
                raise RuntimeError(
                    f"未查到 slug={slug} 的记录；请确认 ForensicAuditEngine 使用了相同的 slug_override。"
                )
            print(f"✅ 审计完成!")

        except Exception as e:
            print(f"❌ 审计过程中止: {e}")

    async def start(self):
        print(f"🚀 Seabert Intelligence Unit: {self.brand} 专项审计启动...")
        for i, task in enumerate(FLUFFCO_TARGETS):
            print(f"\n进度: [{i+1}/{len(FLUFFCO_TARGETS)}]")
            await self.execute_audit(task)
            if i < len(FLUFFCO_TARGETS) - 1:
                await asyncio.sleep(20) # 安全间隔

if __name__ == "__main__":
    scanner = FluffCoForensicScanner(force_update=True)
    asyncio.run(scanner.start())