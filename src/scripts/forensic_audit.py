# -*- coding: utf-8 -*-
import os
import socket
import json
import asyncio
import hashlib
import requests
from datetime import datetime, UTC
from io import BytesIO
from dotenv import load_dotenv

# 核心库
from supabase import create_client, Client
from playwright.async_api import async_playwright
from google import genai
from google.genai import types

# --- 1. 初始化环境 ---
load_dotenv(dotenv_path=".env.local")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
ai_client = genai.Client(api_key=GEMINI_API_KEY)

class ForensicAuditEngine:
    """法医级审计引擎：负责数据采集、AI分析与自动化逻辑"""
    
    def __init__(self, brand, model):
        self.brand = brand
        self.model = model
        self.slug = f"{brand}-{model}".lower().replace(" ", "-")
        self.brand_slug = brand.lower().replace(" ", "-")

    def generate_hash(self):
        seed = f"{self.brand}{self.model}{datetime.now().strftime('%Y%m%d')}"
        return hashlib.sha256(seed.encode()).hexdigest()[:8].upper()
    
    def calculate_confidence(self, live_data, audit_json):
        score = 0.5
        if live_data.get('price', 0) > 0: score += 0.1
        if len(live_data.get('raw_reviews', "")) > 500: score += 0.2
        if audit_json.get('specs_matrix'): score += 0.2
        return round(min(1.0, score), 2)

    async def fetch_live_data(self, url):
        """抓取官网实时价格、图片与Reddit舆情"""
        print(f"🌐 启动法医扫描: {url}")
        results = {"price": 0.0, "raw_reviews": "", "original_image": None}
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(user_agent="Mozilla/5.0 Forensic-Bot/2.6")
            page = await context.new_page()
            
            try:
                await page.goto(url, wait_until="networkidle", timeout=60000)
                
                # 提取 JSON-LD (核心证据提取)
                try:
                    json_ld_raw = await page.evaluate('() => document.querySelector("script[type=\'application/ld+json\']").innerText')
                    json_ld = json.loads(json_ld_raw)
                    
                    # 价格解析
                    offers = json_ld.get('offers', {})
                    if isinstance(offers, list):
                        results['price'] = float(offers[0].get('price', 0))
                    else:
                        results['price'] = float(offers.get('price', 0))
                    
                    # 图片解析
                    img = json_ld.get('image')
                    results['original_image'] = img[0] if isinstance(img, list) else img
                except:
                    print("⚠️ 官网 JSON-LD 提取受阻，尝试备用解析...")

                # 抓取 Reddit 舆情
                reddit_url = f"https://www.reddit.com/search/?q={self.brand}%20{self.model}%20review"
                await page.goto(reddit_url, wait_until="networkidle")
                posts = await page.query_selector_all('h3')
                results['raw_reviews'] = "\n".join([await post.inner_text() for post in posts[:5]])

            except Exception as e:
                print(f"❌ 扫描中断: {e}")
            finally:
                await browser.close()
        return results

    async def analyze_with_gemini(self, live_data):
        """调用AI进行结构化分析"""
        hash_id = self.generate_hash()
        instruction = f"""
        PERFORM A FORENSIC AUDIT FOR {self.brand} {self.model}. 
        OUTPUT IN ALL-CAPS CLINICAL STYLE. RETURN JSON ONLY.
        KEYS: audit_scores(overall, support, cooling, pressure, durability), 
        specs_matrix, audit_note, summary_log, pros, cons.
        """
        try:
            response = ai_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[instruction, live_data['raw_reviews']],
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            return json.loads(response.text)
        except: return None
        
    async def upload_to_supabase_storage(self, source_url):
        """转储图片到云端存储桶"""
        if not source_url or not source_url.startswith('http'): return None
        try:
            resp = requests.get(source_url, timeout=10)
            if resp.status_code != 200: return source_url
            
            file_ext = source_url.split('.')[-1].split('?')[0] or 'jpg'
            file_path = f"{self.slug}/audit_{self.generate_hash()}.{file_ext}"
            
            supabase.storage.from_("product-assets").upload(
                path=file_path, file=resp.content,
                file_options={"content-type": resp.headers.get('Content-Type', 'image/jpeg')}
            )
            return supabase.storage.from_("product-assets").get_public_url(file_path)
        except: return source_url    
    
    def get_updated_history(self, old_history, new_price):
        """更新价格时序数据"""
        today = datetime.now(UTC).strftime('%Y-%m-%d')
        history = old_history if isinstance(old_history, list) else []
        if not new_price or new_price <= 0: return history

        if not history or history[-1].get('d') != today:
            history.append({"d": today, "p": float(new_price)})
        else:
            history[-1]['p'] = float(new_price) # 同一天更新最新价
        return history[-20:]

    async def execute_and_sync(self, url):
        """核心流程：采集 -> 分析 -> 存储"""
        live_data = await self.fetch_live_data(url)
        print(f"🧠 启动 AI 实验室逻辑分析...")
        audit_json = await self.analyze_with_gemini(live_data)
        
        if not audit_json: 
            print("❌ AI 分析失败。")
            return
        
        # 1. 获取旧数据用于累加历史记录
        current = supabase.table("audit_products").select("id, price_history").eq("slug", self.slug).maybe_single().execute()
        old_hist = current.data.get('price_history', []) if current.data else []
        
        # 2. 处理资产
        cloud_img = await self.upload_to_supabase_storage(live_data.get('original_image'))
        updated_hist = self.get_updated_history(old_hist, live_data.get('price'))

        # 3. 构建 Payload (对齐最新表结构)
        payload = {
            "slug": self.slug,
            "brand": self.brand,
            "brand_slug": self.brand_slug,
            "model": self.model,
            "official_link": url,
            "price": live_data.get('price', 0.0),
            "original_image_url": live_data.get('original_image'),
            "image_url": cloud_img,
            "price_history": updated_hist,
            "confidence_score": self.calculate_confidence(live_data, audit_json),
            "testing_method": "FORENSIC_NEURAL_V2.6",
            "protocol_version": "v2.6",
            "is_verified": True,
            "audit_scores": audit_json.get('audit_scores', {"overall": 0}),
            "audit_note": audit_json.get('audit_note'),
            "summary_log": audit_json.get('summary_log'),
            "pros": audit_json.get('pros', []),
            "cons": audit_json.get('cons', []),
            "technical_specs": {"matrix": audit_json.get('specs_matrix')},
            "audit_data": {
                "hash": self.generate_hash(),
                "evidence_preview": live_data.get('raw_reviews')[:200]
            },
            "last_audited_at": datetime.now(UTC).isoformat(),
            "updated_at": datetime.now(UTC).isoformat()
        }

        # 4. 同步数据库
        try:
            # 更新主表
            res = supabase.table("audit_products").upsert(payload, on_conflict="slug").execute()
            product_id = res.data[0]['id']

            # 同步关联 Offer 表 (多渠道逻辑预留)
            offer_payload = {
                "product_id": product_id,
                "site_name": self.brand,
                "price": live_data.get('price'),
                "offer_url": url,
                "is_primary": True,
                "last_checked_at": datetime.now(UTC).isoformat()
            }
            supabase.table("product_offers").upsert(offer_payload, on_conflict="product_id, site_name").execute()
            
            print(f"✅ 审计存证成功 | HASH: {payload['audit_data']['hash']}")
        except Exception as e:
            print(f"❌ 同步失败: {e}")

# --- 执行入口 ---
if __name__ == "__main__":
    target_url = "https://www.saatva.com/mattresses/saatva-rx"
    engine = ForensicAuditEngine("Saatva", "Rx")
    asyncio.run(engine.execute_and_sync(target_url))