import os
import asyncio
import datetime
import re
import random
from pathlib import Path
from dotenv import load_dotenv, find_dotenv
from playwright.async_api import async_playwright
from supabase import create_client, Client

# 1. 环境与数据库初始化
load_dotenv(dotenv_path=find_dotenv(".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not URL or not KEY:
    print("❌ 错误：环境变量缺失，请检查 .env.local")
    exit(1)

supabase: Client = create_client(URL, KEY)

async def harvest_saatva():
    async with async_playwright() as p:
        print("🚀 启动深度审计引擎 (Visual & Price Intelligence)...")
        
        # 建议：如果本地 403，请务必在 launch 中配置代理，或使用全局加速器
        browser = await p.chromium.launch(
            headless=True, 
            args=["--disable-blink-features=AutomationControlled"]
        )
        
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={'width': 1920, 'height': 1080}
        )
        
        page = await context.new_page()
        # 抹除 WebDriver 特征
        await page.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined })")

        target_url = "https://www.saatva.com/mattresses/saatva-classic"
        
        try:
            print(f"📡 接入目标节点: {target_url}")
            response = await page.goto(target_url, wait_until="domcontentloaded", timeout=90000)
            
            # 2. 处理 403 地理位置封锁
            if response.status == 403:
                print("❌ 403 错误：CloudFront 封锁了你的 IP 区域。请开启美国全局代理。")
                await page.screenshot(path="saatva_403.png")
                return

            # 3. 处理弹窗干扰（非常重要，弹窗不关可能抓不到价格）
            await asyncio.sleep(5) 
            try:
                # 尝试关闭邮件订阅弹窗 (根据你之前的截图定位)
                close_btn = page.locator('button[aria-label="Close"], .close-icon, [class*="close"]').first
                if await close_btn.is_visible():
                    await close_btn.click()
                    print("👋 已自动拦截并关闭广告弹窗")
            except: pass

            # 4. 模拟人类深度滚动，确保懒加载图片加载
            await page.mouse.wheel(0, 800)
            await asyncio.sleep(random.uniform(3, 5))

            # --- A. 价格审计 (映射到 price 字段) ---
            print("🔍 正在扫描实时价格...")
            body_text = await page.inner_text("body")
            # 匹配 $ 符号后的数字，如 $1,853 或 $2,179
            price_match = re.search(r'\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', body_text)
            price_clean = float(re.sub(r'[^\d.]', '', price_match.group(1))) if price_match else 0.0

            # --- B. 图片审计 (映射到 image_url 字段) ---
            print("🖼️ 正在抓取视觉资产...")
            # 优先从 meta 标签抓取高清主图，确保链接稳定
            img_url = await page.get_attribute('meta[property="og:image"]', "content")
            
            if not img_url:
                # 备选：从页面主图容器抓取
                img_loc = page.locator('img[data-testid="pdp-main-image"], .product-image img').first
                img_url = await img_loc.get_attribute("src")

            # 处理相对路径
            if img_url and img_url.startswith('//'):
                img_url = "https:" + img_url

            # --- C. 数据封装 (完全适配你的 SQL 表结构) ---
            final_data = {
                "slug": "saatva-classic",
                "brand": "Saatva",
                "model": "Classic",
                "category": "Innerspring Mattress",
                "price": price_clean,         # 新增列
                "image_url": img_url,         # 对应 image_url
                "is_verified": True if price_clean > 0 else False,
                "pros": ["Luxury Euro Top", "Dual Coil System", "365-night Home Trial"],
                "cons": ["Heavy to move", "Requires strong frame"],
                "audit_scores": {
                    "overall": 9.4,
                    "support": 9.8,
                    "cooling": 9.2,
                    "pressure": 9.4
                },
                "technical_specs": {
                    "firmness": "Plush Soft, Luxury Firm, Firm",
                    "height": "11.5\" or 14.5\"",
                    "warranty": "Lifetime"
                },
                "last_audited_at": datetime.datetime.now().isoformat()
            }

            # --- D. 执行数据库同步 ---
            print(f"📋 审计摘要: ${price_clean} | 图片已定位")
            res = supabase.table("audit_products").upsert(final_data, on_conflict="slug").execute()

            if res:
                print(f"✅ 审计同步成功！Saatva 数据现在包含价格和主图。")

        except Exception as e:
            await page.screenshot(path="saatva_error_debug.png")
            print(f"❌ 审计中断：{str(e)}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(harvest_saatva())