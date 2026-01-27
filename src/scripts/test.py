import time
from audit_generator import AuditLogGenerator

# 1. 初始化
API_KEY = "AIzaSyDU314nCxll7750GoUdiHuww-NGt5fIcB4"
generator = AuditLogGenerator(api_key=API_KEY)

# 2. 模拟从数据库获取的数据列表 (你可以换成 Supabase 的 fetch 结果)
items_to_process = [
    {
        "brand": "Saatva",
        "model": "Classic",
        "slug": "saatva-classic",
        "technical_specs": {"material": "Dual-coil", "height": "11.5 inch"},
        "audit_scores": {"overall": 9.4, "support": 9.8}
    },
    # ... 更多数据
]

# 3. 执行并保存到文件
output_file = "audit_logs_result.txt"

print(f"🚀 开始处理，目标文件: {output_file}")

with open(output_file, "a", encoding="utf-8") as f:
    for i, item in enumerate(items_to_process):
        brand_model = f"{item.get('brand')} {item.get('model')}"
        
        print(f"[{i+1}/{len(items_to_process)}] 正在审计: {brand_model}...")
        
        # 调用我们之前修复过的 generate 方法
        log = generator.generate(item)
        
        if "FAILED" not in log:
            # 写入格式：品牌型号 | 审计日志
            entry = f"{brand_model} | {log}\n"
            f.write(entry)
            f.flush()  # 强制刷新缓冲区，确保实时写入硬盘
            print(f"✅ 已保存: {log}")
        else:
            print(f"❌ 失败跳过: {brand_model}")
            
        # 强制间隔，给 API 喘息时间，防止 429
        time.sleep(5) 

print("\n✨ 任务完成！请查看 audit_logs_result.txt")