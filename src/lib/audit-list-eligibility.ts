import { isApprovedAffiliateBrand } from "@/lib/affiliate-config"

/**
 * 对外展示的审计产品列表（归档、首页卡片、Deals、Compare、sitemap 等）统一规则：
 * 有效标价 +（非占位主图 或 已完成 forensic 总分）。
 * 避免「有完整审计文案但缺图」的 SKU 从 registry / SEO 中消失。
 */
export function isListableAuditProduct(input: {
    image_url?: string | null
    price?: number | string | null
    audit_scores?: { overall?: number | string | null } | null
}): boolean {
    const priceNum = Number(input.price)
    if (!Number.isFinite(priceNum) || priceNum <= 0) return false

    const img = input.image_url && String(input.image_url).trim()
    const hasRealImage = Boolean(img && img !== "/placeholder-product.png")

    const overall = Number(input.audit_scores?.overall)
    const hasForensicScore =
        Number.isFinite(overall) && overall > 0

    return hasRealImage || hasForensicScore
}

export function isCommissionableAuditProduct(input: {
    brand?: string | null
}): boolean {
    return isApprovedAffiliateBrand(input.brand)
}
