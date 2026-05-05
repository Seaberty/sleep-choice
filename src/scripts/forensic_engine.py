# -*- coding: utf-8 -*-
import os
import json
import asyncio
import hashlib
import httpx
import re
from datetime import datetime, UTC
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential

# 核心库
from supabase import create_client, Client
from playwright.async_api import async_playwright
from google import genai
from google.genai import types

load_dotenv(dotenv_path=".env.local")

# --- 强制提前注入 ---
# 这样可以确保所有后续初始化的库（httpx, playwright, genai）都读取到同一个配置
if os.getenv("PROXY_URL"):
    os.environ["HTTP_PROXY"] = os.getenv("PROXY_URL")
    os.environ["HTTPS_PROXY"] = os.getenv("PROXY_URL")

class IntelligenceProvider:
    """情报供应商：Serper API 舆情采集"""
    def __init__(self, api_key):
        self.api_key = api_key
        self.url = "https://google.serper.dev/search" 

    async def fetch_social_proof(self, query):
        all_evidence = []
        headers = {'X-API-KEY': self.api_key, 'Content-Type': 'application/json'}
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            search_query = f"site:reddit.com OR site:sleepline.com {query} user experience"
            try:
                resp = await client.post(self.url, headers=headers, json={"q": search_query})
                data = resp.json()
                for item in data.get('organic', [])[:8]:
                    all_evidence.append(f"🔍 SOURCE: {item.get('title')}\nCONTEXT: {item.get('snippet')}")
            except Exception as e:
                print(f"⚠️ 情报采集受阻: {e}")
        return "\n\n".join(all_evidence)

