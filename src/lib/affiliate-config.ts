/**
 * 可赚佣金的合作品牌（CJ / Impact）。与 batch_scanner、forensic_engine 的 site_name 一致。
 */
export const APPROVED_AFFILIATE_BRANDS = new Set([
    "Saatva",
    "FluffCo",
    "Sleep & Beyond"
])

/** Reddit 回复模板默认指向的 registry slug（可被 registry.json / env 覆盖） */
export const REDDIT_AUDIT_SLUG_DEFAULTS: Record<string, string> = {
    sleep_beyond: "sleep-and-beyond-mymerino-comforter",
    fluffco: "fluffco-down-alternative-comforter",
    saatva: "saatva-classic"
}

export function isApprovedAffiliateBrand(brand: string | undefined | null): boolean {
    if (!brand?.trim()) return false
    return APPROVED_AFFILIATE_BRANDS.has(brand.trim())
}

/** CJ / Impact deep-link 前缀键：与 product_offers.site_name 或 audit_products.brand 对齐 */
export function affiliateNetworkKey(
    siteName: string | undefined | null,
    brand: string | undefined | null
): string {
    const site = siteName?.trim() ?? ""
    if (site && APPROVED_AFFILIATE_BRANDS.has(site)) return site
    const b = brand?.trim() ?? ""
    if (b && APPROVED_AFFILIATE_BRANDS.has(b)) return b
    return site || b
}
