/**
 * 与 JSON-LD merchant 策略一致的展示用标签（结果页吸金区）。
 */
export function getMerchantTrustBadgesForBrand(brand: string): string[] {
    const b = brand.trim()
    const out: string[] = ["In stock", "GSC listing aligned"]

    if (b === "Saatva") {
        out.push("365-night trial", "White glove delivery")
        return out
    }
    if (b === "FluffCo") {
        out.push("30-day returns", "Free shipping $150+")
        return out
    }
    if (b === "Sleep & Beyond") {
        out.push("30-day returns")
        return out
    }

    out.push("See registry for shipping & returns")
    return out
}
