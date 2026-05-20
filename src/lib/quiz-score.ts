/**
 * 将 Quiz 答案映射到实验室审计维度（support / cooling / pressure / durability），
 * 对任意 `ProductData[]` 排序 —— 新增产品只需入库含 audit_scores 即可参与匹配。
 */

import type { ProductData } from "@/types/product"

export type QuizSleepPosition = "back" | "side" | "stomach" | "combination"
export type QuizFirmness = "soft" | "medium" | "firm" | "unsure"
export type QuizBodyType = "light" | "average" | "heavy"
export type QuizSleepIssue = "back_pain" | "hot" | "partner" | "none"
export type QuizBudget =
    | "under_1500"
    | "1500_2500"
    | "2500_4000"
    | "over_4000"
    | "unsure"

/** 用户首要选购的睡眠产品类型（与 `quizShelf` 对齐用于加权） */
export type QuizProductFocus =
    | "mattress"
    | "pillow"
    | "topper"
    | "bedding_lifestyle"
    | "any"

export interface QuizAnswers {
    /** 缺省视为床垫，兼容旧版 quiz URL */
    product_focus?: QuizProductFocus
    sleep_position: QuizSleepPosition
    /** 简版 Quiz 可省略，默认 unsure */
    firmness?: QuizFirmness
    /** 简版 Quiz 可省略，默认 average */
    body_type?: QuizBodyType
    sleep_issues: QuizSleepIssue
    budget?: QuizBudget
}

type ScoreWeights = {
    support: number
    cooling: number
    pressure: number
    durability: number
}

function normalizeWeights(w: ScoreWeights): ScoreWeights {
    const sum = w.support + w.cooling + w.pressure + w.durability
    if (sum <= 0)
        return {
            support: 0.25,
            cooling: 0.25,
            pressure: 0.25,
            durability: 0.25
        }
    return {
        support: w.support / sum,
        cooling: w.cooling / sum,
        pressure: w.pressure / sum,
        durability: w.durability / sum
    }
}

/** 由睡姿 / 体型 / 痛点推导四维权重 */
export function quizAnswersToWeights(answers: QuizAnswers): ScoreWeights {
    const w: ScoreWeights = {
        support: 0.26,
        cooling: 0.24,
        pressure: 0.26,
        durability: 0.24
    }

    switch (answers.sleep_position) {
        case "side":
            w.pressure += 0.12
            w.cooling += 0.04
            break
        case "back":
            w.support += 0.1
            w.pressure += 0.06
            break
        case "stomach":
            w.support += 0.14
            w.durability += 0.08
            break
        case "combination":
            w.support += 0.04
            w.cooling += 0.04
            w.pressure += 0.04
            w.durability += 0.04
            break
    }

    switch (answers.firmness ?? "unsure") {
        case "soft":
            w.pressure += 0.1
            w.support -= 0.03
            break
        case "firm":
            w.support += 0.1
            w.durability += 0.06
            break
        case "medium":
            break
        case "unsure":
            break
    }

    switch (answers.body_type ?? "average") {
        case "light":
            w.pressure += 0.05
            break
        case "heavy":
            w.support += 0.08
            w.durability += 0.1
            break
        case "average":
            break
    }

    switch (answers.sleep_issues) {
        case "back_pain":
            w.support += 0.12
            w.pressure += 0.06
            break
        case "hot":
            w.cooling += 0.18
            break
        case "partner":
            w.durability += 0.08
            w.pressure += 0.04
            break
        case "none":
            w.support += 0.02
            w.cooling += 0.02
            break
    }

    switch (answers.product_focus ?? "mattress") {
        case "pillow":
            w.pressure += 0.12
            w.cooling += 0.06
            w.durability -= 0.06
            break
        case "topper":
            w.pressure += 0.12
            w.support += 0.02
            break
        case "bedding_lifestyle":
            w.cooling += 0.1
            w.pressure += 0.04
            w.support -= 0.04
            break
        case "any":
            break
        case "mattress":
        default:
            break
    }

    return normalizeWeights(w)
}

function budgetRange(b: QuizBudget | undefined): [number, number] | null {
    switch (b) {
        case "under_1500":
            return [400, 1500]
        case "1500_2500":
            return [1500, 2500]
        case "2500_4000":
            return [2500, 4000]
        case "over_4000":
            return [4000, 50000]
        case "unsure":
            return null
        default:
            return null
    }
}

function extractAuditScores(p: ProductData) {
    const s = p.audit_scores
    const overall = Number(s?.overall) || Number(p.rating) || 0
    return {
        support: Number(s?.support) || overall,
        cooling: Number(s?.cooling) || overall * 0.92,
        pressure: Number(s?.pressure) || overall,
        durability: Number(s?.durability) || overall * 0.95,
        overall
    }
}

/**
 * 加权实验室维度 + 少量 overall 平滑；预算外惩罚。
 * 返回约 0–100 的匹配分。
 */
export function scoreProductForQuiz(
    p: ProductData,
    weights: ScoreWeights,
    budget: QuizBudget | undefined
): number {
    const { support, cooling, pressure, durability, overall } =
        extractAuditScores(p)

    const blended =
        weights.support * support +
        weights.cooling * cooling +
        weights.pressure * pressure +
        weights.durability * durability

    let score = blended * 8.5 + overall * 1.5
    const range = budgetRange(budget)
    const price = Number(p.price)
    if (range && Number.isFinite(price) && price > 0) {
        if (price < range[0] || price > range[1]) {
            score -= 12
        }
    }

    return Math.max(0, Math.min(100, score))
}

