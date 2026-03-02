# -*- coding: utf-8 -*-
import os
import asyncio
import random
import re
import shutil
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
        self.user_data_dir = os.path.join(os.getcwd(), "browser_profile")
        # 换回主流 Chrome UA，但配合 Firefox 内核有奇效
        self.user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        
        # 💡 请确认 v2rayU 的 HTTP 端口，通常是 1087
        self.proxy_server = "http://127.0.0.1:1087" 

    async def fetch_physical_only(self, url):
        result = {"price": 0.0, "raw_image_url": None, "auth_failed": False}
        
        # 1. 物理清理缓存：每次抓取前必做，防止指纹关联
        if os.path.exists(self.user_data_dir):
            try: shutil.rmtree(self.user_data_dir)
            except: pass

        async with async_playwright() as p:
            try:
                # 2. 启动 Firefox：自建 VPS 环境下，Firefox 穿透力比 Chrome 强 3 倍
                browser = await p.firefox.launch(
                    headless=False,
                    proxy={"server": self.proxy_server},
                    slow_mo=random.randint(200, 500)
                )
                
                # 使用持久化上下文模拟真实设备
                context = await browser.new_context(
                    user_agent=self.user_agent,
                    viewport={'width': 1920, 'height': 1080}
                )
                page = await context.new_page()
                
                # 抹除自动化痕迹
                await page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined});")

                print(f"🌐 正在抓取: {url}")
                # 3. 直接访问产品页，增加 timeout 容错
                await page.goto(url, wait_until="domcontentloaded", timeout=90000)
                
                # 预留加载时间处理动态价格
                await asyncio.sleep(random.uniform(5, 8))
                
                content = await page.content()
                if "caught us napping" in content.lower():
                    print("🚫 被拦截：自建服务器 IP 被识别。")
                    result["auth_failed"] = True
                    return result

                # 4. 提取数据逻辑 (React State + DOM 双保险)
                data = await page.evaluate('''() => {
                    const state = window.__INITIAL_STATE__;
                    const priceFromState = state?.product?.activeVariant?.price;
                    const priceFromDom = document.querySelector('.pdp-price__current, [data-testid="price"]')?.innerText;
                    return {
                        price: priceFromState || priceFromDom,
                        image: document.querySelector('meta[property="og:image"]')?.content
                    };
                }''')

                if data['price']:
                    # 清洗价格字符串
                    price_val = re.sub(r'[^0-9.]', '', str(data['price']))
                    result['price'] = float(price_val)
                    result['raw_image_url'] = data['image']
                
                await browser.close()
            except Exception as e:
                print(f"❌ 抓取异常: {e}")
                
        return result

    async def run_repair_flow(self):
        try:
            # 从 Supabase 获取需要修复的数据
            res = self.supabase.table("audit_products").select("*").execute()
            targets = [t for t in res.data if not t.get('price') or t.get('price') == 0]

            if not targets:
                print("✅ 暂无需要修复的价格数据。")
                return

            for item in targets:
                print(f"\n🛠️ 处理中: {item['slug']}")
                patch = await self.fetch_physical_only(item['official_link'])
                
                if patch['price'] > 0:
                    self.supabase.table("audit_products").update({
                        "price": patch['price'],
                        "original_image_url": patch['raw_image_url'],
                        "updated_at": datetime.now(UTC).isoformat()
                    }).eq("id", item['id']).execute()
                    print(f"✨ 成功同步: ${patch['price']}")
                else:
                    print("⚠️ 未能获取有效价格。")
                
                # 长休眠是应对高防站点的核心
                wait = random.uniform(40, 70)
                print(f"💤 冷却 {wait:.1f}s...")
                await asyncio.sleep(wait)

        except Exception as e:
            print(f"🚨 流程中断: {e}")

if __name__ == "__main__":
    repairman = ForensicRepairman()
    asyncio.run(repairman.run_repair_flow())