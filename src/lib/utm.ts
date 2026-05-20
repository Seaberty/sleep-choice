/**
 * 出站链接 UTM 规范（Reddit / email / Pinterest / 站内默认）。
 * `/go/[slug]` 会把 query 中的 UTM 透传到最终商户 URL（含 CJ/Impact 包装后）。
 */

export type UtmChannel = "site" | "reddit" | "email" | "pinterest"

export type UtmParams = {
    utm_source: string
    utm_medium: string
    utm_campaign: string
    utm_content?: string
}

const PRESETS: Record<UtmChannel, UtmParams> = {
    site: {
        utm_source: "sleepchoiceguide",
        utm_medium: "referral",
        utm_campaign: "site"
    },
    reddit: {
        utm_source: "reddit",
        utm_medium: "social",
        utm_campaign: "reddit_rss"
    },
    email: {
        utm_source: "email",
        utm_medium: "email",
        utm_campaign: "alert"
    },
    pinterest: {
        utm_source: "pinterest",
        utm_medium: "social",
        utm_campaign: "pinterest"
    }
}

export function utmPreset(channel: UtmChannel): UtmParams {
    return { ...PRESETS[channel] }
}

export function utmSearchParams(
    channel: UtmChannel,
    extra?: Partial<UtmParams>
): URLSearchParams {
    const merged = { ...utmPreset(channel), ...extra }
    const q = new URLSearchParams()
    q.set("utm_source", merged.utm_source)
    q.set("utm_medium", merged.utm_medium)
    q.set("utm_campaign", merged.utm_campaign)
    if (merged.utm_content?.trim()) {
        q.set("utm_content", merged.utm_content.trim())
    }
    return q
}

/** 解析 `/go` 请求或出站 href 上已有的 UTM（优先于 channel 默认）。 */
export function utmFromSearchParams(
    searchParams: URLSearchParams
): Partial<UtmParams> | null {
    const source = searchParams.get("utm_source")?.trim()
    if (!source) return null
    const out: Partial<UtmParams> = { utm_source: source }
    const medium = searchParams.get("utm_medium")?.trim()
    const campaign = searchParams.get("utm_campaign")?.trim()
    const content = searchParams.get("utm_content")?.trim()
    if (medium) out.utm_medium = medium
    if (campaign) out.utm_campaign = campaign
    if (content) out.utm_content = content
    return out
}

/** 将 UTM 合并进绝对 URL（已有同名参数时不覆盖）。 */
export function appendUtmToUrl(
    url: string,
    params: Partial<UtmParams>
): string {
    if (!url?.trim()) return url
    try {
        const u = new URL(url)
        const set = (key: keyof UtmParams, val: string | undefined) => {
            if (!val?.trim()) return
            if (!u.searchParams.has(key)) u.searchParams.set(key, val.trim())
        }
        set("utm_source", params.utm_source)
        set("utm_medium", params.utm_medium)
        set("utm_campaign", params.utm_campaign)
        set("utm_content", params.utm_content)
        return u.toString()
    } catch {
        return url
    }
}

export function resolveUtmForRedirect(
    requestSearch: URLSearchParams,
    fallbackChannel: UtmChannel = "site"
): UtmParams {
    const fromQuery = utmFromSearchParams(requestSearch)
    if (fromQuery?.utm_source) {
        const base = utmPreset(fallbackChannel)
        return {
            utm_source: fromQuery.utm_source,
            utm_medium: fromQuery.utm_medium ?? base.utm_medium,
            utm_campaign: fromQuery.utm_campaign ?? base.utm_campaign,
            ...(fromQuery.utm_content
                ? { utm_content: fromQuery.utm_content }
                : {})
        }
    }
    return utmPreset(fallbackChannel)
}
