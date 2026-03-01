# -*- coding: utf-8 -*-
import os
import asyncio
import httpx
import mimetypes
import re
import random
import sys
from urllib.parse import urlparse, urlunparse
from datetime import datetime, UTC
from dotenv import load_dotenv
from supabase import create_client, Client
from playwright.async_api import async_playwright

# 1. 尝试导入 stealth，如果环境不行则手动注入
try:
    from playwright_stealth import stealth_async as apply_stealth
except ImportError:
    apply_stealth = None

load_dotenv(dotenv_path=".env.local")

class ForensicRepairman:
    def __init__(self):
        self.supabase: Client = create_client(
            os.getenv("SUPABASE_URL"), 
            os.getenv("SUPABASE_KEY")
        )
        self.session_file = "saatva_auth.json"
        self.user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

    async def auth_manually(self):
        """手动获取 Session (GUI 模式)"""
        print("\n🔑 [手动验证] 正在启动浏览器，请在官网上完成人机验证...")
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context(user_agent=self.user_agent)
            page = await context.new_page()
            
            await page.goto("https://www.saatva.com/", wait_until="domcontentloaded")
            print("💡 请处理好弹窗，确认看到首页后，在此按 [回车]...")
            await asyncio.to_thread(input)
            
            await context.storage_state(path=self.session_file)
            print(f"✨ 通行证已更新: {self.session_file}")
            await browser.close()

    async def fetch_physical_only(self, url):
        """骨灰级伪装抓取：突破 'Caught us napping' 封锁"""
        result = {"price": 0.0, "raw_image_url": None, "auth_failed": False}
        
        async with async_playwright() as p:
            # 💡 必须：使用带头模式，并且指定慢速模式 (slow_mo)
            browser = await p.chromium.launch(
                headless=False, 
                slow_mo=random.randint(50, 150) # 每次操作延迟，极具欺骗性
            )
            
            storage_state = self.session_file if os.path.exists(self.session_file) else None
            context = await browser.new_context(
                storage_state=storage_state,
                user_agent=self.user_agent,
                viewport={'width': 1366, 'height': 768},
                # 模拟真实地理位置和语言
                locale="en-US",
                timezone_id="America/New_York"
            )
            
            # 🛡️ 深度抹除自动化特征
            await context.add_init_script("""
                delete navigator.__proto__.webdriver;
                window.chrome = { runtime: {} };
                Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
                Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
            """)
            
            page = await context.new_page()
            
            try:
                # 💡 技巧：先去搜索或首页“垫一下”，不要直奔产品页
                print(f"🕵️ 正在伪装访问路径...")
                await page.goto("https://www.saatva.com/", wait_until="domcontentloaded")
                await asyncio.sleep(random.uniform(2, 4))
                
                # 模拟鼠标在首页乱晃
                await page.mouse.move(random.randint(100, 500), random.randint(100, 500))
                
                print(f"🌐 转向目标产品: {url}")
                await page.goto(url, wait_until="domcontentloaded")
                
                # 检查是否依然被拦
                content = await page.content()
                if "caught us napping" in content.lower():
                    print("🚫 依然被拦截。建议：更换网络 IP (如手机热点) 或等待 1 小时。")
                    result["auth_failed"] = True
                    return result

                # --- 模拟真人阅读行为 ---
                await page.mouse.wheel(0, random.randint(300, 700))
                await asyncio.sleep(random.uniform(1, 3))

                # 点击 Queen 尺寸
                try:
                    # 使用坐标点击或更加模糊的匹配，避开死板的 Selector
                    queen_area = page.get_by_text("Queen", exact=True).first
                    await queen_area.click(delay=random.randint(100, 300))
                    await asyncio.sleep(2)
                except: pass

                # --- 提取数据 ---
                data = await page.evaluate('''() => {
                    const getPrice = () => {
                        // 优先从 React State 抠图，这是最稳的
                        const state = window.__INITIAL_STATE__;
                        if (state?.product?.activeVariant?.price) return state.product.activeVariant.price;
                        // 兜底 DOM
                        const el = document.querySelector('.pdp-price__current, [data-testid="price"]');
                        return el ? el.innerText : null;
                    };
                    return {
                        price: getPrice(),
                        image: document.querySelector('meta[property="og:image"]')?.content
                    };
                }''')

                if data['price']:
                    price_val = re.sub(r'[^0-9.]', '', str(data['price']))
                    result['price'] = float(price_val)
                result['raw_image_url'] = data['image']
                
            except Exception as e:
                print(f"❌ 运行中断: {e}")
            finally:
                await browser.close()
        return result

    async def run_repair_flow(self):
        print("📊 开始物理修复流程...")
        res = self.supabase.table("audit_products").select("*").execute()
        targets = [t for t in res.data if not t.get('price') or t.get('price') == 0]

        if not targets:
            print("✨ 数据已全部校准。")
            return

        for item in targets:
            print(f"\n🛠️ 正在修复: {item['slug']}")
            patch = await self.fetch_physical_only(item['official_link'])
            
            if patch["auth_failed"]:
                print("🚨 检测到强力拦截，需要重新验证...")
                await self.auth_manually()
                patch = await self.fetch_physical_only(item['official_link'])

            if patch['price'] > 0:
                self.supabase.table("audit_products").update({
                    "price": patch['price'],
                    "original_image_url": patch['raw_image_url'],
                    "updated_at": datetime.now(UTC).isoformat()
                }).eq("id", item['id']).execute()
                print(f"✅ 成功修复! 价格: ${patch['price']}")
            else:
                print(f"⚠️ 无法获取价格，请手动检查: {item['official_link']}")
            
            # 加长休眠，模拟真实阅读行为
            wait = random.uniform(20, 45)
            print(f"💤 深度休眠 {wait:.1f}s...")
            await asyncio.sleep(wait)

if __name__ == "__main__":
    repairman = ForensicRepairman()
    asyncio.run(repairman.run_repair_flow())