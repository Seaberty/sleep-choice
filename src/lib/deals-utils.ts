import type { Offer, ProductData } from "@/types/product"

const PLACEHOLDER_PROMO_TEXT = new Set(["", "check latest price"])

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
