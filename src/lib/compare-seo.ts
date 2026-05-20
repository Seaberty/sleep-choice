import pairsJson from "@/data/compare-seo-pairs.json"
import type { AuditScores, ProductData } from "@/types/product"

export type CompareSeoPair = {
    pairSlug: string
    slugA: string
    slugB: string
    title: string
    description: string
    intro: string
    verdictHint?: string
}

export const COMPARE_SEO_PAIRS: CompareSeoPair[] = pairsJson as CompareSeoPair[]

const PAIR_BY_SLUG = new Map(
    COMPARE_SEO_PAIRS.map((p) => [p.pairSlug, p] as const)
)

/** Canonical URL segment: lexicographic slug order so A-vs-B === B-vs-A. */
export function canonicalComparePairSlug(slugA: string, slugB: string): string {
    const [a, b] = [slugA.trim(), slugB.trim()].sort()
    return `${a}-vs-${b}`
}

export function parseComparePairSlug(
    pair: string
): { slugA: string; slugB: string } | null {
    const idx = pair.indexOf("-vs-")
    if (idx <= 0) return null
    const slugA = pair.slice(0, idx).trim()
    const slugB = pair.slice(idx + 4).trim()
    if (!slugA || !slugB || slugA === slugB) return null
    return { slugA, slugB }
}

export function comparePairPath(slugA: string, slugB: string): string {
    return `/compare/${canonicalComparePairSlug(slugA, slugB)}`
}

export function getCompareSeoPair(pairSlug: string): CompareSeoPair | undefined {
    return PAIR_BY_SLUG.get(pairSlug)
}

export function buildComparePairTitle(
    products: ProductData[],
    fallback?: string
): string {
    if (fallback?.trim()) return fallback.trim()
    if (products.length >= 2) {
        const [a, b] = products
        return `${a.brand} ${a.name ?? a.slug} vs ${b.brand} ${b.name ?? b.slug}`
    }
    return "Product comparison"
}

export function buildComparePairDescription(
    products: ProductData[],
    fallback?: string
): string {
    if (fallback?.trim()) return fallback.trim()
    if (products.length >= 2) {
        const [a, b] = products
        return `Compare SleepChoice audit scores for ${a.brand} ${a.name ?? ""} and ${b.brand} ${b.name ?? ""}—support, cooling, pressure relief, and durability indices.`
    }
    return "Side-by-side SleepChoice forensic comparison."
}

function scoreNum(scores: AuditScores | undefined, key: keyof AuditScores): number {
    const n = Number(scores?.[key])
    return Number.isFinite(n) ? n : 0
}

/** Short editorial verdict from live scores (supplements static intro). */
export function buildDynamicCompareVerdict(products: ProductData[]): string {
    if (products.length < 2) return ""
    const [a, b] = products
    const sa = a.audit_scores as AuditScores | undefined
    const sb = b.audit_scores as AuditScores | undefined

    const axes = [
        ["overall", "Overall"],
        ["support", "Support"],
        ["cooling", "Cooling"],
        ["pressure", "Pressure"],
        ["durability", "Durability"]
    ] as const
    const winsA: string[] = []
    const winsB: string[] = []

    for (const [key, label] of axes) {
        const va = scoreNum(sa, key)
        const vb = scoreNum(sb, key)
        if (va === 0 && vb === 0) continue
        const diff = va - vb
        if (Math.abs(diff) < 0.15) continue
        if (diff > 0) winsA.push(label)
        else winsB.push(label)
    }

    const nameA = `${a.brand} ${a.name ?? a.slug}`.trim()
    const nameB = `${b.brand} ${b.name ?? b.slug}`.trim()

    if (winsA.length === 0 && winsB.length === 0) {
        return `On current registry data, ${nameA} and ${nameB} score within a narrow band across forensic axes—open each dossier for qualitative pros and cons.`
    }

    const parts: string[] = []
    if (winsA.length)
        parts.push(
            `${nameA} leads on ${winsA.join(", ")}`
        )
    if (winsB.length)
        parts.push(
            `${nameB} leads on ${winsB.join(", ")}`
        )
    return `${parts.join("; ")}. Indices reflect aggregated owner-review intelligence, not in-house lab measurements.`
}

export function listCompareSeoPairPaths(): string[] {
    return COMPARE_SEO_PAIRS.map((p) => `/compare/${p.pairSlug}`)
}

export {
    getMergedComparePairs,
    listMergedComparePairPaths,
    resolveCompareSeoPair
} from "@/lib/compare-pairs-db"
