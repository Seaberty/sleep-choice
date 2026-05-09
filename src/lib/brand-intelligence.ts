import { cache } from "react"
import { supabase } from "@/lib/supabase"
import type { BrandIntelligenceRow } from "@/types/brand-intelligence"

export const getBrandIntelligenceByProductSlug = cache(
    async (productSlug: string): Promise<BrandIntelligenceRow[]> => {
        const slug = productSlug.trim()
        if (!slug) return []

        const { data, error } = await supabase
            .from("brand_intelligence")
            .select(
                "id, brand_slug, product_slug, source_platform, sentiment_score, key_issue_tags, verdict_summary, signal_density, confidence_score, collected_at, updated_at"
            )
            .eq("product_slug", slug)
            .order("source_platform", { ascending: true })

        if (error || !data) return []
        return data as BrandIntelligenceRow[]
    }
)

export async function listRecentBrandIntelligence(
    limit = 48
): Promise<BrandIntelligenceRow[]> {
    const { data, error } = await supabase
        .from("brand_intelligence")
        .select(
            "id, brand_slug, product_slug, source_platform, sentiment_score, key_issue_tags, verdict_summary, signal_density, confidence_score, collected_at, updated_at"
        )
        .order("updated_at", { ascending: false })
        .limit(limit)

    if (error || !data) return []
    return data as BrandIntelligenceRow[]
}
