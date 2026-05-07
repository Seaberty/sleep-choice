# -*- coding: utf-8 -*-
import asyncio
import os
import re
import urllib.parse
from pathlib import Path
from datetime import datetime, UTC
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
        self.impact_base = "https://fluffco.pxf.io/jeK6vZ"
        
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise ValueError("❌ SUPABASE 配置缺失")
        self.supabase: Client = create_client(url, key)

    def get_smart_slug(self, url):
        """利用 Variant ID 生成唯一 Slug，确保数据库不冲突"""
        variant_id = re.search(r'variant=(\d+)', url).group(1)
        return f"fluffco-audit-{variant_id}"

    def generate_deep_link(self, target_url):
        """生成 Impact 深度追踪链接"""
        encoded_url = urllib.parse.quote(target_url, safe='')
        return f"{self.impact_base}?u={encoded_url}&subId1=forensic_audit"

    async def execute_audit(self, task):
        # 必须与 ForensicAuditEngine 写入的 slug 一致：引擎默认用 brand-model，
        # 多规格时用 variant 衍生 slug，否则会 upsert 成功但后续按错误 slug 查库 → data[0] 越界。
        slug = self.get_smart_slug(task["url"])
        engine = ForensicAuditEngine(self.brand, task["model"], slug_override=slug)
        print(f"\n📑 启动审计存档: {task['model']} [{task['spec_label']}]")

        # 1. 检查数据库是否存在该规格存档
        res = self.supabase.table("audit_products").select("id").eq("slug", slug).execute()
        existing = res.data[0] if res.data else None

        if existing and not self.force_update:
            print(f"⏩ 规格已存在，跳过。")
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
            product_uuid = res.data[0]["id"]

            # 3. 核心：统一 ID 与 深度链接更新
            # 生成全站唯一的 Archive ID (如 FL-35113578)
            archive_id = f"FL-{str(product_uuid)[:8].upper()}"
            deep_link = self.generate_deep_link(task['url'])
            
            # 存入数据库，同时把规格信息存入 audit_note 而非 model 名
            self.supabase.table("audit_products").update({
                "official_link": deep_link,
                "audit_archive_id": archive_id,
                "audit_note": f"Target Specification: {task['spec_label']}",
                "updated_at": datetime.now(UTC).isoformat()
            }).eq("id", product_uuid).execute()

            print(f"✅ 审计完成! ARCHIVE_ID: {archive_id}")
            print(f"🔗 深度链接已就绪。")

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
    scanner = FluffCoForensicScanner(force_update=False)
    asyncio.run(scanner.start())