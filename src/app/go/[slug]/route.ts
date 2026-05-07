import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const FALLBACK_HOME = "https://sleepchoiceguide.com"

type OfferRow = {
    offer_url: string | null
    site_name: string | null
    is_primary: boolean | null
    status: string | null
}

/**
 * CJ「deep link」前缀：必须以 ?url= 结尾；完整目的地 URL 再做 encodeURIComponent。
 * Sleep & Beyond：验证 PID 101698024 + Link ID 13814555。
 * Saatva：在面板确认 Link ID 后写入 AFFILIATE_CJ_SAATVA。
 */
function cjDeepLinkPrefix(siteName: string): string | undefined {
    const map: Record<string, string | undefined> = {
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
        offer_url,
        site_name,
        is_primary,
        status
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

    const targetUrl =
        (offer?.offer_url && offer.offer_url.trim()) ||
        (typeof data.official_link === "string" && data.official_link.trim()) ||
        ""

    if (!targetUrl) {
        return NextResponse.redirect(FALLBACK_HOME, 302)
    }

    const siteName = offer?.site_name?.trim() ?? ""
    const affiliateBase = cjDeepLinkPrefix(siteName)

    if (affiliateBase) {
        return NextResponse.redirect(
            `${affiliateBase}${encodeURIComponent(targetUrl)}`,
            302
        )
    }

    return NextResponse.redirect(targetUrl, 302)
}
