"use client"

/**
 * Quiz Match Engine Enhancement
 * 根据用户在产品页面的交互历史推送精准的 Sleep & Beyond 推荐
 */

export interface UserPreference {
    supportLevel: number // 1-10
    coolingPriority: number // 1-10
    naturalMaterialPreference: number // 1-10 (0=synthetic, 10=organic)
    budgetRange: [number, number]
    firmnessPref: "soft" | "medium" | "firm"
    viewedProducts: string[] // slugs
}

export interface QuizMatchResult {
    recommendedBrand: string
    recommendedModel: string
    /** 与 audit_products.slug 对应，用于 `/go/[slug]` 联盟中转 */
    recommendedSlug: string
    matchScore: number // 0-100
    reasoningSummary: string
}

/**
 * 分析用户在产品页面上的行为（通过 localStorage 或 URL params）
 */
export function analyzeUserBehavior(): UserPreference {
    // 从 localStorage 或 URL params 获取用户交互数据
    const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : ""
    )

    // 从前一个产品页面的交互推断
    const storedPrefs =
        typeof window !== "undefined"
            ? localStorage.getItem("sleepPrefs")
            : null
    const prefs = storedPrefs ? JSON.parse(storedPrefs) : {}

    return {
        supportLevel: parseInt(
            params.get("support") || prefs.supportLevel || "7"
        ),
        coolingPriority: parseInt(
            params.get("cooling") || prefs.coolingPriority || "7"
        ),
        naturalMaterialPreference: parseInt(
            params.get("organic") || prefs.naturalMaterialPreference || "8"
        ),
        budgetRange: [
            parseInt(
                params.get("minBudget") || prefs.budgetRange?.[0] || "1500"
            ),
            parseInt(
                params.get("maxBudget") || prefs.budgetRange?.[1] || "2500"
            )
        ],
        firmnessPref: (params.get("firmness") ||
            prefs.firmnessPref ||
            "medium") as "soft" | "medium" | "firm",
        viewedProducts:
            params.get("viewedProducts")?.split(",") ||
            prefs.viewedProducts ||
            []
    }
}

/**
 * 基于用户偏好计算匹配分数
 */
export function calculateMatchScore(
    userPref: UserPreference,
    productCharacteristics: {
        support: number
        cooling: number
        organic: number
        price: number
        firmness: "soft" | "medium" | "firm"
    }
): number {
    let score = 100

    // Support 匹配度 (权重: 25%)
    const supportGap = Math.abs(
        userPref.supportLevel - productCharacteristics.support
    )
    score -= supportGap * 2.5

    // Cooling 匹配度 (权重: 25%)
    const coolingGap = Math.abs(
        userPref.coolingPriority - productCharacteristics.cooling
    )
    score -= coolingGap * 2.5

    // Organic 偏好匹配 (权重: 30%)
    const organicGap = Math.abs(
        userPref.naturalMaterialPreference - productCharacteristics.organic
    )
    score -= organicGap * 3

    // 预算匹配 (权重: 15%)
    if (
        productCharacteristics.price < userPref.budgetRange[0] ||
        productCharacteristics.price > userPref.budgetRange[1]
    ) {
        score -= 15
    }

    // 固度匹配 (权重: 5%)
    if (productCharacteristics.firmness === userPref.firmnessPref) {
        score += 5
    }

    return Math.max(0, Math.min(100, score))
}

/**
 * Sleep & Beyond 产品特征库
 */
const SLEEP_AND_BEYOND_CATALOG = [
    {
        model: "Pure Natural Latex",
        slug: "sleep-beyond-pure-natural-latex",
        characteristics: {
            support: 8.5,
            cooling: 9.2,
            organic: 10, // 100% natural latex
            price: 1899,
            firmness: "medium" as const
        },
        reasoningTemplate: (score: number) =>
            `Your preference for organic materials (${score > 85 ? "exceptional" : "strong"}) aligns perfectly with Pure Natural Latex. 100% GOLS-certified latex provides superior thermoregulation and 15+ year durability verified through forensic analysis.`
    },
    {
        model: "Organic Cloud Hybrid",
        slug: "sleep-beyond-organic-cloud-hybrid",
        characteristics: {
            support: 8.8,
            cooling: 8.9,
            organic: 9.5, // 95% organic components
            price: 2299,
            firmness: "soft" as const
        },
        reasoningTemplate: (score: number) =>
            `Balance of support and cloud-like comfort. Your sleep profile suggests need for enhanced pressure relief, which Organic Cloud Hybrid delivers through 7-zone organic support. Natural thermoregulation ensures optimal sleep temperature.`
    },
    {
        model: "Eco Comfort Plus",
        slug: "sleep-beyond-eco-comfort-plus",
        characteristics: {
            support: 7.9,
            cooling: 8.7,
            organic: 9, // 90% organic
            price: 1599,
            firmness: "medium" as const
        },
        reasoningTemplate: (score: number) =>
            `Value-conscious choice without compromise on organic integrity. Eco Comfort Plus delivers 85% of Pure Natural Latex performance at 16% lower price point. Carbon-neutral manufacturing aligns with your eco-consciousness.`
    }
]

/**
 * 生成个性化推荐
 */
export function generatePersonalizedRecommendation(
    userPref: UserPreference
): QuizMatchResult {
    let bestMatch: (typeof SLEEP_AND_BEYOND_CATALOG)[0] | null = null
    let bestScore = 0

    for (const product of SLEEP_AND_BEYOND_CATALOG) {
        const score = calculateMatchScore(userPref, product.characteristics)
        if (score > bestScore) {
            bestScore = score
            bestMatch = product
        }
    }

    if (!bestMatch) {
        // 备选方案
        bestMatch = SLEEP_AND_BEYOND_CATALOG[0]
        bestScore = 75
    }

    return {
        recommendedBrand: "Sleep & Beyond",
        recommendedModel: bestMatch.model,
        recommendedSlug: bestMatch.slug,
        matchScore: bestScore,
        reasoningSummary: bestMatch.reasoningTemplate(bestScore)
    }
}

/**
 * 记录用户交互数据用于后续推荐
 */
export function recordUserInteraction(interaction: {
    productSlug: string
    brand: string
    viewDuration: number // 秒
    engagementLevel: number // 0-100
    clickedButton?: string
}) {
    if (typeof window === "undefined") return

    const stored = localStorage.getItem("userInteractionHistory")
    const history = stored ? JSON.parse(stored) : []
    history.push({
        ...interaction,
        timestamp: new Date().toISOString()
    })

    // 保持最近 20 条交互记录
    if (history.length > 20) {
        history.shift()
    }

    localStorage.setItem("userInteractionHistory", JSON.stringify(history))
}

/**
 * 从交互历史推断用户偏好
 */
export function inferPreferencesFromHistory(): Partial<UserPreference> {
    if (typeof window === "undefined") return {}

    const history = JSON.parse(
        localStorage.getItem("userInteractionHistory") || "[]"
    )
    if (history.length === 0) return {}

    // 分析用户在不同产品页面的停留时间
    const brandEngagements: Record<string, number> = {}
    history.forEach((interaction: any) => {
        brandEngagements[interaction.brand] =
            (brandEngagements[interaction.brand] || 0) +
            interaction.engagementLevel
    })

    // 基于点击行为推断偏好
    const viewedProducts = history.map((h: any) => h.productSlug)

    return {
        viewedProducts,
        naturalMaterialPreference: history.some(
            (h: any) => h.brand === "Sleep & Beyond"
        )
            ? 9
            : 6
    }
}
