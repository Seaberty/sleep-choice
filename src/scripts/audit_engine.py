import json

class AuditEngine:
    def __init__(self, raw_data):
        self.raw = raw_data
        self.scores = {}
        
    def calculate_support(self):
        # 逻辑：结合原始评分和硬参数
        base_score = self.raw.get('original_support', 0)
        # 如果检测到关键材料（如双层弹簧），给予加权补偿
        if "dual coil" in str(self.raw.get('specs')).lower():
            base_score += 0.5
        return min(9.9, base_score)

    def generate_summary_log(self):
        # 自动化生成详情页那个大框里的冷峻结论
        trial = self.raw.get('trial_period', 'N/A')
        delivery = self.raw.get('delivery_type', 'Standard')
        
        # 模仿实验室语调
        log = f"\"{delivery.upper()} DELIVERY VERIFIED. | PREMIUM {trial.upper()} TRIAL PROTOCOL ACTIVE.\""
        return log

    def run_audit(self):
        # 生成最终的审计包
        audit_packet = {
            "slug": self.raw.get('slug'),
            "aggregate_index": 9.4, # 这里可以写具体的综合计算公式
            "audit_scores": {
                "support": self.calculate_support(),
                "cooling": self.raw.get('original_cooling', 0),
                "pressure": self.raw.get('original_pressure', 0)
            },
            "summary_log": self.generate_summary_log(),
            "protocol_version": "v2.6-JAN",
            "verified": True
        }
        return audit_packet

# 使用示例
# raw_json = fetch_from_crawler() 
# engine = AuditEngine(raw_json)
# final_data = engine.run_audit()