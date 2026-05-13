/**
 * Quiz 结果：标签权重累加 + 分组输出（床垫 hero / 枕头 essentials / 生活方式 lifestyle）。
 *
 * **没有 Supabase `category` / `quiz_tags` 时**：仍可运行——
 * - `quizShelf`：用 slug + model/name（+ 若有 category）关键词推断 pillow / lifestyle / mattress；
 * - `inferProductTags`：合并 `quiz_tags`（若有）+ 价格档标签 + 货架默认标签 + **audit_scores 阈值**（散热/支撑）。
 */

import type { ProductData } from "@/types/product"
import type { QuizAnswers } from "@/lib/quiz-score"

const BASE_MATCH = 10
const CRITICAL_BONUS = 20
/** 用户选购侧重点与 registry `quizShelf` 一致时的加权 */
const SHELF_FOCUS_BONUS = 22

export type QuizShelf = "mattress" | "pillow" | "lifestyle" | "other"

export interface MatchToken {
    tag: string
    critical: boolean
}

export interface QuizDiagnosis {
    headline: string
    body: string
}

export interface QuizResultBundle {
    diagnosis: QuizDiagnosis
    /** 试卷答案衍生的匹配 token（用于调试展示） */
    matchTokens: MatchToken[]
    weightsBySlug: Record<string, number>
    ranked: ProductData[]
    hero: ProductData | null
    essentials: ProductData[]
    lifestyle: ProductData | null
}

/**
 * 与 `ProductData` 解耦，供审计详情解剖图等仅需 slug/型号/类目的调用方复用。
 * 规则与 `quizShelf` 一致：slug / name / model 优先，其次 `category`。
 */
export function quizShelfFields(input: {
    slug?: string
    name?: string
    model?: string
    category?: string
}): QuizShelf {
    const slug = (input.slug || "").toLowerCase()
    const n = `${input.name ?? ""} ${input.model ?? ""}`.toLowerCase()
    const c = (input.category || "").toLowerCase()
    const blob = `${slug} ${n} ${c}`

    if (/pillow|枕|bolster/i.test(blob)) return "pillow"
    if (/robe|loungewear|bathrobe|towel|waffle/i.test(blob))
        return "lifestyle"
    if (/topper|protector/i.test(blob)) return "other"
    if (/mattress|hybrid|innerspring|latex|foam\s*mattress/i.test(blob))
        return "mattress"

    return "mattress"
}

/** 不依赖 DB category：slug / 型号名优先，其次才是 category 字段 */
export function quizShelf(p: ProductData): QuizShelf {
    return quizShelfFields({
        slug: p.slug,
        name: p.name,
        model: p.model,
        category: p.category
    })
}

/** Supabase `quiz_tags` + 启发式（无 DB 标签时仍可匹配） */
export function inferProductTags(p: ProductData): Set<string> {
    const tags = new Set<string>()
    for (const t of p.quiz_tags ?? []) {
        if (t) tags.add(String(t).trim())
    }

    const model = (p.model || p.name || "").toLowerCase()
    const brand = (p.brand || "").toLowerCase()
    const shelf = quizShelf(p)

    const price = Number(p.price)
    if (Number.isFinite(price) && price > 0) {
        if (price < 1500) tags.add("budget-under_1500")
        else if (price < 2500) tags.add("budget-1500_2500")
        else if (price < 4000) tags.add("budget-2500_4000")
        else tags.add("budget-over_4000")
    }

    if (shelf === "pillow") {
        tags.add("side-sleeper")
        tags.add("pressure-relief")
        tags.add("hotel-vibe")
        tags.add("pillow-layer")
    }

    if (shelf === "lifestyle") {
        tags.add("breathable-weave")
        tags.add("lifestyle-layer")
        tags.add("thermal-regulation")
    }

    if (shelf === "mattress") {
        tags.add("spinal-support")
        tags.add("luxury")
        if (model.includes("latex") || model.includes("organic"))
            tags.add("organic-core")
        if (model.includes("cloud") || model.includes("soft"))
            tags.add("soft-preference")
        if (model.includes("firm") || model.includes("extra-firm"))
            tags.add("firm-preference")
        if (brand.includes("saatva") || model.includes("classic")) {
            tags.add("back-pain")
            tags.add("medium-firm")
        }
        if (brand.includes("fluff")) {
            tags.add("hot-sleeper")
            tags.add("thermal-regulation")
        }
    }

    const cool = Number(p.audit_scores?.cooling)
    const sup = Number(p.audit_scores?.support)
    const press = Number(p.audit_scores?.pressure)
    if (Number.isFinite(cool) && cool >= 8.5) {
        tags.add("hot-sleeper")
        tags.add("thermal-regulation")
    }
    if (
        Number.isFinite(sup) &&
        Number.isFinite(press) &&
        sup >= 8.8 &&
        press >= 8.5
    ) {
        tags.add("back-pain")
        tags.add("pressure-relief")
    }

    return tags
}

