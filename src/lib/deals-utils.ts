import type { Offer, ProductData } from "@/types/product"

const PLACEHOLDER_PROMO_TEXT = new Set(["", "check latest price"])

/**
 * 仅当库里有爬虫写入的 `promo_discount_percent`（官网可见的叠加折扣）时才用于折算；
 * 不按品牌猜测默认百分比。
 */
export function siteWideStackPercent(_brand: string | undefined, dbPromoPercent: unknown): number {
    const d = Number(dbPromoPercent)
    if (Number.isFinite(d) && d > 0 && d < 100) return d
    return 0
}

/** PDP 标价再叠站点券后的估算支付价（用于货架主价展示） */
export function merchantPriceAfterSiteStack(
    merchantPrice: number,
    brand: string | undefined,
    dbPromoPercent: unknown
): number {
    const pct = siteWideStackPercent(brand, dbPromoPercent)
    if (pct <= 0 || !Number.isFinite(merchantPrice)) return merchantPrice
    return Math.round(merchantPrice * (1 - pct / 100) * 100) / 100
}

export function isPlaceholderPromoText(text: string | undefined): boolean {
    const t = (text ?? "").trim().toLowerCase()
    return PLACEHOLDER_PROMO_TEXT.has(t)
}

/** 合并字段缺失时，用 oldPrice/price 推算折扣比例（与 registry 逻辑一致） */
export function effectiveSavingsPercent(offer: Offer): number | null {
    if (offer.savingsPercent != null && offer.savingsPercent > 0) {
        return offer.savingsPercent
    }
    const old = offer.oldPrice
    const price = offer.price
    if (
        typeof old === "number" &&
        typeof price === "number" &&
        old > price &&
        old > 0
    ) {
        return Math.round(((old - price) / old) * 100)
    }
    return null
}

function hasNoPriceDifference(offer: Offer): boolean {
    const pct = effectiveSavingsPercent(offer)
    const amt =
        offer.savingsAmount ??
        (typeof offer.oldPrice === "number" &&
        typeof offer.price === "number" &&
        offer.oldPrice > offer.price
            ? offer.oldPrice - offer.price
            : null)
    const noPct = pct == null || pct <= 0
    const noAmt = amt == null || amt <= 0
    return noPct && noAmt
}

export function passesDealFilter(p: ProductData): boolean {
    const offer = p.offers?.[0]
    if (!offer) return false

    if (
        offer.promo_text?.trim() === "LATEST_DEAL" &&
        hasNoPriceDifference(offer)
    ) {
        return false
    }

    const pct = effectiveSavingsPercent(offer)
    const meaningfulDiscount = pct != null && pct > 0
    const realPromo = !isPlaceholderPromoText(offer.promo_text)
    const hasCoupon = Boolean(offer.couponCode?.trim())

    return meaningfulDiscount || realPromo || hasCoupon
}

export function isVolatilePromo(promoText: string | undefined): boolean {
    if (!promoText?.trim()) return false
    return /limited\s*time|ending\s*soon/i.test(promoText)
}

export function isInStockAvailability(availability: string | undefined): boolean {
    const a = availability?.trim().toUpperCase().replace(/\s+/g, "_")
    return a === "IN_STOCK"
}

/** 稳定 pseudo-random 0..max-1，避免 SSR 与 hydration 抖动 */
export function stablePick(seed: string, max: number): number {
    let h = 2166136261
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return Math.abs(h) % max
}
