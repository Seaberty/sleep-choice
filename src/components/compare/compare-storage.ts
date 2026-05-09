"use client"

import {
    COMPARE_STORAGE_KEY,
    COMPARE_UPDATE_EVENT,
    MAX_COMPARE_ITEMS
} from "@/lib/compare-constants"

function safeParse(raw: string | null): string[] {
    if (!raw) return []
    try {
        const j = JSON.parse(raw)
        if (!Array.isArray(j)) return []
        return j
            .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
            .map((x) => x.trim())
            .slice(0, MAX_COMPARE_ITEMS)
    } catch {
        return []
    }
}

export function getCompareSlugs(): string[] {
    if (typeof window === "undefined") return []
    return safeParse(localStorage.getItem(COMPARE_STORAGE_KEY))
}

export function setCompareSlugs(slugs: string[]): void {
    if (typeof window === "undefined") return
    const next = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))].slice(
        0,
        MAX_COMPARE_ITEMS
    )
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(COMPARE_UPDATE_EVENT))
}

export function addCompareSlug(slug: string): {
    ok: boolean
    reason?: "max" | "duplicate"
} {
    const s = slug.trim()
    if (!s) return { ok: false }
    const cur = getCompareSlugs()
    if (cur.includes(s)) return { ok: true, reason: "duplicate" }
    if (cur.length >= MAX_COMPARE_ITEMS) return { ok: false, reason: "max" }
    setCompareSlugs([...cur, s])
    return { ok: true }
}

export function removeCompareSlug(slug: string): void {
    const s = slug.trim()
    setCompareSlugs(getCompareSlugs().filter((x) => x !== s))
}

export function compareHref(slugs: string[]): string {
    if (slugs.length === 0) return "/compare"
    const q = slugs.map(encodeURIComponent).join(",")
    return `/compare?slugs=${q}`
}