function firmnessTag(f: QuizAnswers["firmness"]): string {
    switch (f) {
        case "soft":
            return "soft-preference"
        case "firm":
            return "firm-preference"
        case "medium":
            return "medium-firm"
        default:
            return "universal-fit"
    }
}

function bodyTag(b: QuizAnswers["body_type"]): string {
    switch (b) {
        case "light":
            return "lightweight-build"
        case "heavy":
            return "plus-support"
        default:
            return "standard-build"
    }
}

function sleepIssueTag(i: QuizAnswers["sleep_issues"]): string | null {
    switch (i) {
        case "back_pain":
            return "back-pain"
        case "hot":
            return "hot-sleeper"
        case "partner":
            return "motion-isolation"
        default:
            return null
    }
}

function shelfFocusMatchesProduct(
    answers: QuizAnswers,
    p: ProductData
): boolean {
    const focus = answers.product_focus ?? "mattress"
    if (focus === "any") return false
    const shelf = quizShelf(p)
    return (
        (focus === "mattress" && shelf === "mattress") ||
        (focus === "pillow" && shelf === "pillow") ||
        (focus === "topper" && shelf === "other") ||
        (focus === "bedding_lifestyle" && shelf === "lifestyle")
    )
}

/** 用户答案 → 与产品 tags 对齐的 token（含 critical 加码） */
export function answersToMatchTokens(answers: QuizAnswers): MatchToken[] {
    const tokens: MatchToken[] = []

    tokens.push({
        tag: `${answers.sleep_position}-sleeper`,
        critical: false
    })
    tokens.push({ tag: firmnessTag(answers.firmness), critical: false })
    tokens.push({ tag: bodyTag(answers.body_type), critical: false })

    const issue = sleepIssueTag(answers.sleep_issues)
    if (issue) {
        tokens.push({ tag: issue, critical: true })
    } else {
        tokens.push({ tag: "balanced-profile", critical: false })
    }

    if (answers.budget && answers.budget !== "unsure") {
        tokens.push({
            tag: `budget-${answers.budget}`,
            critical: false
        })
    }

    return tokens
}

export function buildDiagnosis(answers: QuizAnswers): QuizDiagnosis {
    const focus = answers.product_focus ?? "mattress"
    if (focus === "pillow") {
        return {
            headline:
                "Cervical stack optimization — loft and thermal layers prioritized.",
            body: "Matching lifts pillow-layer tags and pressure relief vectors; audit cooling scores weigh heavily for head/neutral spine alignment."
        }
    }
    if (focus === "topper") {
        return {
            headline:
                "Surface correction layer — transition depth over chassis stiffness.",
            body: "Tag engine favors topper/protector-class SKUs and pressure-forward audits compatible with your existing mattress chassis."
        }
    }
    if (focus === "bedding_lifestyle") {
        return {
            headline:
                "Thermal comfort envelope — breathable lifestyle SKUs weighted.",
            body: "Registry routing prioritizes lifestyle-layer tags (thermal regulation, breathable weave) alongside audit-verified materials."
        }
    }

    const hot = answers.sleep_issues === "hot"
    const side = answers.sleep_position === "side"
    const backPain = answers.sleep_issues === "back_pain"
    const partner = answers.sleep_issues === "partner"
    const stomach = answers.sleep_position === "stomach"

    if (hot && side) {
        return {
            headline:
                "Thermal-sensitive lateral sleeper — cooling vs. pressure zoning conflict flagged.",
            body: "Audit synthesis: prioritize heat dissipation layers without sacrificing shoulder–hip relief vectors. Tag-weighted picks bias breathable assemblies and zoned support cores."
        }
    }
    if (backPain && stomach) {
        return {
            headline:
                "Prone sleeper with lumbar deficit — anterior tilt compensation required.",
            body: "Forensic routing elevates firm transitional cores and lumbar reinforcement tags; pillow accessories may offload cervical torque."
        }
    }
    if (backPain) {
        return {
            headline:
                "Spinal load asymmetry detected — lumbar reinforcement indicated.",
            body: "Matching favors tagged lumbar-forward mattresses and pressure-balanced surfaces validated in audit_notes."
        }
    }
    if (hot) {
        return {
            headline: "High thermal retention profile — phase-change pathways prioritized.",
            body: "Products tagged for thermal regulation and breathable weaves surface first."
        }
    }
    if (partner) {
        return {
            headline: "Dual-sleeper isolation priority — motion-decoupling tags weighted.",
            body: "Essentials may include pocketed or latex-transition layers per registry tags."
        }
    }
    if (side) {
        return {
            headline: "Zoned lateral sleeper — shoulder sink vs. spinal lift balance.",
            body: "Tag engine rewards pressure-relief and side-sleeper vectors across mattresses and pillows."
        }
    }

    return {
        headline:
            "Balanced biometric signature — universal calibration acceptable.",
            body: "Mixed-tag weighting with composite registry score as tiebreaker; expand Supabase `quiz_tags` for tighter brand control."
    }
}

