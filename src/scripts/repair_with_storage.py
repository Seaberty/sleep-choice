# -*- coding: utf-8 -*-
import os
import asyncio
import httpx
import mimetypes
import re
import random
from urllib.parse import urlparse, urlunparse
from datetime import datetime, UTC
from dotenv import load_dotenv
from supabase import create_client, Client
from playwright.async_api import async_playwright

load_dotenv(dotenv_path=".env.local")

class ForensicRepairman:
    def __init__(self):
        self.supabase: Client = create_client(
            os.getenv("SUPABASE_URL"), 
            os.getenv("SUPABASE_KEY")
        )
        self.bucket_name = "product-images"
        # 模拟真实浏览器 Header
        self.common_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.saatva.com/",
            "Cache-Control": "no-cache"
        }

    def get_clean_raw_url(self, url):
        """清洗 URL 参数，获取最高清母本"""
        if not url: return None
        try:
            parsed = urlparse(url)
            return urlunparse((parsed.scheme, parsed.netloc, parsed.path, '', '', ''))
        except:
            return url

    def slugify(self, text):
        """文件名安全化：& -> and，移除特殊字符"""
        text = text.lower().replace("&", "and")
        text = re.sub(r'[^a-z0-9]+', '-', text)
        return text.strip('-')

    async def upload_to_storage(self, image_url, slug):
        """带 Header 伪装的转存逻辑"""
        if not image_url: return None
        try:
            clean_url = self.get_clean_raw_url(image_url)
            async with httpx.AsyncClient(headers=self.common_headers, timeout=30.0, follow_redirects=True) as client:
                resp = await client.get(clean_url)
                if resp.status_code != 200:
                    print(f"   ⚠️ 图片下载受阻 (HTTP {resp.status_code})")
                    return None
                
                ext = os.path.splitext(urlparse(clean_url).path)[1].lower() or ".jpg"
                safe_file_name = f"{self.slugify(slug)}{ext}"
                content_type = mimetypes.guess_type(safe_file_name)[0] or "image/jpeg"
                
                self.supabase.storage.from_(self.bucket_name).upload(
                    path=safe_file_name,
                    file=resp.content,
                    file_options={"content-type": content_type, "upsert": "true"}
                )
                return self.supabase.storage.from_(self.bucket_name).get_public_url(safe_file_name)
        except Exception as e:
            print(f"   ❌ Storage 写入异常: {e}")
            return None

    async def fetch_physical_only(self, url):
        """增强版抓取：绕过检测，模拟人类滚动"""
        result = {"price": 0.0, "raw_image_url": None}
        async with async_playwright() as p:
            # 关键：通过禁用自动化特征绕过 Cloudflare
            browser = await p.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled"]
            )
            context = await browser.new_context(
                user_agent=self.common_headers["User-Agent"],
                viewport={'width': 1920, 'height': 1080}
            )
            page = await context.new_page()
            
            try:
                # 模拟随机等待，增加真实性
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                
                # 检查是否触发了 Napping 页面
                content = await page.content()
                if "caught us napping" in content.lower():
                    print("🚨 触发反爬机制！请尝试手动在浏览器打开该 URL 完成验证。")
                    return result

                # 模拟人类缓慢滚动
                for i in range(3):
                    await page.mouse.wheel(0, 800)
                    await asyncio.sleep(random.uniform(0.5, 1.5))

                # 提取数据
                price = await page.evaluate('''() => {
                    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')];
                    for (let s of ld) {
                        try {
                            const data = JSON.parse(s.innerText);
                            const offer = Array.isArray(data) ? data[0].offers : data.offers;
                            const p = Array.isArray(offer) ? offer[0].price : offer?.price;
                            if (p) return p;
                        } catch(e) {}
                    }
                    return null;
                }''')
                result['price'] = float(price) if price else 0.0

                raw_image = await page.evaluate('''() => {
                    return document.querySelector('meta[property="og:image"]')?.content || 
                           document.querySelector('img[alt*="Mattress"], .hero-image img, .product-hero img')?.src;
                }''')
                result['raw_image_url'] = raw_image
                
            except Exception as e:
                print(f"❌ 页面检索中断: {e}")
            finally:
                await browser.close()
        return result

    async def run_repair_flow(self, limit=None):
        print("📊 正在扫描数据库资产...")
        res = self.supabase.table("audit_products").select(
            "id, slug, official_link, price, image_url, original_image_url"
        ).execute()
        
        all_needs_repair = [
            item for item in res.data 
            if not item.get('price') or item.get('price') == 0 or 
            not item.get('image_url') or "supabase.co" not in item.get('image_url')
        ]

        targets = all_needs_repair[:limit] if limit is not None else all_needs_repair

        if not targets:
            print("✨ 检查完毕：所有数据均已完美本地化。")
            return

        print(f"🚩 准备修复 {len(targets)} 条记录...")

        for item in targets:
            print(f"\n🛠️ 处理中: {item['slug']}")
            
            patch = await self.fetch_physical_only(item['official_link'])
            
            # 如果触发反爬导致抓不到数据，跳过当前循环
            if not patch['raw_image_url'] and patch['price'] == 0:
                print("⏭️ 因被拦截或抓取失败，跳过该项...")
                continue

            raw_url = patch['raw_image_url']
            clean_original_url = self.get_clean_raw_url(raw_url)
            
            localized_url = item.get('image_url')
            if clean_original_url:
                localized_url = await self.upload_to_storage(clean_original_url, item['slug'])

            if patch['price'] > 0 or localized_url:
                update_data = {
                    "price": patch['price'] if patch['price'] > 0 else item.get('price'),
                    "image_url": localized_url if localized_url else item.get('image_url'),
                    "original_image_url": clean_original_url if clean_original_url else item.get('original_image_url'),
                    "is_verified": patch['price'] > 0,
                    "updated_at": datetime.now(UTC).isoformat()
                }
                self.supabase.table("audit_products").update(update_data).eq("id", item['id']).execute()
                print(f"✅ 修复存证成功")
            
            # 💡 核心：随机冷却时间，让爬虫像真人一样“逛网站”
            sleep_time = random.uniform(8, 20)
            print(f"😴 伪装人类休息中 ({sleep_time:.1f}s)...")
            await asyncio.sleep(sleep_time)

if __name__ == "__main__":
    repairman = ForensicRepairman()
    # 第一次建议跑全量，看能成功多少
    asyncio.run(repairman.run_repair_flow(limit=1))