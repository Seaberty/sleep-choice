/** localStorage key & caps — safe to import from Server Components for parsing URL only */

export const COMPARE_STORAGE_KEY = "sleep-choice-compare-slugs"
export const MAX_COMPARE_ITEMS = 4

/** Broadcast when compare selection changes (same-tab). */
export const COMPARE_UPDATE_EVENT = "sleep-choice-compare-update"

export function parseCompareSlugsFromSearchParam(
    raw: string | string[] | undefined
): string[] {
    const s = Array.isArray(raw) ? raw[0] : raw
    if (!s?.trim()) return []
    const parts = s
        .split(/[,]+/)
        .map((x) => x.trim())
        .filter(Boolean)
    const decoded = parts.map((p) => {
        try {
            return decodeURIComponent(p)
        } catch {
            return p
        }
    })
    return [...new Set(decoded)].slice(0, MAX_COMPARE_ITEMS)
}
