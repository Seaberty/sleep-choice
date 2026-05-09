export interface BrandIntelligenceRow {
    id: string
    brand_slug: string
    product_slug: string
    source_platform: string
    sentiment_score: number
    key_issue_tags: string[]
    verdict_summary: string
    signal_density: number
    confidence_score: number
    collected_at?: string
    updated_at?: string
}