export interface QuizRankResult {
    ranked: ProductData[]
    scoresBySlug: Record<string, number>
    weights: ScoreWeights
}

export function rankProductsByQuiz(
    products: ProductData[],
    answers: QuizAnswers
): QuizRankResult {
    const weights = quizAnswersToWeights(answers)
    const scoresBySlug: Record<string, number> = {}

    const scored = products.map((p) => {
        const sc = scoreProductForQuiz(p, weights, answers.budget)
        scoresBySlug[p.slug] = sc
        return { p, sc }
    })

    scored.sort((a, b) => {
        if (b.sc !== a.sc) return b.sc - a.sc
        const ao = extractAuditScores(a.p).overall
        const bo = extractAuditScores(b.p).overall
        return bo - ao
    })

    return {
        ranked: scored.map((x) => x.p),
        scoresBySlug,
        weights
    }
}

function normalizeQuizPayload(
    o: Record<string, unknown>
): QuizAnswers | null {
    const sleep_position = o.sleep_position as QuizSleepPosition
    const firmnessRaw = o.firmness as QuizFirmness | undefined
    const bodyRaw = o.body_type as QuizBodyType | undefined
    const sleep_issues = o.sleep_issues as QuizSleepIssue
    const budgetRaw = o.budget as QuizBudget | undefined
    const focusRaw = o.product_focus as QuizProductFocus | undefined

    const positions: QuizSleepPosition[] = [
        "back",
        "side",
        "stomach",
        "combination"
    ]
    const firmnesses: QuizFirmness[] = ["soft", "medium", "firm", "unsure"]
    const bodies: QuizBodyType[] = ["light", "average", "heavy"]
    const issues: QuizSleepIssue[] = ["back_pain", "hot", "partner", "none"]

    if (!positions.includes(sleep_position) || !issues.includes(sleep_issues)) {
        return null
    }

    const firmness =
        firmnessRaw && firmnesses.includes(firmnessRaw) ? firmnessRaw : "unsure"
    const body_type =
        bodyRaw && bodies.includes(bodyRaw) ? bodyRaw : "average"

    const budgets: QuizBudget[] = [
        "under_1500",
        "1500_2500",
        "2500_4000",
        "over_4000",
        "unsure"
    ]
    const safeBudget =
        budgetRaw && budgets.includes(budgetRaw) ? budgetRaw : undefined

    const focuses: QuizProductFocus[] = [
        "mattress",
        "pillow",
        "topper",
        "bedding_lifestyle",
        "any"
    ]
    const product_focus =
        focusRaw && focuses.includes(focusRaw) ? focusRaw : "mattress"

    return {
        product_focus,
        sleep_position,
        firmness,
        body_type,
        sleep_issues,
        budget: safeBudget
    }
}

/** 客户端表单状态 → 强类型答案（用于跳转前校验） */
export function quizAnswersFromRecord(
    rec: Record<string, string>
): QuizAnswers | null {
    return normalizeQuizPayload(rec as Record<string, unknown>)
}

/** 解析 `/best-picks?quiz=1&answers=...` 中的 JSON */
export function parseQuizAnswersParam(raw: string | undefined): QuizAnswers | null {
    if (!raw?.trim()) return null
    try {
        const decoded = decodeURIComponent(raw)
        const o = JSON.parse(decoded) as Record<string, unknown>
        return normalizeQuizPayload(o)
    } catch {
        return null
    }
}

/** 写入 localStorage，供其它组件读取偏好 */
export function persistQuizPrefsFromAnswers(answers: QuizAnswers): void {
    if (typeof window === "undefined") return

    const firmnessMap: Record<QuizFirmness, "soft" | "medium" | "firm"> = {
        soft: "soft",
        medium: "medium",
        firm: "firm",
        unsure: "medium"
    }

    const inferSupport = (a: QuizAnswers): number => {
        let n = 7
        if (a.sleep_issues === "back_pain") n += 1.5
        if ((a.body_type ?? "average") === "heavy") n += 1
        if ((a.firmness ?? "unsure") === "firm") n += 1
        if ((a.firmness ?? "unsure") === "soft") n -= 0.5
        return Math.min(10, Math.max(1, Math.round(n)))
    }

    const inferCooling = (a: QuizAnswers): number => {
        let n = 7
        if (a.sleep_issues === "hot") n += 2.5
        if (a.sleep_position === "side") n += 0.5
        return Math.min(10, Math.max(1, Math.round(n)))
    }

    const inferOrganic = (a: QuizAnswers): number => {
        let n = 7
        if (a.sleep_issues === "none") n += 0.5
        return Math.min(10, Math.max(1, Math.round(n)))
    }

    const budgetDefaults: Record<
        QuizBudget,
        [number, number]
    > = {
        under_1500: [400, 1500],
        "1500_2500": [1500, 2500],
        "2500_4000": [2500, 4000],
        over_4000: [4000, 12000],
        unsure: [800, 8000]
    }

    const br = answers.budget
        ? budgetDefaults[answers.budget]
        : ([800, 8000] as [number, number])

    const payload = {
        supportLevel: inferSupport(answers),
        coolingPriority: inferCooling(answers),
        naturalMaterialPreference: inferOrganic(answers),
        budgetRange: br,
        firmnessPref: firmnessMap[answers.firmness ?? "unsure"],
        quizAnswers: answers
    }

    try {
        localStorage.setItem("sleepPrefs", JSON.stringify(payload))
    } catch {
        /* ignore quota */
    }
}
