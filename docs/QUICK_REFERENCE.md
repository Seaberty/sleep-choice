# Sleep & Beyond 集成 - 快速参考

## 🚀 快速启动

### 1. 导入数据 (5分钟)

```
Supabase → SQL Editor → 粘贴 seed-sleep-and-beyond.sql → 运行
```

### 2. 验证集成

```javascript
// 在浏览器控制台测试推荐引擎
import { generatePersonalizedRecommendation } from "@/lib/quiz-matcher"

const userPref = {
    supportLevel: 8,
    coolingPriority: 9,
    naturalMaterialPreference: 10,
    budgetRange: [1500, 2500],
    firmnessPref: "medium",
    viewedProducts: ["sleep-beyond-pure-natural-latex"]
}

const recommendation = generatePersonalizedRecommendation(userPref)
console.log(recommendation)
// 预期: { recommendedModel: "Pure Natural Latex", matchScore: 92, ... }
```

---

## 📦 3 个 Sleep & Beyond 产品

| 产品                 | 价格  | 特色                    | 目标用户     |
| -------------------- | ----- | ----------------------- | ------------ |
| Pure Natural Latex   | ¥1899 | 100% 有机乳胶，±1.2°C   | 有机优先者   |
| Organic Cloud Hybrid | ¥2299 | 云感 + 口袋弹簧，±0.8°C | 舒适度追求者 |
| Eco Comfort Plus     | ¥1599 | 预算有机，90% 有机      | 预算考虑者   |

---

## 🔗 CJ Affiliate 链接

```
Pure Natural Latex
→ https://www.cjdropshipping.com/product/sleep-beyond-pure-natural-latex

Organic Cloud Hybrid
→ https://www.cjdropshipping.com/product/sleep-beyond-organic-cloud-hybrid

Eco Comfort Plus
→ https://www.cjdropshipping.com/product/sleep-beyond-eco-comfort-plus
```

---

## 🎯 用户流程

```
Saatva [pending] → 点击按钮 → /quiz → 选择偏好 → 推荐 Sleep & Beyond → CJ 链接
```

---

## 📁 核心文件

| 文件                                              | 用途               |
| ------------------------------------------------- | ------------------ |
| `src/lib/quiz-matcher.ts`                         | 推荐引擎           |
| `src/components/SleepAndBeyondRecommendation.tsx` | 推荐卡片 UI        |
| `scripts/seed-sleep-and-beyond.sql`               | 数据导入 SQL       |
| `src/app/registry/[slug]/page.tsx`                | 产品页面（已集成） |

---

## ⚙️ 关键函数

### 生成推荐

```typescript
import { generatePersonalizedRecommendation } from "@/lib/quiz-matcher"

const recommendation = generatePersonalizedRecommendation(userPreferences)
// → { recommendedModel, matchScore, reasoningSummary, affiliateLink }
```

### 计算匹配分数

```typescript
import { calculateMatchScore } from "@/lib/quiz-matcher"

const score = calculateMatchScore(userPref, productCharacteristics)
// → 0-100 的匹配分数
```

### 分析用户行为

```typescript
import { analyzeUserBehavior } from "@/lib/quiz-matcher"

const prefs = analyzeUserBehavior()
// → 从 URL/localStorage 推断用户偏好
```

---

## 🔍 状态标记

### Saatva（非批准）

```
[pending] - 灰色背景
按钮: EXECUTE_INTELLIGENCE_ROUTING → /quiz
```

### Sleep & Beyond（批准）

```
[VERIFIED_GATEWAY] - 蓝色背景
按钮: 直接指向 CJ affiliate 链接 → 新标签页
```

---

## 📊 监控查询

### 检查产品数据

```sql
SELECT brand, model, slug, audit_scores
FROM audit_products
WHERE brand = 'Sleep & Beyond'
```

### 检查 affiliate 链接

```sql
SELECT slug, offer_url, status
FROM product_offers
WHERE site_name = 'Sleep & Beyond Official'
```

### 检查推荐记录（如果有日志）

```sql
SELECT user_id, recommended_product, match_score, timestamp
FROM recommendation_logs
WHERE brand = 'Sleep & Beyond'
ORDER BY timestamp DESC LIMIT 20
```

---

## 🐛 常见问题

**Q: 推荐不显示?**

- 检查 `generatePersonalizedRecommendation()` 是否在 Quiz 完成后调用
- 验证 SLEEP_AND_BEYOND_CATALOG 数据是否填充

**Q: CJ 链接不工作?**

- 验证 `product_offers` 表中的 `offer_url`
- 检查 `is_primary = true` 且 `status = 'active'`

**Q: 用户偏好推理失败?**

- 确保 localStorage 中有 `userInteractionHistory`
- 检查 URL params 中的查询字符串

---

## 💡 优化建议

1. **权重调整** - 修改 `calculateMatchScore()` 中的权重
2. **动态内容** - 从 API 获取推荐文案而非硬编码
3. **A/B 测试** - 测试不同的推荐文案和顺序
4. **用户反馈** - 添加"有用吗?"反馈机制

---

**最后更新**: 2026-04-06  
**状态**: ✅ 已完成并构建验证
