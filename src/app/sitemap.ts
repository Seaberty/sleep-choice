import { MetadataRoute } from "next"
import { supabase } from "@/lib/supabase"
import { isListableAuditProduct } from "@/lib/audit-list-eligibility"
import { SITE_ORIGIN } from "@/lib/site-origin"
import { getMergedComparePairs } from "@/lib/compare-seo"
import { SEO_GUIDES } from "@/lib/seo-guides"

export const revalidate = 3600

const SITE = SITE_ORIGIN

function staticEntries(): MetadataRoute.Sitemap {
    const paths = [
        "/",
        "/about",
        "/best-picks",
        "/calculator",
        "/compare",
        "/guides",
        "/contact",
        "/deals",
        "/disclosure",
        "/methodology",
        "/privacy",
        "/quiz",
        "/registry",
        "/terms"
    ]

    return paths.map((path) => ({
        url: `${SITE}${path}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: path === "/" ? 1 : path === "/registry" ? 0.9 : 0.7
    }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const base = staticEntries()

    try {
        const { data, error } = await supabase
            .from("audit_products")
            .select("slug, updated_at, image_url, price, audit_scores")

        if (error || !data?.length) return base

        const rows = data.filter(isListableAuditProduct).filter((r) => {
            const s = r.slug && String(r.slug).trim()
            return Boolean(s)
        })

        /** 仅 registry SKU 页入 sitemap；/journal/* 永久 301 → /registry（next.config redirects）。 */
        const productUrls: MetadataRoute.Sitemap = rows.map((row) => {
            const segment = encodeURIComponent(String(row.slug).trim())
            const lastModified = row.updated_at
                ? new Date(row.updated_at as string)
                : new Date()
            return {
                url: `${SITE}/registry/${segment}`,
                changeFrequency: "daily" as const,
                lastModified,
                priority: 0.85
            }
        })

        const mergedPairs = await getMergedComparePairs()
        const compareUrls: MetadataRoute.Sitemap = mergedPairs.map((p) => ({
            url: `${SITE}/compare/${p.pairSlug}`,
            changeFrequency: "weekly" as const,
            lastModified: new Date(),
            priority: 0.8
        }))

        const guideUrls: MetadataRoute.Sitemap = SEO_GUIDES.map((g) => ({
            url: `${SITE}/guides/${g.slug}`,
            changeFrequency: "weekly" as const,
            lastModified: g.updatedAt ? new Date(g.updatedAt) : new Date(),
            priority: 0.78
        }))

        return [...base, ...productUrls, ...compareUrls, ...guideUrls]
    } catch {
        let compareUrls: MetadataRoute.Sitemap = []
        try {
            const mergedPairs = await getMergedComparePairs()
            compareUrls = mergedPairs.map((p) => ({
                url: `${SITE}/compare/${p.pairSlug}`,
                changeFrequency: "weekly" as const,
                lastModified: new Date(),
                priority: 0.8
            }))
        } catch {
            compareUrls = []
        }
        const guideUrls: MetadataRoute.Sitemap = SEO_GUIDES.map((g) => ({
            url: `${SITE}/guides/${g.slug}`,
            changeFrequency: "weekly" as const,
            lastModified: g.updatedAt ? new Date(g.updatedAt) : new Date(),
            priority: 0.78
        }))
        return [...base, ...compareUrls, ...guideUrls]
    }
}
