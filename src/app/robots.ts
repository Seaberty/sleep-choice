import type { MetadataRoute } from "next"
import { SITE_ORIGIN } from "@/lib/site-origin"

export default function robots(): MetadataRoute.Robots {
    const host = new URL(SITE_ORIGIN).host
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: ["/api/"]
        },
        sitemap: `${SITE_ORIGIN}/sitemap.xml`,
        host
    }
}
