import json
from google import genai
from google.genai import types

class AuditLogGenerator:
    def __init__(self, api_key: str):
        # 初始化最新 Client，强制使用 v1 接口
        self.client = genai.Client(
            api_key=api_key, 
            http_options={'api_version': 'v1'}
        )
        # 指定最新模型 ID，例如 gemini-2.0-flash-exp
        self.model_id = "gemini-2.5-flash" 

    def generate_audit_report(self, raw_data: dict):
        """
        利用 2.0/2.5 的强推理能力，将原始爬虫数据转化为审计级 JSON
        """
        
        # 1. 核心系统指令：确立“法医审计员”的人设
        sys_instr = (
            "You are a Senior Forensic Sleep Research Engineer. "
            "Your task is to analyze mattress data and generate cold, analytical reports. "
            "Forbidden words: best, great, affordable, amazing. "
            "Required terminology: Structural integrity, thermal regulation, biometric support."
        )

        # 2. 构造用户提示词
        user_prompt = f"Perform a structural audit on the following dataset: {json.dumps(raw_data)}"

        # 3. 配置生成参数
        # 注意：使用 response_mime_type="application/json" 确保输出纯净
        config = types.GenerateContentConfig(
            system_instruction=sys_instr,
            temperature=0.1,  # 极低温度确保严谨性
            response_mime_type="application/json",
            # 如果需要更严格的格式，可以在此处定义 response_schema
        )

        try:
            # 调用最新 SDK 的模型生成接口
            response = self.client.models.generate_content(
                model=self.model_id,
                contents=user_prompt,
                config=config
            )

            # 解析返回的 JSON 数据
            audit_json = json.loads(response.text)

            # 4. 执行业务逻辑补全 (如套利价格计算)
            msrp = float(raw_data.get('msrp', 2095))
            price = float(raw_data.get('price', 1995))
            
            audit_json.update({
                "msrp": msrp,
                "price": price,
                "arbitrage_delta": round(((msrp - price) / msrp) * 100, 1) if msrp > 0 else 0
            })

            return audit_json

        except Exception as e:
            print(f"CRITICAL_ERROR: Audit generation failed -> {e}")
            return None

# --- 执行示例 ---
if __name__ == "__main__":
    API_KEY = "AIzaSyDU314nCxll7750GoUdiHuww-NGt5fIcB4"
    generator = AuditLogGenerator(API_KEY)

    # 模拟爬取的原始 Saatva 数据
    raw_input = {
        "brand": "Saatva",
        "model": "Classic",
        "price": 1995,
        "msrp": 2095,
        "technical_specs": {"material": "Dual-coil", "height": "11.5 inch"}
    }

    result = generator.generate_audit_report(raw_input)
    if result:
        print(json.dumps(result, indent=2, ensure_ascii=False))