export function calculateQuizResults(
    products: ProductData[],
    answers: QuizAnswers
): QuizResultBundle {
    const tokens = answersToMatchTokens(answers)
    const diagnosis = buildDiagnosis(answers)

    type Scored = { p: ProductData; weight: number }
    const scored: Scored[] = products.map((p) => {
        const tagSet = inferProductTags(p)
        let weight = 0
        for (const { tag, critical } of tokens) {
            if (tagSet.has(tag)) {
                weight += BASE_MATCH
                if (critical) weight += CRITICAL_BONUS
            }
        }
        const rating = Number(p.rating) || Number(p.audit_scores?.overall) || 0
        weight += Math.min(18, rating * 1.8)

        if (shelfFocusMatchesProduct(answers, p)) {
            weight += SHELF_FOCUS_BONUS
        }

        return { p, weight }
    })

    scored.sort((a, b) => {
        if (b.weight !== a.weight) return b.weight - a.weight
        const ao =
            Number(a.p.rating) || Number(a.p.audit_scores?.overall) || 0
        const bo =
            Number(b.p.rating) || Number(b.p.audit_scores?.overall) || 0
        return bo - ao
    })

    const ranked = scored.map((s) => s.p)
    const weightsBySlug: Record<string, number> = {}
    scored.forEach(({ p, weight }) => {
        weightsBySlug[p.slug] = Math.round(weight)
    })

    const byShelf = (shelf: QuizShelf) =>
        scored.filter((s) => quizShelf(s.p) === shelf)

    const mattressPool = byShelf("mattress")
    const pillowPool = byShelf("pillow")
    const topperPool = byShelf("other")
    const lifestylePool = byShelf("lifestyle")

    const focus = answers.product_focus ?? "mattress"

    const hero =
        focus === "pillow"
            ? pillowPool[0]?.p ??
              ranked.find((p) => quizShelf(p) === "pillow") ??
              ranked[0] ??
              null
            : focus === "topper"
              ? topperPool[0]?.p ??
                ranked.find((p) => quizShelf(p) === "other") ??
                mattressPool[0]?.p ??
                ranked[0] ??
                null
              : focus === "bedding_lifestyle"
                ? lifestylePool[0]?.p ??
                  ranked.find((p) => quizShelf(p) === "lifestyle") ??
                  ranked[0] ??
                  null
                : focus === "any"
                  ? ranked[0] ?? null
                  : mattressPool[0]?.p ??
                    ranked.find((p) => quizShelf(p) === "mattress") ??
                    ranked[0] ??
                    null

    /** 枕头侧重时 Hero 已占首位，Essentials 跳过重复 */
    const essentials =
        focus === "pillow"
            ? pillowPool.slice(1, 3).map((s) => s.p)
            : pillowPool.slice(0, 2).map((s) => s.p)

    const lifestylePick =
        lifestylePool.find((s) => s.p.slug !== hero?.slug) ?? lifestylePool[0]
    const lifestyle = lifestylePick?.p ?? null

    return {
        diagnosis,
        matchTokens: tokens,
        weightsBySlug,
        ranked,
        hero,
        essentials,
        lifestyle
    }
}

export function expertSnippet(note: string | undefined, maxLen = 360): string {
    const n = note?.trim()
    if (!n) return ""
    if (n.length <= maxLen) return n
    return `${n.slice(0, maxLen).trim()}…`
}
