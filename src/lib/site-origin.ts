/** Canonical site origin for metadata, sitemap, robots (no trailing slash). */
export const SITE_ORIGIN =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://sleepchoiceguide.com"
