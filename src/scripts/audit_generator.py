import json
import time
import re
from google import genai
from google.genai import types

class AuditLogGenerator:
    def __init__(self, api_key):
        # 强制使用 v1 路由以确保 system_instruction 的兼容性
        self.client = genai.Client(api_key=api_key, http_options={'api_version': 'v1'})
        # 使用你列表中存在的最新模型
        self.model_id = "gemini-2.5-flash" 
        self.last_request_time = 0

    def _throttle(self):
        """严格节流：Gemini 2.5 免费层非常严，建议每 20 秒处理一条数据"""
        elapsed = time.time() - self.last_request_time
        wait_threshold = 20.0 
        if elapsed < wait_threshold:
            time.sleep(wait_threshold - elapsed)
        self.last_request_time = time.time()

    def generate(self, product_row, retry_count=3):
        # 强化 Prompt，防止 2.5 系列产生幻觉或截断
        instruction = (
            "YOU ARE A CHIEF TECHNICAL AUDITOR. OUTPUT ONLY IN ALL CAPS. "
            "FORMAT: [KEY OBSERVATION] | [SPEC VERIFICATION]. // STATUS: [RESULT]\n"
            "STRICTLY NO PROSE, NO CONVERSATION, NO MARKDOWN.\n\n"
        )
        
        specs = product_row.get('technical_specs', {})
        scores = product_row.get('audit_scores', {})
        user_data = f"AUDIT DATA: {product_row.get('brand')} | {json.dumps(scores)} | {json.dumps(specs)}"
        
        full_prompt = instruction + user_data
        
        for attempt in range(retry_count):
            self._throttle()
            
            try:
                response = self.client.models.generate_content(
                    model=self.model_id,
                    config=types.GenerateContentConfig(
                        temperature=0.1,      # 极低温度确保不乱说话
                        max_output_tokens=100, # 稍微调大一点防止截断
                        # 核心修复：彻底关闭 2.5 可能极其敏感的过滤
                        safety_settings=[
                            types.SafetySetting(category=c, threshold="BLOCK_NONE") 
                            for c in [
                                "HARM_CATEGORY_HATE_SPEECH", 
                                "HARM_CATEGORY_HARASSMENT",
                                "HARM_CATEGORY_DANGEROUS_CONTENT",
                                "HARM_CATEGORY_SEXUALLY_EXPLICIT"
                            ]
                        ]
                    ),
                    contents=full_prompt
                )

                if response.text:
                    result = response.text.strip().upper().replace('*', '').replace('`', '')
                    # 如果生成的太短（比如只有两个字母），视为失败并重试
                    if len(result) < 5:
                        continue
                    return result
                
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg:
                    # 自动解析等待时间
                    wait_seconds = 45 
                    match = re.search(r"retry in (\d+)", error_msg)
                    if match:
                        wait_seconds = int(match.group(1)) + 5
                    print(f"⚠️ 限流中，等待 {wait_seconds}s 后重试...")
                    time.sleep(wait_seconds)
                    continue 
                else:
                    print(f"❌ 关键异常: {error_msg}")
                    break
                    
        return "AUDIT_DATA_SYNC_ERROR. // STATUS: FAILED"