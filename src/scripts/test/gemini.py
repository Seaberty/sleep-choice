# -*- coding: utf-8 -*-
import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

# 1. 动态定位根目录下的 .env.local
# __file__ 是当前脚本路径：src/scripts/test/test_gemini.py
# .parent.parent.parent.parent 向上跳转四级到达项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
env_path = BASE_DIR / ".env.local"

if env_path.exists():
    load_dotenv(dotenv_path=env_path)
    print(f"✅ 已成功加载配置文件: {env_path}")
else:
    print(f"❌ 找不到配置文件: {env_path}")

# 2. 注入 v2rayU 代理端口 (Gemini API 必需)
# v2rayU 默认 HTTP 端口通常为 1087
os.environ["HTTP_PROXY"] = "http://127.0.0.1:10801"
os.environ["HTTPS_PROXY"] = "http://127.0.0.1:10801"

def test_gemini_2_5():
    api_key = os.getenv("GEMINI_API_KEY")
    
    if not api_key:
        print("❌ 错误: 环境变量中没有 GEMINI_API_KEY，请检查 .env.local 内容")
        return

    # 初始化客户端
    client = genai.Client(api_key=api_key)

    print("🚀 正在请求 Gemini 2.5 Flash...")
    try:
        # 进行一次简单的内容生成测试
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=["请简要回答：如果你收到了这条消息，说明连接成功。请确认你的模型版本。"],
            config=types.GenerateContentConfig(
                max_output_tokens=100,
                temperature=0.1
            )
        )
        
        print("\n--- 收到回复 ---")
        print(response.text)
        print("----------------\n")
        print("🎉 测试通过！你的网络链路、代理和 API Key 均已就绪。")

    except Exception as e:
        print(f"\n❌ 连接失败: {e}")
        if "503" in str(e):
            print("💡 提示: 模型当前负载过高（503），请稍后再试或检查代理节点。")

if __name__ == "__main__":
    test_gemini_2_5()