import { cache } from "react"
import { supabase } from "@/lib/supabase"
import { isListableAuditProduct } from "@/lib/audit-list-eligibility"
import { quizShelfFields, type QuizShelf } from "@/lib/quiz-results"
import {
    canonicalComparePairSlug,
    COMPARE_SEO_PAIRS,
    type CompareSeoPair
} from "@/lib/compare-seo"

const MAX_AUTO_PAIRS = 72
const MAX_PER_BRAND_SAME = 6
const MAX_CROSS_BRANDS = 8

type Row = {
    slug: string
    brand: string
    model: string
    name: string
    category: string
    overall: number
    shelf: QuizShelf
}

function displayName(r: Row): string {
    const n = (r.model || r.name || "").trim()
    return n || r.slug
}

function autoPairCopy(a: Row, b: Row): Pick<
    CompareSeoPair,
    "title" | "description" | "intro"
> {
    const labelA = `${a.brand} ${displayName(a)}`.trim()
    const labelB = `${b.brand} ${displayName(b)}`.trim()
    const shelfNote =
        a.shelf === b.shelf && a.shelf !== "other"
            ? ` Both SKUs sit in our ${a.shelf} shelf.`
            : ""

    return {
        title: `${labelA} vs ${labelB}`,
        description: `Side-by-side SleepChoice audit scores for ${labelA} and ${labelB}—support, cooling, pressure relief, and durability.`,
        intro: `Registry-backed comparison on the same forensic grid.${shelfNote} Indices reflect aggregated owner-review intelligence, not in-house bench tests.`
    }
}

function pairKey(slugA: string, slugB: string): string {
    return canonicalComparePairSlug(slugA, slugB)
}

function addPair(
    out: CompareSeoPair[],
    seen: Set<string>,
    slugA: string,
    slugB: string,
    rows: Map<string, Row>
): void {
    if (out.length >= MAX_AUTO_PAIRS) return
    const a = rows.get(slugA)
    const b = rows.get(slugB)
    if (!a || !b || slugA === slugB) return

    const pairSlug = pairKey(slugA, slugB)
    if (seen.has(pairSlug)) return
    seen.add(pairSlug)

    const [slugLo, slugHi] = [slugA, slugB].sort()
    const copy = autoPairCopy(a, b)
    out.push({
        pairSlug,
        slugA: slugLo,
        slugB: slugHi,
        ...copy
    })
}

function generateAutoPairs(rows: Row[]): CompareSeoPair[] {
    const out: CompareSeoPair[] = []
    const seen = new Set(
        COMPARE_SEO_PAIRS.map((p) => p.pairSlug)
    )
    const bySlug = new Map(rows.map((r) => [r.slug, r]))

    const byShelf = new Map<QuizShelf, Row[]>()
    for (const r of rows) {
        const list = byShelf.get(r.shelf) ?? []
        list.push(r)
        byShelf.set(r.shelf, list)
    }

    for (const [, shelfRows] of byShelf) {
        if (shelfRows.length < 2) continue

        const byBrand = new Map<string, Row[]>()
        for (const r of shelfRows) {
            const list = byBrand.get(r.brand) ?? []
            list.push(r)
            byBrand.set(r.brand, list)
        }

        for (const [, brandRows] of byBrand) {
            if (brandRows.length < 2) continue
            const top = [...brandRows]
                .sort((x, y) => y.overall - x.overall)
                .slice(0, 4)
            let added = 0
            for (let i = 0; i < top.length && added < MAX_PER_BRAND_SAME; i++) {
                for (
                    let j = i + 1;
                    j < top.length && added < MAX_PER_BRAND_SAME;
                    j++
                ) {
                    const before = out.length
                    addPair(out, seen, top[i]!.slug, top[j]!.slug, bySlug)
                    if (out.length > before) added++
                }
            }
        }

        const brandLeaders = [...byBrand.entries()]
            .map(([brand, list]) => {
                const best = [...list].sort((x, y) => y.overall - x.overall)[0]!
                return { brand, row: best }
            })
            .sort((x, y) => y.row.overall - x.row.overall)
            .slice(0, MAX_CROSS_BRANDS)

        for (let i = 0; i < brandLeaders.length; i++) {
            for (let j = i + 1; j < brandLeaders.length; j++) {
                addPair(
                    out,
                    seen,
                    brandLeaders[i]!.row.slug,
                    brandLeaders[j]!.row.slug,
                    bySlug
                )
            }
        }
    }

    return out.slice(0, MAX_AUTO_PAIRS)
}

async function fetchListableRows(): Promise<Row[]> {
    const { data, error } = await supabase
        .from("audit_products")
        .select("slug, brand, model, category, price, image_url, audit_scores")
        .gt("price", 0)

    if (error || !data?.length) return []

    return data
        .filter(isListableAuditProduct)
        .map((item) => {
            const slug = String(item.slug ?? "").trim()
            const brand = String(item.brand ?? "").trim()
            if (!slug || !brand) return null
            const scores = item.audit_scores as { overall?: number } | null
            const overall = Number(scores?.overall) || 0
            return {
                slug,
                brand,
                model: String(item.model ?? "").trim(),
                name: String(item.model ?? "").trim(),
                category: String(item.category ?? "").trim(),
                overall,
                shelf: quizShelfFields({
                    slug,
                    model: String(item.model ?? ""),
                    category: String(item.category ?? "")
                })
            } satisfies Row
        })
        .filter((r): r is Row => r !== null)
        .sort((a, b) => b.overall - a.overall)
}

/** Curated JSON + DB-generated pairs (deduped; curated wins on slug). */
export const getMergedComparePairs = cache(
    async (): Promise<CompareSeoPair[]> => {
        const auto = generateAutoPairs(await fetchListableRows())
        const bySlug = new Map<string, CompareSeoPair>()
        for (const p of auto) bySlug.set(p.pairSlug, p)
        for (const p of COMPARE_SEO_PAIRS) bySlug.set(p.pairSlug, p)
        return [...bySlug.values()].sort((a, b) =>
            a.title.localeCompare(b.title)
        )
    }
)

export async function resolveCompareSeoPair(
    pairSlug: string
): Promise<CompareSeoPair | undefined> {
    const key = pairSlug.trim()
    const pairs = await getMergedComparePairs()
    return pairs.find((p) => p.pairSlug === key)
}

export async function listMergedComparePairPaths(): Promise<string[]> {
    const pairs = await getMergedComparePairs()
    return pairs.map((p) => `/compare/${p.pairSlug}`)
}
