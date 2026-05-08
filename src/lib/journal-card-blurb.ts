import type { ProductData } from "@/types/product"

function stripSummaryNoise(log: string): string {
    return log.replace(/\[T-.*?\]\s+/g, "").trim()
}

/** Single-card preview on /docs — prefer real audit copy over boilerplate. */
export function previewTextForJournalCard(
    p: ProductData,
    maxLen = 220
): string {
    const note = (p.audit_note || "").trim()
    if (note.length >= 24) {
        return note.length > maxLen
            ? `${note.slice(0, maxLen).trim()}…`
            : note
    }

    const log = p.summary_log ? stripSummaryNoise(p.summary_log) : ""
    if (log.length >= 24) {
        return log.length > maxLen
            ? `${log.slice(0, maxLen).trim()}…`
            : log
    }

    const firstPro = p.pros?.map((x) => String(x).trim()).find(Boolean)
    if (firstPro) {
        return firstPro.length > maxLen
            ? `${firstPro.slice(0, maxLen).trim()}…`
            : firstPro
    }

    const r = Number(p.rating)
    const score = Number.isFinite(r) ? r.toFixed(1) : "—"
    return `Lab-indexed observation · composite performance index ${score}/10. Open the log for full scoring matrix and acquisition context.`
}
