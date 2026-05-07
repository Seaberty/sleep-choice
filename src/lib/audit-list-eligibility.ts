/**
 * 对外展示的审计产品列表（归档、首页卡片、Deals、Compare 等）统一规则：
 * 需同时具备非占位主图与有效标价。
 */
export function isListableAuditProduct(input: {
    image_url?: string | null
    price?: number | string | null
}): boolean {
    const img = input.image_url && String(input.image_url).trim()
    if (!img || img === "/placeholder-product.png") return false
    const priceNum = Number(input.price)
    if (!Number.isFinite(priceNum) || priceNum <= 0) return false
    return true
}
