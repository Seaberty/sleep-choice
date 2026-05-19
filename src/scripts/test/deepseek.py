# -*- coding: utf-8 -*-
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

# 1. 动态定位项目根目录下的 .env.local
# __file__: src/scripts/test/deepseek.py → 向上四级到仓库根目录
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
env_path = BASE_DIR / ".env.local"

if env_path.exists():
    load_dotenv(dotenv_path=env_path)
    print(f"✅ 已成功加载配置文件: {env_path}")
else:
    print(f"❌ 找不到配置文件: {env_path}")


# 2. 可选代理（直连 api.deepseek.com 通常不需要；若环境限制再取消注释）
# os.environ["HTTP_PROXY"] = "http://127.0.0.1:10801"
# os.environ["HTTPS_PROXY"] = "http://127.0.0.1:10801"

DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions"


def test_deepseek_chat():
    api_key = os.getenv("DEEPSEEK_API_KEY")

    if not api_key:
        print("❌ 错误: 环境变量中没有 DEEPSEEK_API_KEY，请在 .env.local 中配置")
        return

    prompt = (
        "请简要回答：如果你收到了这条消息，说明连接成功。请确认你当前的模型名称。"
    )

    print("🚀 正在请求 DeepSeek Chat（deepseek-chat）...", flush=True)
    # connect：尽快失败，避免「卡住像死机」；read：给足生成长度
    timeout = httpx.Timeout(connect=15.0, read=90.0, write=20.0, pool=15.0)
    try:
        # trust_env=False：不自动吃系统/终端里的 HTTP(S)_PROXY，减少误走代理导致连不上
        with httpx.Client(timeout=timeout, trust_env=False) as client:
            response = client.post(
                DEEPSEEK_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 100,
                    "temperature": 0.1,
                },
            )
            response.raise_for_status()
            data = response.json()

        text = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )

        print("\n--- 收到回复 ---")
        print(text or data)
        print("----------------\n")
        print("🎉 测试通过！DEEPSEEK_API_KEY 与网络链路可用。")

    except httpx.HTTPStatusError as e:
        print(f"\n❌ HTTP 错误: {e.response.status_code} — {e.response.text[:500]}")
        if e.response.status_code == 401:
            print("💡 提示: Key 无效或未授权，请检查 DEEPSEEK_API_KEY。")
        if e.response.status_code == 503:
            print("💡 提示: 服务繁忙（503），请稍后重试。")
    except httpx.ConnectTimeout as e:
        print(f"\n❌ 连接超时: {e}")
        print("💡 本机到 api.deepseek.com 的 TCP/HTTPS 握手在限制时间内未完成。")
        print("   检查：网络、公司防火墙/杀软、是否需走代理（可设环境变量 HTTP_PROXY 后把 trust_env 改为 True）。")
    except httpx.ReadTimeout as e:
        print(f"\n❌ 读响应超时: {e}")
        print("💡 服务器已连上但长时间未返回，可稍后再试。")
    except httpx.RequestError as e:
        print(f"\n❌ 网络层错误: {e}")
        print("💡 常见原因: DNS 失败、防火墙拦截、代理端口未开却配置了全局代理。")
    except Exception as e:
        print(f"\n❌ 其他错误: {e}")


if __name__ == "__main__":
    test_deepseek_chat()
