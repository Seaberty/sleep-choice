# -*- coding: utf-8 -*-
import asyncio
import os
import re
from pathlib import Path
from datetime import datetime, UTC
from dotenv import load_dotenv
from supabase import create_client, Client
from forensic_engine import ForensicAuditEngine

# 与 forensic_engine 一致：优先项目根目录 .env.local，其次 src/.env.local
_ROOT = Path(__file__).resolve().parents[2]
env_path = _ROOT / ".env.local"
if not env_path.is_file():
    env_path = Path(__file__).resolve().parents[1] / ".env.local"
load_dotenv(dotenv_path=env_path)

# --- 修正后的任务矩阵 ---
# 移除了无效链接，并根据 Sleep & Beyond 官网当前的 URL 结构进行了更新
SB_TARGETS = [
    # 1. PILLOWS
    {"model": "MyTravel Pillow", "url": "https://sleepandbeyond.com/product/mytravel-pillow/"},
    # {"model": "MyWoolly Pillow", "url": "https://sleepandbeyond.com/product/mywoolly-pillow/"},
    
    # # 2. COMFORTERS
    # {"model": "MyMerino Comforter", "url": "https://sleepandbeyond.com/product/mymerino-comforter/"},
    # {"model": "MyComforter", "url": "https://sleepandbeyond.com/product/mycomforter/"},

    # # 3. TOPPERS
    # {"model": "MyTopper", "url": "https://sleepandbeyond.com/product/mytopper/"},
    # # 如果该链接 404，脚本现在会捕获异常并继续
    # {"model": "MyMerino Topper", "url": "https://sleepandbeyond.com/product/mymerino-topper/"},

    # # 4. PROTECTORS
    # {"model": "MyProtector", "url": "https://sleepandbeyond.com/product/myprotector/"},
]

class SBBatchScanner:
    def __init__(self, brand="Sleep & Beyond", force_update=False):
        self.brand = brand
        self.force_update = force_update
        
        # 调试：打印环境变量状态（不打印具体值，仅确认是否存在）
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        
        if not url or not key:
            print(f"❌ 环境探测失败: 尝试加载路径 {env_path.absolute()}")
            raise ValueError("❌ 错误: 环境变量 SUPABASE_URL 或 SUPABASE_KEY 未设置。请检查 .env.local 文件位置。")
            
        self.supabase: Client = create_client(url, key)

    def get_clean_slug(self, brand, model):
        """确保 Slug 生成逻辑与 ForensicAuditEngine 严格一致"""
        def slugify(text):
            text = text.lower().replace("&", "and")
            text = re.sub(r'[^a-z0-9]+', '-', text)
            return text.strip('-')
        return slugify(f"{brand}-{model}")

    async def execute_task(self, task):
        slug = self.get_clean_slug(self.brand, task['model'])
        
        # 1. 尝试从数据库获取现有数据
        existing_record = None
        try:
            res = self.supabase.table("audit_products").select(
                "id, last_audited_at, price, original_image_url, image_url, audit_note, official_link"
            ).eq("slug", slug).execute()
            if res.data and len(res.data) > 0:
                existing_record = res.data[0]
        except Exception as e:
            print(f"⚠️ 数据库读取受阻: {e}")

        # 2. 核心判断分流逻辑
        needs_full_audit = False
        needs_data_patch = False

        if not existing_record or self.force_update:
            # 情况 A: 完全没记录，或者强制更新 -> 走全量
            needs_full_audit = True
        elif not existing_record.get('audit_note'):
            # 情况 B: 有记录但没审计笔记 -> AI 之前可能崩了，走全量
            print(f"🔍 发现残缺审计记录: {task['model']}，准备重新触发全量审计...")
            needs_full_audit = True
        elif (
            not existing_record.get('price')
            or existing_record.get('price') == 0
            or not existing_record.get('original_image_url')
            or not existing_record.get('image_url')
        ):
            # 情况 C: 审计完整但缺价格 / 图源 / Storage 图链 -> 补完并同步 product_offers
            print(f"🩹 发现缺失市场数据: {task['model']}，准备执行数据补完...")
            needs_data_patch = True
        else:
            # 情况 D: 数据很完美
            print(f"⏩ 跳过: {task['model']} 已有完整存证。")
            return


        # 3. 根据判断结果执行操作
        engine = ForensicAuditEngine(self.brand, task['model'])
        
        if needs_full_audit:
            print(f"\n[法医扫描-全量] 正在分析: {self.brand} {task['model']}")
            try:
                await engine.execute_and_sync(task['url'])
                print(f"✅ {task['model']} 全量同步成功。")
            except Exception as e:
                print(f"❌ {task['model']} 全量任务失败: {e}")

        elif needs_data_patch:
            print(f"\n[法医扫描-补完] 正在重新抓取 DOM: {task['model']}")
            try:
                new_site_data = await engine.fetch_site_data(task['url'])

                update_payload = {}
                if new_site_data.get("price", 0) > 0:
                    update_payload["price"] = new_site_data["price"]
                if new_site_data.get("original_image"):
                    update_payload["original_image_url"] = new_site_data["original_image"]
                    hosted = await engine.transfer_to_supabase_storage(
                        new_site_data["original_image"]
                    )
                    if hosted:
                        update_payload["image_url"] = hosted
                    elif existing_record.get("image_url"):
                        update_payload["image_url"] = existing_record["image_url"]

                if update_payload:
                    now_iso = datetime.now(UTC).isoformat()
                    update_payload["updated_at"] = now_iso
                    update_payload["last_audited_at"] = now_iso
                    self.supabase.table("audit_products").update(update_payload).eq(
                        "slug", slug
                    ).execute()
                    print(f"✅ {task['model']} 市场数据已修正: {update_payload}")
                else:
                    print(f"⚠️ {task['model']} 补完尝试未获取到新信息。")

                if new_site_data.get("price", 0) > 0:
                    try:
                        self.supabase.table("product_offers").upsert(
                            {
                                "product_id": existing_record["id"],
                                "site_name": self.brand,
                                "price": new_site_data["price"],
                                "offer_url": existing_record.get("official_link")
                                or task["url"],
                                "is_primary": True,
                                "status": "active",
                                "last_checked_at": datetime.now(UTC).isoformat(),
                            },
                            on_conflict="product_id, site_name",
                        ).execute()
                        print(f"✅ {task['model']} product_offers 价格已同步。")
                    except Exception as oe:
                        print(f"⚠️ product_offers 同步失败: {oe}")
            except Exception as e:
                print(f"❌ {task['model']} 补完任务失败: {e}")

    async def main_loop(self):
        print(f"🚀 启动 {self.brand} 自动化审计程序...")
        for i, task in enumerate(SB_TARGETS):
            print(f"\n进度: [{i+1}/{len(SB_TARGETS)}]")
            await self.execute_task(task)
            
            if i < len(SB_TARGETS) - 1:
                # 针对 Sleep & Beyond 增加至 25s 冷却，防止 IP 被封禁
                await asyncio.sleep(25)
        
        print("\n🏁 批处理任务结束。")

if __name__ == "__main__":
    scanner = SBBatchScanner(force_update=True)
    asyncio.run(scanner.main_loop())