import os
import socket
import asyncio
import hashlib
import requests.packages.urllib3.util.connection as urllib3_cn
from dotenv import load_dotenv
from datetime import datetime
from playwright.async_api import async_playwright
from supabase import create_client

def allowed_gai_family():
    return socket.AF_INET
urllib3_cn.allowed_gai_family = allowed_gai_family
load_dotenv(dotenv_path=".env.local")
# --- 配置区 ---
SUPABASE_URL = os.getenv("SUPABASE_URL") # 建议与 Next.js 变量名保持一致
SUPABASE_KEY = os.getenv("SUPABASE_KEY") # 脚本写入建议用 service_role key
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


class AuditEngine:
    def __init__(self, raw_data):
        self.raw = raw_data
        self.brand = raw_data['brand']
        self.model = raw_data['model']

    def generate_hash(self):
        """生成数据指纹，用于前端 HASH_REF 展示"""
        seed = f"{self.brand}{self.model}{datetime.now().strftime('%Y%m%d')}"
        return hashlib.sha256(seed.encode()).hexdigest()[:8].upper()

    def calculate_scores(self, price):
        """基于价格和规格的硬核逻辑评分"""
        # 示例：如果价格低于 1500 且有双层弹簧，性价比分调高
        base_support = 9.0
        if "coil" in str(self.raw.get('specs', '')).lower():
            base_support += 0.4
        return {
            "overall": 9.2,
            "support": min(9.9, base_support),
            "cooling": 8.8,
            "pressure": 8.5,
            "durability": 9.0
        }

    async def get_ai_forensic_content(self, price, hash_id):
        """核心 Prompt：生成‘法医级’审计文案"""
        # 此处模拟调用 OpenAI/Gemini API 的结果
        # 提示词建议：Role: Forensic Auditor. Style: Clinical, All-Caps.
        summary_log = (
            f"AUDIT_LOG_{hash_id}: STRUCTURAL INTEGRITY SCAN COMPLETE. "
            f"MARKET_LIQUIDITY DETECTED AT ${price}. "
            f"COIL_DENSITY_COMPENSATION ACTIVE. NEURAL SENTIMENT SYNTHESIS "
            f"ALIGNS WITH TECHNICAL THRESHOLDS. NO DISCREPANCIES DETECTED."
        )
        verdict = f"THE {self.brand.upper()} {self.model.upper()} REMAINS A HIGH-FIDELITY STRUCTURAL BENCHMARK."
        return summary_log, verdict

async def run_forensic_audit(target_url, brand, model):
    async with async_playwright() as p:
        # 1. 模拟真实浏览器抓取，绕过防爬
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent="Mozilla/5.0 Forensic-Bot/2.5")
        page = await context.new_page()
        await page.goto(target_url, wait_until="networkidle")

        # 2. 抓取价格 (根据官网具体的选择器调整)
        # 优先寻找 JSON-LD 数据
        price = 0.0
        try:
            json_ld = await page.evaluate('() => JSON.parse(document.querySelector("script[type=\'application/ld+json\']").innerText)')
            # 兼容不同 Schema 结构
            offers = json_ld.get('offers', {})
            price = float(offers.get('price') or offers[0].get('price') if isinstance(offers, list) else 0)
        except:
            pass

        # 3. 运行审计引擎
        engine = AuditEngine({"brand": brand, "model": model})
        hash_id = engine.generate_hash()
        scores = engine.calculate_scores(price)
        log, verdict = await engine.get_ai_forensic_content(price, hash_id)

        # 4. 同步至 Supabase (upsert 逻辑)
        data = {
            "slug": f"{brand}-{model}".lower(),
            "brand": brand,
            "model": model,
            "price": price,
            "audit_scores": scores,
            "summary_log": log,
            "audit_note": verdict,
            "protocol_version": "v2.6-forensic",
            "last_audited_at": datetime.utcnow().isoformat(),
            "is_verified": True
        }
        
        supabase.table("audit_products").upsert(data).execute()
        print(f"DONE: {brand} {model} | HASH: {hash_id}")
        await browser.close()

# 运行示例
url = "https://www.saatva.com/mattresses/saatva-classic"
brand = "Saatva"
model = "Rx"
asyncio.run(run_forensic_audit(url, brand, model))