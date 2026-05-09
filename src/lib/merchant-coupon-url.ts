/**
 * 按品牌将优惠码写入落地 URL 的查询参数（商户前台若支持，打开即带码）。
 * 未配置的品牌保持原链，由页面展示「复制码」作为兜底（见 deals-vault）。
 */
const BRAND_COUPON_QUERY: Record<string, string> = {
    FluffCo: "discount",
    "Sleep & Beyond": "coupon"
}

/**
 * 若 `siteName` 在允许列表中且 URL 可解析，则设置/覆盖对应 query，否则返回原 url。
 */
export function appendCouponToMerchantUrl(
    url: string,
    siteName: string,
    couponCode: string | null | undefined
): string {
    const code = couponCode?.trim()
    if (!code || !url?.trim()) return url

    const param = BRAND_COUPON_QUERY[siteName.trim()]
    if (!param) return url

    try {
        const u = new URL(url.trim())
        u.searchParams.set(param, code)
        return u.toString()
    } catch {
        return url
    }
}
