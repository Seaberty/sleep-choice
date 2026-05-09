import { NextResponse } from "next/server"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { appendCouponToMerchantUrl } from "@/lib/merchant-coupon-url"

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

/**
 * CJ「deep link」前缀：必须以 ?url= 结尾；完整目的地 URL 再做 encodeURIComponent。
 * Sleep & Beyond：验证 PID 101698024 + Link ID 13814555。
 * Saatva：在面板确认 Link ID 后写入 AFFILIATE_CJ_SAATVA。
 */
function cjDeepLinkPrefix(siteName: string): string | undefined {
    const map: Record<string, string | undefined> = {
        FluffCo:
        process.env.AFFILIATE_IMPACT_FUFFCO ??
        "https://fluffco.pxf.io/c/6815113/3012270/26581?u=",
        "Sleep & Beyond":
            process.env.AFFILIATE_CJ_SLEEP_AND_BEYOND ??
            "https://www.tkqlhce.com/click-101698024-13814555?url=",
        Saatva: process.env.AFFILIATE_CJ_SAATVA,
    }
    const key = siteName.trim()
    return map[key]
}

export async function GET(
    _request: Request,
    context: { params: Promise<{ slug: string }> }
) {
    const { slug } = await context.params

    if (!slug || !/^[\w-]+$/.test(slug)) {
        return NextResponse.redirect(FALLBACK_HOME, 302)
    }

    const { data, error } = await supabase
        .from("audit_products")
        .select(
            `
      slug,
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
    targetUrl = appendCouponToMerchantUrl(
        targetUrl,
        siteName,
        offer?.coupon_code
    )

    if (offer?.id) {
        await incrementOfferClickCount(offer.id)
    }

    const affiliateBase = cjDeepLinkPrefix(siteName)

    if (affiliateBase) {
        return NextResponse.redirect(
            `${affiliateBase}${encodeURIComponent(targetUrl)}`,
            302
        )
    }

    return NextResponse.redirect(targetUrl, 302)
}
