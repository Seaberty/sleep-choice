import { cache } from "react"
import { unstable_cache } from "next/cache"
import { supabase } from "@/lib/supabase"

const REGISTRY_PRODUCT_SELECT = `
  *,
  product_offers (
    site_name,
    price,
    offer_url,
    is_primary,
    status,
    promo_discount_percent
  )
`

async function fetchRegistryProductFromDb(slug: string) {
    const { data, error } = await supabase
        .from("audit_products")
        .select(REGISTRY_PRODUCT_SELECT)
        .eq("slug", slug)
        .single()

    if (error || !data) return null
    return data
}

/**
 * Single source for `/registry/[slug]` — dedupes generateMetadata + page in one
 * navigation, and caches across requests for faster repeat opens.
 */
export const getRegistryProductBySlug = cache(async (slug: string) => {
    return unstable_cache(
        () => fetchRegistryProductFromDb(slug),
        ["registry-product", slug],
        { revalidate: 120, tags: [`registry-${slug}`] }
    )()
})
