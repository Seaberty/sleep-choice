// lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Next.js Image 优化器会按 URL 长期缓存远程图（见 `next.config` 的 `minimumCacheTTL`）。
 * Supabase Storage 同路径覆盖文件后，URL 不变仍会显示旧图；附加版本参数使缓存失效。
 */
export function withImageCacheBust(
    url: string | null | undefined,
    versionKey?: string | null
): string {
    if (!url || typeof url !== "string") return ""
    const t = url.trim()
    if (!t || t.startsWith("/") || t.startsWith("data:")) return t
    if (!versionKey || !String(versionKey).trim()) return t
    const v = encodeURIComponent(String(versionKey).trim()).slice(0, 120)
    if (!v) return t
    const sep = t.includes("?") ? "&" : "?"
    return `${t}${sep}sc_rev=${v}`
}
