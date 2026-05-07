import { cache } from "react"
import { supabase } from "./supabase"
import { getRegistry } from "./registry"

export type SiteHeaderMetrics = {
    modelsAnalyzed: string
    lastUpdate: string
    protocol: string
    node: string
}

/** Avoid Intl/toLocaleString — Node vs browser can differ and cause hydration mismatches. */
function formatModelsCount(n: number): string {
    if (n <= 0) return "—"
    const s = String(Math.trunc(n))
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

/** Trust-bar date: MAY_2026 (UTC, matches registry timestamps). */
function formatSyncStamp(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    const months = [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC"
    ]
    return `${months[d.getUTCMonth()]}_${d.getUTCFullYear()}`
}

function registryProtocolVersion(registry: {
    version?: string | number
}): string {
    const raw =
        registry.version != null ? String(registry.version) : "1.0.0"
    return raw.startsWith("v") ? raw : `v${raw}`
}

function deployNodeLabel(): string {
    if (process.env.VERCEL_REGION) return process.env.VERCEL_REGION
    if (process.env.NODE_ENV === "development") return "LOCAL"
    return "EDGE"
}

/**
 * Header strip: live model count + latest sync from DB when available,
 * otherwise local registry.json (see getRegistry).
 */
export const getSiteHeaderMetrics = cache(
    async (): Promise<SiteHeaderMetrics> => {
        const registry = await getRegistry()
        const localCount = Object.keys(registry.products ?? {}).length
        let lastIso =
            registry.last_updated ?? new Date().toISOString()

        let dbCount: number | null = null

        try {
            const { count, error } = await supabase
                .from("audit_products")
                .select("*", { count: "exact", head: true })

            if (!error && count != null) dbCount = count

            const { data: latest } = await supabase
                .from("audit_products")
                .select("updated_at")
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle()

            if (latest?.updated_at) lastIso = latest.updated_at
        } catch {
            /* Supabase unavailable — registry-only */
        }

        const count = Math.max(dbCount ?? 0, localCount)

        return {
            modelsAnalyzed: formatModelsCount(count),
            lastUpdate: formatSyncStamp(lastIso),
            protocol: registryProtocolVersion(registry),
            node: deployNodeLabel()
        }
    }
)