class ForensicAuditEngine: 
    def __init__(self, brand, model):
        self.brand = brand
        self.model = model
        # 1. 预处理：将 & 转化为 and，处理空格
        # 2. 正则过滤：只保留字母、数字、连字符
        def slugify(text):
            text = text.lower().replace("&", "and")
            # 将所有非字母数字的字符替换为连字符
            text = re.sub(r'[^a-z0-9]+', '-', text)
            # 去掉首尾多余的连字符
            return text.strip('-')

        self.brand_slug = slugify(brand)
        # 组合后的 slug 也要跑一遍 slugify 确保 model 里的特殊字符被清洗
        self.slug = slugify(f"{brand}-{model}")
        
        self.supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
        self.ai_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        self.intel = IntelligenceProvider(os.getenv("SERPER_API_KEY"))

    def generate_hash(self):
        return hashlib.md5(f"{self.slug}-{datetime.now().date()}".encode()).hexdigest()[:8].upper()
    
    async def transfer_to_supabase_storage(self, original_url):
        """下载远程图片并存储到 Supabase Storage"""
        if not original_url:
            return None

        # 1. 确定文件名：优先使用 slug，保持与图片示例一致 (例如 saatva-rx.jpg)
        file_ext = original_url.split('.')[-1].split('?')[0] or "jpg"
        if len(file_ext) > 4: file_ext = "jpg" # 过滤超长后缀
        
        # 路径格式：品牌/产品slug.后缀
        storage_path = f"{self.brand_slug}/{self.slug}.{file_ext}"

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(original_url, timeout=15.0)
                if resp.status_code == 200:
                    # 2. 执行上传 (使用 upsert=True 避免重复审计时报错)
                    self.supabase.storage.from_("audit-images").upload(
                        path=storage_path,
                        file=resp.content,
                        file_options={
                            "content-type": resp.headers.get("content-type", "image/jpeg"),
                            "upsert": "true" 
                        }
                    )
                    
                    # 3. 返回 Supabase 内部地址
                    return self.supabase.storage.from_("product-images").get_public_url(storage_path)
        except Exception as e:
            print(f"⚠️ 图片转储至 Supabase 失败: {e}")
            return None
    
    async def fetch_site_data(self, url):
        """增强版扫描：优化代理与加载策略"""
        print(f"🌐 深度扫描官网: {url}")
        data = {"price": 0.0, "original_image": None, "raw_text": "", "status": 200}

        # 品牌特异性 CSS 选择器映射
        BRAND_MAP = {
            "Saatva": {
                "price": "[data-testid='product-price']",
                "image": "meta[property='og:image']",
                "wait_for": ".pdp-main"
            },
            "Sleep & Beyond": {
                "price": ".summary .price .woocommerce-Price-amount bdi",
                "image": "img.wp-post-image",
                "wait_for": ".product_title"
            },
            "FluffCo": {
                "price": ".product-single__price",
                "image": ".product-single__photo--featured img",
                "wait_for": "h1"
            }
        }

        # 获取当前品牌的特定配置
        config = BRAND_MAP.get(self.brand, {})

        # 动态获取代理
        proxy_url = os.getenv("PROXY_URL")
        proxy_settings = {"server": proxy_url} if proxy_url else None
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                proxy=proxy_settings
            )
            
            # 使用真实的浏览器 Context
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            
            try:
                # 策略：缩短超时时间，改为等待 DOM 加载完毕，而不是等待网络空闲
                response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                
                # 如果还是超时或没响应，手动抛出异常进入 catch
                if not response:
                    raise Exception("Empty Response")
                    
                print(f"📡 页面响应状态: {response.status}")
                
                if response.status == 404:
                    data['status'] = 404
                    return data

                # 额外等待 2 秒确保价格组件渲染，比 networkidle 更省时
                await asyncio.sleep(2)
                
                # --- 映射逻辑：精准获取价格 ---
                if config.get("price"):
                    try:
                        price_text = await page.inner_text(config["price"])
                        # 清洗价格字符串 "$1,299.00" -> 1299.0
                        match = re.search(r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', price_text)
                        if match: data['price'] = float(match.group(1).replace(',', ''))
                    except: pass

                # --- 映射逻辑：精准获取图片 ---
                if config.get("image"):
                    try:
                        if config["image"].startswith("meta"):
                            data['original_image'] = await page.get_attribute(config["image"], "content")
                        else:
                            data['original_image'] = await page.get_attribute(config["image"], "src")
                    except: pass

                # 通用兜底逻辑 (LD+JSON & 正则) 保持不变...
                if data['price'] == 0.0:
                    # 执行你原有的 LD+JSON 解析代码...
                    pass

                data['raw_text'] = await page.evaluate('() => document.body.innerText.substring(0, 6000)')
                data['original_image'] = await page.evaluate('() => document.querySelector("meta[property=\'og:image\']")?.content')
            except Exception as e:
                print(f"⚠️ 官网扫描受限: {e}")
                data['error_log'] = str(e)
            finally:
                await browser.close()
        return data 

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=5, max=15))
    async def call_ai_audit(self, prompt, context):
        try:
            response = self.ai_client.models.generate_content(
                model="gemini-2.5-flash", 
                contents=[prompt, context],
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            return json.loads(response.text)
        except Exception as e:
            # 打印完整的错误细节，看看是不是 API Key 过期、欠费或被封禁
            print(f"DEBUG - Gemini API 报错详情: {str(e)}")
            raise e

    async def execute_and_sync(self, url):
        # 1. 采集数据
        site_data = await self.fetch_site_data(url)

        # --- 新增判断逻辑 ---
        # 如果价格没拿到且文本内容太短，判定为抓取失败，不触发 Gemini
        if site_data['price'] == 0.0 and len(site_data['raw_text']) < 300:
            print(f"❌ 采集完整性校验失败: {self.model}。原因：可能是被反爬拦截或 404。")
            return  # 优雅退出，不抛出异常，不触发 retry

        # 如果抓取到了 404 关键词（针对某些网站不跳转 404 页面但显示错误内容的情况）
        if "404 Not Found" in site_data['raw_text'] or "Page not found" in site_data['raw_text']:
            print(f"🚫 目标已下架: {self.model} (检测到 404 文本)")
            return
        
        # 清洗 raw_text 的工具函数
        def clean_web_text(text):
            # 1. 移除 script 和 style 块 (如果 raw_text 包含标签的话)
            text = re.sub(r'<script.*?</script>', '', text, flags=re.DOTALL)
            text = re.sub(r'<style.*?</style>', '', text, flags=re.DOTALL)
            # 2. 移除所有 HTML 标签
            text = re.sub(r'<[^>]+>', '', text)
            # 3. 将多个换行和空格合并为一个空格
            text = re.sub(r'\s+', ' ', text).strip()
            # 4. 严格限制长度 (2000-3000字符足够审计使用了)
            return text[:2500]
    
        # --- 新增：上下文瘦身逻辑 ---
        # 移除重复空格、换行符，并严格截断
        clean_text = clean_web_text(site_data['raw_text'])
        social_proof = await self.intel.fetch_social_proof(f"{self.brand} {self.model}")

        # 2. 注入审计上下文 (大幅减少 Token 占用)
        audit_context = f"--- OFFICIAL SPECS ---\n{clean_text}\n\n--- SOCIAL EVIDENCE ---\n{social_proof[:800]}"

        # 3. 精炼版 10分制 Prompt
        audit_prompt = f"""
        ACT AS A SENIOR BIOMECHANICAL AUDITOR. 
        AUDIT TARGET: {self.brand} {self.model}
        
        TASK:
        1. 10-point scale audit (audit_scores).
        2. Create a standardized matrix (technical_specs).
        3. Write a sharp clinical forensic note (audit_note).
        4. Generate a 'specs_matrix' containing 4-6 forensic indices (e.g., Spinal_Alignment_Index, Motion_Isolation_Rating, Thermal_Conductivity).

        SPECIFICATIONS:
        - audit_note: MAX 60 words. Strict clinical tone. 
        - seo_title: Create a high-CTR title (max 60 chars) including "Forensic Audit" and "Review".
        - seo_description: Max 155 chars. Focus on material integrity and audit results.
        - seo_keywords: 5-8 highly relevant comma-separated keywords (e.g., brand, model, mattress-type, spinal-alignment).
        - technical_specs: USE THESE KEYS: "Construction", "Firmness", "Support_Core", "Comfort_Layer", "Trial", "Warranty".
        - specs_matrix: DO NOT leave empty. Provide detailed mechanical evaluation for each key.

        RETURN JSON:
        {{
          "audit_scores": {{"overall": 0.0, "support": 0.0, "cooling": 0.0, "pressure": 0.0, "durability": 0.0}},
          "technical_specs": {{
              "Construction": "", "Firmness": "", "Support_Core": "", "Comfort_Layer": "", "Trial": "", "Warranty": ""
          }},
          "specs_matrix": {{
              "Spinal_Alignment": "",
              "Edge_Support_Integrity": "",
              "Motion_Transfer_Damping": "",
              "Pressure_Relief_Index": ""
          }},
          "pros": [], 
          "cons": [],
          "audit_note": "",
          "summary_log": "Generate chronological audit steps [T-00:00:00]...",
          "seo_title": "",
          "seo_description": "",
          "seo_keywords": "",
          "detected_coupon": "",
          "promo_text": ""
        }}
        """

        try:
            print(f"🧠 启动 Gemini-2.5-Flash 深度审计...")
            report = await self.call_ai_audit(audit_prompt, audit_context)
            
            # 4. 逻辑层：生成专业日志与数据校正 
            scores = report.get('audit_scores', {})
            for k in scores: # 标准化分数
                if 0 < scores[k] <= 1.0: scores[k] = round(scores[k] * 10, 1)

            # 2. 数据清洗 (必须在构建 payload 之前)
            clean_desc = report.get('seo_description', '').strip().replace('"', '')
            clean_title = report.get('seo_title', '').strip().replace('"', '')
            clean_keywords = report.get('seo_keywords', '').strip().lower()

             # 我们将 specs_matrix 放入 audit_data 字段中
            audit_data_payload = {
                "audit_hash": self.generate_hash(),
                "evidence_size": len(audit_context),
                "model": "Gemini-2.5-Flash",
                "timestamp": datetime.now(UTC).isoformat(),
                "specs_matrix": report.get('specs_matrix', {}), # 这里对应前端的 Forensic Analysis
                "protocol": "v3.0-forensic"
            }

            # 5. 构建主 Payload
            payload = {
                "slug": self.slug,
                "brand": self.brand,
                "brand_slug": self.brand_slug,
                "model": self.model,
                "official_link": url,
                "price": site_data['price'],
                "audit_scores": scores,
                "technical_specs": report.get('technical_specs'),
                "pros": report.get('pros', []),
                "cons": report.get('cons', []),
                "audit_note": report.get('audit_note'),
                "summary_log": report.get('summary_log'),

                # SEO 字段映射
                "seo_title": clean_title,
                "seo_description": clean_desc,
                "seo_keywords": clean_keywords, 

                "audit_data": audit_data_payload,
                "original_image_url": site_data['original_image'],
                "confidence_score": 0.85 if site_data['price'] > 0 else 0.6,
                "is_verified": site_data['price'] > 0,
                "protocol_version": "v3.0-forensic",
                "last_audited_at": datetime.now(UTC).isoformat(),
                "updated_at": datetime.now(UTC).isoformat()
            }

            # 6. 数据库双表同步
            res = self.supabase.table("audit_products").upsert(payload, on_conflict="slug").execute()
            
            if res.data:
                product_uuid = res.data[0]['id']
                self.supabase.table("product_offers").upsert({
                    "product_id": product_uuid,
                    "site_name": self.brand,
                    "price": site_data['price'],
                    "offer_url": url,
                    "coupon_code": report.get('detected_coupon'),
                    "promo_text": report.get('promo_text') or "Best Offer Detected",
                    "is_primary": True,
                    "last_checked_at": datetime.now(UTC).isoformat()
                }, on_conflict="product_id, site_name").execute()

                print(f"✅ 审计存证已锁定: {self.slug} | 价格: {site_data['price']} | 指纹: {payload['audit_data']['audit_hash']}")

        except Exception as e:
            print(f"❌ 级联同步失败: {e}")

# if __name__ == "__main__":
#     engine = ForensicAuditEngine("Saatva", "Rx")
#     asyncio.run(engine.execute_and_sync("https://www.saatva.com/mattresses/saatva-rx"))