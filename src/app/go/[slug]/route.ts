import { NextResponse } from "next/server"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { appendCouponToMerchantUrl } from "@/lib/merchant-coupon-url"
import {
    affiliateDeepLinkPrefix,
    isSaatvaCjConfigured
} from "@/lib/affiliate-deep-link"
import { isApprovedAffiliateBrand } from "@/lib/affiliate-config"

export const dynamic = "force-dynamic"

const FALLBACK_HOME = "https://sleepchoiceguide.com"

type OfferRow = {
    id: string
    offer_url: string | null
    site_name: string | null
    is_primary: boolean | null
    status: string | null
    coupon_code: string | null
}

async function incrementOfferClickCount(offerId: string): Promise<void> {
    const { data, error: selErr } = await supabaseAdmin
        .from("product_offers")
        .select("click_count")
        .eq("id", offerId)
        .maybeSingle()

    if (selErr) {
        console.warn("[go] click_count select:", selErr.message)
        return
    }

    const next = (Number(data?.click_count) || 0) + 1
    const { error: updErr } = await supabaseAdmin
        .from("product_offers")
        .update({ click_count: next })
        .eq("id", offerId)

    if (updErr) {
        console.warn("[go] click_count update:", updErr.message)
    }
}

function isPrefetchRequest(request: Request): boolean {
    const purpose =
        request.headers.get("purpose") ||
        request.headers.get("sec-purpose") ||
        ""
    if (/prefetch/i.test(purpose)) return true
    try {
        const url = new URL(request.url)
        if (url.searchParams.get("prefetch") === "1") return true
    } catch {
        /* ignore */
    }
    return false
}

export async function GET(
    request: Request,
    context: { params: Promise<{ slug: string }> }
) {
    const { slug } = await context.params
    const skipClickTracking = isPrefetchRequest(request)

    if (!slug || !/^[\w-]+$/.test(slug)) {
        return NextResponse.redirect(FALLBACK_HOME, 302)
    }

    const { data, error } = await supabase
        .from("audit_products")
        .select(
            `
      slug,
      brand,
      official_link,
      product_offers (
        id,
        offer_url,
        site_name,
        is_primary,
        status,
        coupon_code
      )
    `
        )
        .eq("slug", slug)
        .single()

    if (error || !data) {
        return NextResponse.redirect(FALLBACK_HOME, 302)
    }

    const offers = (data.product_offers ?? []) as OfferRow[]
    const active = offers.filter((o) => (o.status ?? "active") === "active")
    const offer =
        active.find((o) => o.is_primary) ?? active[0] ?? offers[0]

    let targetUrl =
        (offer?.offer_url && offer.offer_url.trim()) ||
        (typeof data.official_link === "string" && data.official_link.trim()) ||
        ""

    if (!targetUrl) {
        return NextResponse.redirect(FALLBACK_HOME, 302)
    }

    const siteName = offer?.site_name?.trim() ?? ""
    const brand =
        typeof data.brand === "string" ? data.brand.trim() : ""
    targetUrl = appendCouponToMerchantUrl(
        targetUrl,
        siteName || brand,
        offer?.coupon_code
    )

    if (offer?.id && !skipClickTracking) {
        void incrementOfferClickCount(offer.id)
    }

    const affiliateBase = affiliateDeepLinkPrefix(siteName, brand)

    if (
        brand === "Saatva" &&
        isApprovedAffiliateBrand(brand) &&
        !isSaatvaCjConfigured() &&
        !skipClickTracking
    ) {
        console.warn(
            "[go] Saatva click without AFFILIATE_CJ_SAATVA — redirecting direct (0 commission). slug=",
            slug
        )
    }

    if (affiliateBase) {
        return NextResponse.redirect(
            `${affiliateBase}${encodeURIComponent(targetUrl)}`,
            302
        )
    }

    return NextResponse.redirect(targetUrl, 302)
}
