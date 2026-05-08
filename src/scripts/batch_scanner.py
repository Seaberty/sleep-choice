# -*- coding: utf-8 -*-
import asyncio
import os
import re
from pathlib import Path
from datetime import datetime, UTC
from dotenv import load_dotenv
from supabase import create_client, Client
from forensic_engine import ForensicAuditEngine

# 与 forensic_engine / sb_batch_scanner 一致：优先项目根目录 .env.local
_ROOT = Path(__file__).resolve().parents[2]
env_path = _ROOT / ".env.local"
if not env_path.is_file():
    env_path = Path(__file__).resolve().parents[1] / ".env.local"
load_dotenv(dotenv_path=env_path)

# --- 任务矩阵：Saatva 全量采集目标 ---
SAATVA_TARGETS = [
    {"model": "Classic", "url": "https://www.saatva.com/mattresses/saatva-classic"},
    {"model": "Rx", "url": "https://www.saatva.com/mattresses/saatva-rx"},
    {"model": "Loom & Leaf", "url": "https://www.saatva.com/mattresses/loom-and-leaf"},
    {"model": "Latex Hybrid", "url": "https://www.saatva.com/mattresses/saatva-latex-hybrid"},
    {"model": "Solaire", "url": "https://www.saatva.com/mattresses/solaire"},
    {"model": "Zenhaven", "url": "https://www.saatva.com/mattresses/zenhaven"},
    {"model": "HD", "url": "https://www.saatva.com/mattresses/saatva-hd"},
    {"model": "Memory Foam Hybrid", "url": "https://www.saatva.com/mattresses/memory-foam-hybrid"},
    {"model": "Youth", "url": "https://www.saatva.com/mattresses/saatva-youth"},
    {"model": "Crib", "url": "https://www.saatva.com/mattresses/crib-mattress"},
 
]


class BatchScanner:
    """Saatva 批量调度：全量审计 + 缺失价格/图源时的轻量补完（对齐 sb_batch_scanner）。"""

    def __init__(self, brand="Saatva", force_update=False):
        self.brand = brand
        self.force_update = force_update
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            print(f"❌ 环境探测失败: 尝试加载路径 {env_path.absolute()}")
            raise ValueError("❌ 错误: 环境变量 SUPABASE_URL 或 SUPABASE_KEY 未设置")
        self.supabase: Client = create_client(url, key)

    def get_clean_slug(self, brand, model):
        """与 ForensicAuditEngine.slug 完全一致"""
        def slugify(text):
            text = text.lower().replace("&", "and")
            text = re.sub(r'[^a-z0-9]+', '-', text)
            return text.strip('-')

        return slugify(f"{brand}-{model}")

    async def execute_task(self, task):
        slug = self.get_clean_slug(self.brand, task["model"])

        existing_record = None
        try:
            res = self.supabase.table("audit_products").select(
                "id, last_audited_at, price, original_image_url, image_url, audit_note, official_link"
            ).eq("slug", slug).execute()
            if res.data and len(res.data) > 0:
                existing_record = res.data[0]
        except Exception as e:
            print(f"⚠️ 数据库读取受阻: {e}")

        needs_full_audit = False
        needs_data_patch = False

        if not existing_record or self.force_update:
            needs_full_audit = True
        elif not existing_record.get("audit_note"):
            print(f"🔍 发现残缺审计记录: {task['model']}，准备重新触发全量审计...")
            needs_full_audit = True
        elif (
            not existing_record.get("price")
            or existing_record.get("price") == 0
            or not existing_record.get("original_image_url")
            or not existing_record.get("image_url")
        ):
            print(f"🩹 发现缺失市场数据: {task['model']}，准备执行数据补完...")
            needs_data_patch = True
        else:
            print(f"⏩ 跳过: {task['model']} 已有完整存证。")
            return

        engine = ForensicAuditEngine(self.brand, task["model"])

        if needs_full_audit:
            print(f"\n[法医扫描-全量] 正在分析: {self.brand} {task['model']}")
            try:
                await engine.execute_and_sync(task["url"])
                print(f"✅ {task['model']} 全量同步成功。")
            except Exception as e:
                print(f"❌ {task['model']} 全量任务失败: {e}")

        elif needs_data_patch:
            print(f"\n[法医扫描-补完] 正在重新抓取 DOM: {task['model']}")
            try:
                new_site_data = await engine.fetch_site_data(task["url"])

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
        print(f"🚀 启动 {self.brand} 官网全量审计流...")
        for i, task in enumerate(SAATVA_TARGETS):
            print(f"\n进度: [{i + 1}/{len(SAATVA_TARGETS)}]")
            await self.execute_task(task)

            if i < len(SAATVA_TARGETS) - 1:
                print("⏳ 冷却 25s 以维持协议指纹正常...")
                await asyncio.sleep(25)

        print("\n🏁 所有任务执行完毕。")


if __name__ == "__main__":
    scanner = BatchScanner(force_update=False)
    asyncio.run(scanner.main_loop())
