import guidesJson from "@/data/seo-guides.json"

export type SeoGuideSection = {
    heading: string
    paragraphs: string[]
}

export type SeoGuide = {
    slug: string
    title: string
    description: string
    publishedAt: string
    updatedAt: string
    sections: SeoGuideSection[]
    relatedRegistrySlugs: string[]
    relatedComparePairSlugs: string[]
}

export const SEO_GUIDES: SeoGuide[] = guidesJson as SeoGuide[]

const GUIDE_BY_SLUG = new Map(SEO_GUIDES.map((g) => [g.slug, g] as const))

export function getSeoGuide(slug: string): SeoGuide | undefined {
    return GUIDE_BY_SLUG.get(slug.trim())
}

export function listSeoGuideSlugs(): string[] {
    return SEO_GUIDES.map((g) => g.slug)
}

export function listSeoGuidePaths(): string[] {
    return SEO_GUIDES.map((g) => `/guides/${g.slug}`)
}
