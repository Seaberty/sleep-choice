/**
 * 1. 商务端：更完善的 Offer 系统
 * 增加了 original_price 以支持在没有全局 MSRP 时计算差价
 */
export interface Offer {
    site: string
    /** 货架主价：若库里有爬虫写入的叠加折扣比例则已折算，否则同 PDP 标价 */
    price: number
    original_price?: number // 对应数据中的 msrp 逻辑
    url: string
    oldPrice?: number
    promo?: string
    promo_text?: string
    /** 相对原价节省金额；仅当 oldPrice > price 时有值，否则为 null */
    savingsAmount?: number | null
    /** 相对原价折扣百分比（整数）；仅当 oldPrice > price 时有值，否则为 null */
    savingsPercent?: number | null
    /** 从 promo_text 正则提取的 4–10 位优惠码；未匹配则为 null */
    couponCode?: string | null
    /** 库存/供货状态（如 Supabase product_offers.availability） */
    availability?: string | null
    primary: boolean
    is_best_deal: boolean // 标记是否为审计推荐的最优买入点
}

/**
 * 2. 性能端：支持 2.0 动态维度
 * 对齐数据库 audit_scores (jsonb)
 */
export interface AuditScores {
    overall: number
    support: number
    cooling: number
    pressure: number
    durability: number // 显式包含 Gemini 生成的耐用性评分
    [key: string]: number
}

/**
 * 3. 审计核心：对齐数据库 audit_data (jsonb)
 * 专门存放 AI 生成的 specs_matrix 和 arbitrage_report
 */
export interface ForensicAuditData {
    msrp: number
    specs_matrix: {
        Support: string
        Chassis: string
        Thermal: string
        [key: string]: string
    }
    arbitrage_report: string
    /** 与 forensic_engine 写入的 audit_data.audit_hash 一致（8 位十六进制指纹） */
    audit_hash?: string
    /**
     * 定价锚定规格（与抓取到的 price / msrp 同源，如 Queen、Standard）。
     * 由抓取端 JSON-LD 伪算法写入；缺失表示旧数据或未锚定。
     */
    audit_variant?: string
}

export interface ProductMeta {
    title?: string
    description?: string
    keywords?: string
}

export interface ProductRegistry {
    last_updated: string
    products: Record<string, any> // 或者具体的索引签名
    version?: any
}

/**
 * 4. 产品实体：最终对齐数据库表结构
 */
export interface ProductData {
    id: string
    slug: string
    brand: string
    name?: string
    model: string // 保持与数据库一致，前端显示可映射为 name
    category: string

    // 价格与商务
    price: number
    currency: string
    metrics: {
        // 专门用于对比的核心数据
        [key: string]: number | string | undefined
        performance?: number
        durability?: number
        comfort?: number
    }
    offers: Offer[] // 存放数据库中的 offers 数组

    // 审计状态
    is_verified: boolean
    last_audited_at: string
    protocol_version: string // 例如 APP_PROTOCOL (v3.0-forensic)

    // 内容描述
    // --- 审计核心数据 ---
    audit_id: string
    audit_status: "verified" | "pending" | "rejected" | string
    audit_note: string // 核心专家总结
    summary_log: string // 套利分析总结
    gallery: string
    pros: string[]
    cons: string[]

    // 深度 JSON 数据
    audit_scores: AuditScores
    audit_data: ForensicAuditData // 这里的嵌套结构对应你生成的 JSON 内容
    /** 便于卡片等组件展示，通常来自 audit_data.audit_hash */
    audit_hash?: string

    // 原始数据参考 (保持追溯)
    technical_specs: Record<string, string>

    // 资产
    image_url: string

    rating: number
    tag?: string
    price_range: string
    isBestSeller?: boolean // 👈 添加这一行
    meta?: ProductMeta

    /** Serper 有机结果条数，供 JSON-LD aggregateRating.ratingCount */
    review_count?: number

    /**
     * Quiz 匹配标签（Supabase `quiz_tags` jsonb，如 ["side-sleeper","back-pain"]）。
     * 未配置时由 `inferProductTags` 启发式补齐。
     */
    quiz_tags?: string[]
}
