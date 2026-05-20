/**
 * GA4 转化事件（gtag）。仅在浏览器、且 gtag 已加载时上报。
 */

export type Ga4ConversionEvent =
    | "quiz_complete"
    | "quiz_email_capture"
    | "compare_add"
    | "go_click"
    | "deal_copy_coupon"

export type GaEventParams = Record<
    string,
    string | number | boolean | undefined
>

declare global {
    interface Window {
        gtag?: (
            command: "event" | "config" | "js",
            targetId: string | Date,
            params?: Record<string, unknown>
        ) => void
    }
}

export function trackGa4Event(
    event: Ga4ConversionEvent | string,
    params?: GaEventParams
): void {
    if (typeof window === "undefined") return
    const gtag = window.gtag
    if (typeof gtag !== "function") return

    const clean: Record<string, string | number | boolean> = {}
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== "") clean[k] = v as string | number | boolean
        }
    }
    gtag("event", event, clean)
}

/** `/go/` 或 go 子域出站链 */
export function isTrackableGoHref(href: string): boolean {
    if (!href?.trim()) return false
    try {
        const base =
            typeof window !== "undefined"
                ? window.location.origin
                : "https://sleepchoiceguide.com"
        const u = new URL(href, base)
        return /^\/go\/[\w-]+/.test(u.pathname)
    } catch {
        return false
    }
}

export function slugFromGoHref(href: string): string | undefined {
    try {
        const base =
            typeof window !== "undefined"
                ? window.location.origin
                : "https://sleepchoiceguide.com"
        const m = new URL(href, base).pathname.match(/^\/go\/([\w-]+)/)
        return m?.[1]
    } catch {
        return undefined
    }
}
