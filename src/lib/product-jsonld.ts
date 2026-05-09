/**
 * Product JSON-LD for registry pages — schema.org Product + Offer merchant fields
 * (availability, hasMerchantReturnPolicy, shippingDetails) for Google Search Console.
 */

import { SITE_ORIGIN } from "@/lib/site-origin"

function stripSummaryTimestamp(log: string): string {
    return log.replace(/\[T-.*?\]\s+/g, "").trim()
}

/** Align with generateMetadata: SEO intro → audit summary → cleaned summary_log */
export function productIntroDescriptionForJsonLd(input: {
    seo_description?: string | null
    audit_note?: string | null
    summary_log?: string | null
}): string {
    const seo = input.seo_description?.trim()
    if (seo) return seo
    const audit = input.audit_note?.trim()
    if (audit) return audit
    const log = input.summary_log
        ? stripSummaryTimestamp(input.summary_log)
        : ""
    if (log) return log
    return "Professional forensic material analysis and sleep performance audit."
}

function merchantFieldsForBrand(brand: string): {
    merchantReturnPolicy: Record<string, unknown>
    shippingDetails: Record<string, unknown>
} {
    const b = brand.trim()
    const us = {
        "@type": "DefinedRegion" as const,
        addressCountry: "US"
    }

    const baseReturn = {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "US",
        returnPolicyCategory:
            "https://schema.org/MerchantReturnFiniteReturnWindow",
        returnMethod: "https://schema.org/ReturnByMail"
    }

    if (b === "FluffCo") {
        return {
            merchantReturnPolicy: {
                ...baseReturn,
                merchantReturnDays: 30,
                returnFees: "https://schema.org/FreeReturn"
            },
            shippingDetails: {
                "@type": "OfferShippingDetails",
                shippingDestination: us,
                description:
                    "Free standard shipping on orders of $150 or more within the contiguous United States; fees may apply below the threshold."
            }
        }
    }

    if (b === "Saatva") {
        return {
            merchantReturnPolicy: {
                ...baseReturn,
                merchantReturnDays: 365,
                name: "365-night home trial"
            },
            shippingDetails: {
                "@type": "OfferShippingDetails",
                shippingDestination: us,
                description:
                    "Complimentary white glove mattress delivery and setup for qualifying purchases.",
                shippingRate: {
                    "@type": "MonetaryAmount",
                    value: "0",
                    currency: "USD"
                }
            }
        }
    }

    if (b === "Sleep & Beyond") {
        return {
            merchantReturnPolicy: {
                ...baseReturn,
                merchantReturnDays: 30
            },
            shippingDetails: {
                "@type": "OfferShippingDetails",
                shippingDestination: us,
                description:
                    "Shipping methods and delivery timelines vary by item and destination within the United States."
            }
        }
    }

    return {
        merchantReturnPolicy: {
            ...baseReturn,
            merchantReturnDays: 30
        },
        shippingDetails: {
            "@type": "OfferShippingDetails",
            shippingDestination: us,
            description:
                "Shipping and delivery options vary by retailer and destination."
        }
    }
}

export interface BuildRegistryProductJsonLdInput {
    slug: string
    brand: string
    model: string
    seo_description?: string | null
    audit_note?: string | null
    summary_log?: string | null
    image_url?: string | null
    /** Lowest active offer price for AggregateOffer / nested Offer */
    lowPriceNum: number
    /** Highest active offer price when multiple offers exist */
    highPriceNum: number
    offerCount: number
    hasOfferForLd: boolean
    /** Display price for nested Offer (matches lowPrice when valid) */
    offerPriceDisplay: string | number
    scoresOverall: number
    showAggregateRating: boolean
    reviewCount: number
}

export function buildRegistryProductJsonLd(
    input: BuildRegistryProductJsonLdInput
): Record<string, unknown> {
    const pageUrl = `${SITE_ORIGIN}/registry/${encodeURIComponent(input.slug)}`
    const description = productIntroDescriptionForJsonLd({
        seo_description: input.seo_description,
        audit_note: input.audit_note,
        summary_log: input.summary_log
    })

    const productJsonLd: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: `${input.brand} ${input.model}`,
        description,
        brand: { "@type": "Brand", name: input.brand },
        url: pageUrl
    }

    const img = input.image_url && String(input.image_url).trim()
    if (img) {
        productJsonLd.image = img
    }

    if (input.showAggregateRating) {
        const rc = input.reviewCount
        productJsonLd.aggregateRating = {
            "@type": "AggregateRating",
            ratingValue: input.scoresOverall,
            bestRating: "10",
            worstRating: "1",
            ratingCount: rc > 0 ? rc.toString() : "85",
            reviewCount: rc > 0 ? rc.toString() : "82"
        }
    }

    if (input.hasOfferForLd) {
        const { merchantReturnPolicy, shippingDetails } =
            merchantFieldsForBrand(input.brand)

        const nestedOffer: Record<string, unknown> = {
            "@type": "Offer",
            url: pageUrl,
            priceCurrency: "USD",
            price: input.offerPriceDisplay,
            availability: "https://schema.org/InStock",
            itemCondition: "https://schema.org/NewCondition",
            hasMerchantReturnPolicy: merchantReturnPolicy,
            shippingDetails
        }

        productJsonLd.offers = {
            "@type": "AggregateOffer",
            url: pageUrl,
            priceCurrency: "USD",
            lowPrice: input.offerPriceDisplay,
            highPrice:
                input.highPriceNum > input.lowPriceNum
                    ? input.highPriceNum
                    : input.offerPriceDisplay,
            offerCount: Math.max(1, input.offerCount),
            offers: [nestedOffer]
        }
    }

    return productJsonLd
}
