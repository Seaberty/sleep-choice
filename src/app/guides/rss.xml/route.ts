import { getMergedComparePairs } from "@/lib/compare-seo"
import { SEO_GUIDES } from "@/lib/seo-guides"
import { SITE_ORIGIN } from "@/lib/site-origin"

export const revalidate = 3600

function escapeXml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
}

function rssItem(input: {
    title: string
    link: string
    description: string
    pubDate: Date
    guid: string
}): string {
    return `<item>
<title>${escapeXml(input.title)}</title>
<link>${escapeXml(input.link)}</link>
<description>${escapeXml(input.description)}</description>
<pubDate>${input.pubDate.toUTCString()}</pubDate>
<guid isPermaLink="true">${escapeXml(input.guid)}</guid>
</item>`
}

export async function GET() {
    const site = SITE_ORIGIN.replace(/\/$/, "")
    const now = new Date()

    const guideItems = SEO_GUIDES.map((g) =>
        rssItem({
            title: g.title,
            link: `${site}/guides/${g.slug}`,
            description: g.description,
            pubDate: g.updatedAt ? new Date(g.updatedAt) : now,
            guid: `${site}/guides/${g.slug}`
        })
    )

    let compareItems: string[] = []
    try {
        const pairs = await getMergedComparePairs()
        compareItems = pairs.slice(0, 48).map((p) =>
            rssItem({
                title: `Compare: ${p.title}`,
                link: `${site}/compare/${p.pairSlug}`,
                description: p.description,
                pubDate: now,
                guid: `${site}/compare/${p.pairSlug}`
            })
        )
    } catch {
        compareItems = []
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>SleepChoice Guide — Guides &amp; Comparisons</title>
<link>${escapeXml(`${site}/guides`)}</link>
<description>Buying guides and registry-backed product comparisons from SleepChoice Guide.</description>
<language>en-us</language>
<lastBuildDate>${now.toUTCString()}</lastBuildDate>
<atom:link href="${escapeXml(`${site}/guides/rss.xml`)}" rel="self" type="application/rss+xml"/>
${[...guideItems, ...compareItems].join("\n")}
</channel>
</rss>`

    return new Response(xml, {
        headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
        }
    })
}
