/**
 * 出站中转：`/go/[slug]` 或由 NEXT_PUBLIC_GO_REDIRECT_ORIGIN 指向的子域。
 * 部署示例：NEXT_PUBLIC_GO_REDIRECT_ORIGIN=https://go.sleepchoiceguide.com
 * → 最终链接 https://go.sleepchoiceguide.com/go/{slug}
 */

/**
 * 商品卡等「直链商户 URL」场景：命中品牌则改走 `/go/[slug]`，由 route 按 DB `site_name` 套 CJ。
 * 审计详情页侧栏已统一经 `getAffiliateLink` → `/go/[slug]`。
 */
export const APPROVED_AFFILIATE_BRANDS = new Set([
    "Saatva",
    "FluffCo",
    "Sleep & Beyond"
])

export function productGoLink(slug: string): string {
    const origin = process.env.NEXT_PUBLIC_GO_REDIRECT_ORIGIN?.replace(
        /\/$/,
        ""
    )
    if (origin) {
        return `${origin}/go/${encodeURIComponent(slug)}`
    }
    return `/go/${slug}`
}

/**
 * 商品卡、优惠墙等：批准品牌走统一中转，其它品牌保留原 merchant URL（如 Skimlinks 覆盖的站）。
 */
export function outboundDealLink(
    slug: string,
    brand: string | undefined,
    directMerchantUrl: string
): string {
    if (brand && APPROVED_AFFILIATE_BRANDS.has(brand)) {
        return productGoLink(slug)
    }
    return directMerchantUrl
}

const GO_SLUG_PATH = /^\/go\/([\w-]+)$/

/** `/go/[slug]` on same host or configured go subdomain — eligible for hover prefetch */
export function isPrefetchableGoHref(href: string): boolean {
    if (!href?.trim()) return false
    try {
        const base =
            typeof window !== "undefined"
                ? window.location.origin
                : "https://sleepchoiceguide.com"
        const url = new URL(href, base)
        const match = url.pathname.match(GO_SLUG_PATH)
        if (!match) return false

        const redirectOrigin = process.env.NEXT_PUBLIC_GO_REDIRECT_ORIGIN?.replace(
            /\/$/,
            ""
        )
        if (redirectOrigin) {
            const goOrigin = new URL(redirectOrigin).origin
            return url.origin === goOrigin || url.origin === new URL(base).origin
        }
        return url.origin === new URL(base).origin
    } catch {
        return false
    }
}

const prefetchedGo = new Set<string>()

/** Warm `/go/[slug]` redirect chain on hover; does not block real clicks */
export function prefetchOutboundDeal(href: string): void {
    if (typeof window === "undefined" || !isPrefetchableGoHref(href)) return

    let url: URL
    try {
        url = new URL(href, window.location.origin)
    } catch {
        return
    }

    url.searchParams.set("prefetch", "1")
    const key = url.toString()
    if (prefetchedGo.has(key)) return
    prefetchedGo.add(key)

    void fetch(key, {
        method: "GET",
        credentials: "include",
        priority: "low"
    }).catch(() => {
        prefetchedGo.delete(key)
    })
}
