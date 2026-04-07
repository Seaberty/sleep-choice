# Sleep & Beyond 产品数据导入指南

## 概述

本指南说明如何将 Sleep & Beyond 品牌的产品数据集成到 SleepChoice 审计系统中。

## 架构设计

### 1. 产品数据特征

Sleep & Beyond 产品线基于以下特征设计：

#### Pure Natural Latex (¥1899)

- **状态**: VERIFIED_GATEWAY
- **核心特性**:
    - 100% GOLS认证有机天然乳胶
    - 9区域支撑系统
    - ±1.2°C 热调节精度
- **目标用户**: 优先考虑有机材料的消费者

#### Organic Cloud Hybrid (¥2299)

- **状态**: VERIFIED_GATEWAY
- **核心特性**:
    - 95% 有机材料组合
    - 云感舒适层 + 口袋弹簧
    - ±0.8°C 高级热管理
- **目标用户**: 寻求舒适度和支撑平衡的消费者

#### Eco Comfort Plus (¥1599)

- **状态**: VERIFIED_GATEWAY
- **核心特性**:
    - 90% 有机材料（经济型选择）
    - 6区域支撑
    - ±1.5°C 热调节
- **目标用户**: 预算有限但优先考虑有机的消费者

### 2. 数据导入流程

#### 步骤 1: 运行 SQL 迁移

在 Supabase 数据库中执行 `seed-sleep-and-beyond.sql`:

```bash
# 方法 A: 通过 Supabase 仪表板
1. 打开 Supabase 项目
2. 进入 SQL 编辑器
3. 复制 seed-sleep-and-beyond.sql 的内容
4. 执行查询

# 方法 B: 通过 psql CLI (如果已安装)
psql "postgresql://[USER]:[PASSWORD]@[HOST]/[DATABASE]" < scripts/seed-sleep-and-beyond.sql
```

#### 步骤 2: 验证数据导入

```bash
# 检查产品是否正确插入
SELECT brand, model, slug, is_verified FROM audit_products
WHERE brand = 'Sleep & Beyond'
ORDER BY price;
```

预期结果应为 3 行，每行显示一个 Sleep & Beyond 产品。

### 3. 推荐引擎集成

#### Quiz 到 Sleep & Beyond 的闭环流程

```
用户访问 Saatva 页面
    ↓
记录交互偏好 (support/cooling/organic preference)
    ↓
用户进入 Quiz → 选择偏好
    ↓
Quiz 完成 → 调用 generatePersonalizedRecommendation()
    ↓
基于用户偏好匹配 Sleep & Beyond 产品
    ↓
展示 SleepAndBeyondRecommendation 组件
    ↓
用户点击 → 跳转到 CJ Affiliate 链接
```

#### 文件参考

- **推荐引擎**: `src/lib/quiz-matcher.ts`
    - `generatePersonalizedRecommendation()` - 生成个性化推荐
    - `calculateMatchScore()` - 计算匹配度
    - `analyzeUserBehavior()` - 分析用户行为

- **推荐卡片组件**: `src/components/SleepAndBeyondRecommendation.tsx`
    - 显示推荐产品及理由
    - CJ Affiliate 链接集成

### 4. 内容对标参考

#### Saatva 审计框架（参考）

```
- Biomechanical Assessment: 支撑结构验证
- Thermal Performance: 热管理测试
- Durability Testing: 耐久性评估
- Consumer Feedback: 消费者反馈分析
```

#### Sleep & Beyond 对标内容

```
- Organic Integrity: 有机材料验证
- Natural Thermoregulation: 天然热调节
- Sustainability Metrics: 环保指标
- Eco-Certification: 生态认证
```

### 5. CJ Affiliate 配置

#### Affiliate Links

- Pure Natural Latex: `https://www.cjdropshipping.com/product/sleep-beyond-pure-natural-latex`
- Organic Cloud Hybrid: `https://www.cjdropshipping.com/product/sleep-beyond-organic-cloud-hybrid`
- Eco Comfort Plus: `https://www.cjdropshipping.com/product/sleep-beyond-eco-comfort-plus`

#### Tracking 设置

所有链接应通过 product_offers 表管理，确保：

- `is_primary = true` (首选推荐)
- `status = 'active'` (激活状态)
- `site_name = 'Sleep & Beyond Official'` (品牌来源)

### 6. 用户交互流程

#### 非批准品牌处理（如 Saatva）

```
用户在 Saatva 页面
    ↓
显示 [pending] 标记
    ↓
点击按钮 → 跳转到 /quiz?brand=Saatva&slug=...
    ↓
Quiz 记录用户偏好
    ↓
推荐 Sleep & Beyond 对标产品
```

#### 批准品牌处理（Sleep & Beyond）

```
用户在 Sleep & Beyond 页面
    ↓
显示 [VERIFIED_GATEWAY] 标记
    ↓
直接显示 CJ Affiliate 链接
    ↓
点击 → 跳转到 CJ 商店页面（新标签页）
```

### 7. 监控与维护

#### 关键指标

- **转化率**: Quiz 完成后 → Sleep & Beyond 点击率
- **Affiliate 表现**: CJ 链接转换率
- **用户满意度**: Sleep & Beyond 产品评分

#### 定期检查

```bash
# 检查 affiliate links 状态
SELECT slug, site_name, status FROM product_offers
WHERE brand_slug LIKE 'sleep-beyond%';

# 检查审计数据完整性
SELECT slug, is_verified, audit_scores FROM audit_products
WHERE brand = 'Sleep & Beyond';
```

## 故障排除

### 问题 1: 产品数据未插入

**解决**: 确保 SUPABASE_SERVICE_ROLE_KEY 有写权限

### 问题 2: Affiliate 链接 404

**解决**: 验证 CJ 链接是否有效，更新 product_offers 表

### 问题 3: 推荐不准确

**解决**: 检查 quiz-matcher.ts 中的特征匹配权重

## 后续优化

1. **A/B 测试**: 比较不同的推荐展示方式
2. **动态定价**: 根据季节调整 Sleep & Beyond 价格
3. **内容扩展**: 添加更多 Sleep & Beyond 产品线
4. **用户反馈**: 收集用户对推荐的满意度评分
