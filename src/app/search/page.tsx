import type { Metadata } from "next"
import { redirect } from "next/navigation"

/** 中间跳转页：避免收录重复入口 */
export const metadata: Metadata = {
    robots: { index: false, follow: true }
}

type Props = {
    searchParams: Promise<{ q?: string }>
}

/** Legacy / generic ?q= entry; canonical product search lives on /registry. */
export default async function SearchRedirect({ searchParams }: Props) {
    const sp = await searchParams
    const raw = typeof sp.q === "string" ? sp.q.trim() : ""
    const dest = raw
        ? `/registry?q=${encodeURIComponent(raw)}`
        : "/registry"
    redirect(dest)
}
