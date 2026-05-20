import { MetadataRoute } from "next"
import { supabase } from "@/lib/supabase"
import { isListableAuditProduct } from "@/lib/audit-list-eligibility"
import { SITE_ORIGIN } from "@/lib/site-origin"

export const revalidate = 3600

const SITE = SITE_ORIGIN

function staticEntries(): MetadataRoute.Sitemap {
    const paths = [
        "/",
        "/about",
        "/best-picks",
        "/calculator",
        "/compare",
        "/contact",
        "/deals",
        "/disclosure",
        "/docs",
        "/intelligence",
        "/journal",
        "/lab",
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

        /** Registry 与 Journal 共用同一批 listable 商品；Journal 路由优先匹配 slug（见 journal/[id]/page.tsx）。 */
        const productUrls: MetadataRoute.Sitemap = rows.flatMap((row) => {
            const segment = encodeURIComponent(String(row.slug).trim())
            const lastModified = row.updated_at
                ? new Date(row.updated_at as string)
                : new Date()
            const daily = { changeFrequency: "daily" as const, lastModified }

            return [
                {
                    url: `${SITE}/registry/${segment}`,
                    ...daily,
                    priority: 0.85
                },
                {
                    url: `${SITE}/journal/${segment}`,
                    ...daily,
                    priority: 0.75
                }
            ]
        })

        return [...base, ...productUrls]
    } catch {
        return base
    }
}
