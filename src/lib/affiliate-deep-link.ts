import { affiliateNetworkKey } from "@/lib/affiliate-config"

/**
 * CJ / Impact deep-link 前缀；完整商户 URL 由调用方 encodeURIComponent。
 * Saatva 无内置默认 — 须在生产环境配置 AFFILIATE_CJ_SAATVA。
 */
export function affiliateDeepLinkPrefix(
    siteName: string | undefined | null,
    brand?: string | undefined | null
): string | undefined {
    const key = affiliateNetworkKey(siteName, brand)
    if (!key) return undefined

    const map: Record<string, string | undefined> = {
        FluffCo:
            process.env.AFFILIATE_IMPACT_FUFFCO ??
            "https://fluffco.pxf.io/c/6815113/3012270/26581?u=",
        "Sleep & Beyond":
            process.env.AFFILIATE_CJ_SLEEP_AND_BEYOND ??
            "https://www.tkqlhce.com/click-101698024-13814555?url=",
        Saatva: process.env.AFFILIATE_CJ_SAATVA
    }
    return map[key]
}

export function isSaatvaCjConfigured(): boolean {
    return Boolean(process.env.AFFILIATE_CJ_SAATVA?.trim())
}
