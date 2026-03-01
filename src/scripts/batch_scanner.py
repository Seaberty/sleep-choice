# -*- coding: utf-8 -*-
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from forensic_engine import ForensicAuditEngine

# 加载环境变量
load_dotenv(dotenv_path=".env.local")

# --- 任务矩阵：Saatva 全量采集目标 ---
SAATVA_TARGETS = [
    # {"model": "Classic", "url": "https://www.saatva.com/mattresses/saatva-classic"},
    # {"model": "Rx", "url": "https://www.saatva.com/mattresses/saatva-rx"},
    # {"model": "Loom & Leaf", "url": "https://www.saatva.com/mattresses/loom-and-leaf"},
    # {"model": "Latex Hybrid", "url": "https://www.saatva.com/mattresses/saatva-latex-hybrid"},
    # {"model": "Solaire", "url": "https://www.saatva.com/mattresses/solaire"},
    # {"model": "Zenhaven", "url": "https://www.saatva.com/mattresses/zenhaven"},
    # {"model": "HD", "url": "https://www.saatva.com/mattresses/saatva-hd"},
    # {"model": "Memory Foam Hybrid", "url": "https://www.saatva.com/mattresses/memory-foam-hybrid"},
    # {"model": "Youth", "url": "https://www.saatva.com/mattresses/saatva-youth"},
    # {"model": "Crib", "url": "https://www.saatva.com/mattresses/crib-mattress"},
    # {"model": "Adjustable Base Plus", "url": "https://www.saatva.com/adjustable-bases/adjustable-base-plus"},
    # {"model": "Upper Flex Base", "url": "https://www.saatva.com/adjustable-bases/upper-flex-adjustable-base"},
    # {"model": "Foundation", "url": "https://www.saatva.com/foundations/mattress-foundation"},
    # {"model": "Platform Bed", "url": "https://www.saatva.com/bed-frames/platform-bed"},
    # {"model": "Bed Frame", "url": "https://www.saatva.com/bed-frames/bed-frame"},
    # {"model": "Graphite Topper", "url": "https://www.saatva.com/mattress-toppers/graphite-memory-foam-topper"},
    # {"model": "Latex Topper", "url": "https://www.saatva.com/mattress-toppers/latex-mattress-topper"},
    # {"model": "Micro-Coil Topper", "url": "https://www.saatva.com/mattress-toppers/micro-coil-mattress-topper"},
    # {"model": "Latex Pillow", "url": "https://www.saatva.com/pillows/latex-pillow"},
    # {"model": "Cloud Pillow", "url": "https://www.saatva.com/pillows/saatva-cloud-pillow"},
    # {"model": "Graphite Pillow", "url": "https://www.saatva.com/pillows/graphite-memory-foam-pillow"},
    # {"model": "Organic Sheets", "url": "https://www.saatva.com/bed-sheets/organic-sateen-sheets"},
    # {"model": "Weighted Blanket", "url": "https://www.saatva.com/blankets/weighted-blanket"},
    # {"model": "Mattress Pad", "url": "https://www.saatva.com/mattress-pads/dual-sided-mattress-pad"},
    {"model": "Silk Eye Mask", "url": "https://www.saatva.com/eye-masks/weighted-silk-eye-mask"}
]

class BatchScanner:
    """Audit-Pulse v3.0: 工业级批量扫描调度器"""
    
    def __init__(self, brand="Saatva", force_update=False):
        self.brand = brand
        self.force_update = force_update # 是否强制更新已存在的记录
        # 修复点：初始化 Supabase 客户端
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise ValueError("❌ 错误: 环境变量 SUPABASE_URL 或 SUPABASE_KEY 未设置")
        self.supabase: Client = create_client(url, key)

    async def execute_task(self, task):
        # 生成 slug 以便查询
        slug = f"{self.brand}-{task['model']}".lower().replace(" ", "-")
        
        # 1. 如果不是强制更新，先检查数据库
        if not self.force_update:
            try:
                res = self.supabase.table("audit_products").select("last_audited_at").eq("slug", slug).execute()
                if res.data and len(res.data) > 0:
                    last_audit = res.data[0].get('last_audited_at')
                    print(f"⏩ 跳过: {task['model']} 已于 {last_audit} 完成审计。")
                    return
            except Exception as e:
                print(f"⚠️ 数据库查询异常 (将继续尝试采集): {e}")

        # 2. 执行逻辑
        print(f"\n[任务指派] 目标型号: {self.brand} {task['model']}")
        engine = ForensicAuditEngine(self.brand, task['model'])
        try:
            await engine.execute_and_sync(task['url'])
            print(f"✅ {task['model']} 已存证锁定。")
        except Exception as e:
            print(f"❌ {task['model']} 扫描中断: {e}")

    async def main_loop(self):
        print(f"🚀 启动 {self.brand} 官网全量审计流...")
        for i, task in enumerate(SAATVA_TARGETS):
            print(f"\n进度: [{i+1}/{len(SAATVA_TARGETS)}]")
            await self.execute_task(task)
            
            # 只有在真正执行了采集任务后才冷却
            if i < len(SAATVA_TARGETS) - 1:
                print("⏳ 冷却 25s 以维持协议指纹正常...")
                await asyncio.sleep(25)
        
        print("\n🏁 所有任务执行完毕。")

if __name__ == "__main__":
    # 如果想覆盖已有的数据，可以将 force_update 设为 True
    scanner = BatchScanner(force_update=False)
    asyncio.run(scanner.main_loop())