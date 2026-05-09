import { Suspense } from "react"
import type { Metadata } from "next"
import { getProductsForCompare } from "@/lib/registry"
import { parseCompareSlugsFromSearchParam } from "@/lib/compare-constants"
import { ComparePageClient } from "./compare-page-client"

export const metadata: Metadata = {
    title: "Forensic Compare Matrix",
    description:
        "Side-by-side SleepChoice audit scores and specification keys for registry-indexed products.",
    alternates: { canonical: "/compare" }
}

export default async function ComparePage({
    searchParams
}: {
    searchParams: Promise<{ slugs?: string }>
}) {
    const sp = await searchParams
    const slugs = parseCompareSlugsFromSearchParam(sp.slugs)
    const products =
        slugs.length >= 2 ? await getProductsForCompare(slugs) : []

    return (
        <main className="min-h-screen bg-white pt-28 pb-32 md:pt-36 md:pb-40">
            <div className="container mx-auto px-6 max-w-7xl">
                <Suspense
                    fallback={
                        <div className="font-mono text-[10px] font-black uppercase tracking-widest text-slate-400 py-20 text-center">
                            Loading matrix…
                        </div>
                    }
                >
                    <ComparePageClient
                        initialSlugs={slugs}
                        products={products}
                    />
                </Suspense>
            </div>
        </main>
    )
}
