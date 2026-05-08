import { redirect } from "next/navigation"

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
