"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import type { ProductData } from "@/types/product"
import { parseCompareSlugsFromSearchParam } from "@/lib/compare-constants"
import {
    compareHref,
    getCompareSlugs,
    setCompareSlugs
} from "@/components/compare/compare-storage"
import { CompareTable } from "@/components/compare/compare-table"

type Props = {
    initialSlugs: string[]
    products: ProductData[]
}

export function ComparePageClient({ initialSlugs, products }: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [awaitingLsRedirect, setAwaitingLsRedirect] = React.useState(
        initialSlugs.length === 0
    )

    React.useEffect(() => {
        const raw = searchParams.get("slugs")
        const fromUrl = parseCompareSlugsFromSearchParam(raw ?? undefined)
        if (fromUrl.length >= 1) {
            setCompareSlugs(fromUrl)
            setAwaitingLsRedirect(false)
            return
        }
        const ls = getCompareSlugs()
        if (ls.length >= 2) {
            router.replace(compareHref(ls))
            return
        }
        setAwaitingLsRedirect(false)
    }, [searchParams, router])

    if (initialSlugs.length >= 2 && products.length >= 2) {
        return (
            <div className="space-y-10">
                <CompareHeader />
                <CompareTable products={products} />
            </div>
        )
    }

    if (awaitingLsRedirect && initialSlugs.length === 0) {
        return (
            <div className="min-h-[40vh] flex items-center justify-center font-mono text-[10px] font-black uppercase tracking-widest text-slate-400">
                Loading matrix…
            </div>
        )
    }

    if (initialSlugs.length < 2) {
        return (
            <section className="max-w-xl mx-auto py-16 px-4 sm:px-6 text-center border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                <CompareHeader />
                <p className="text-sm text-slate-600 mb-8 leading-relaxed">
                    Select at least two audited products. Open any{" "}
                    <Link
                        href="/registry"
                        className="text-blue-600 font-bold underline-offset-2 hover:underline"
                    >
                        registry dossier
                    </Link>{" "}
                    and choose{" "}
                    <span className="font-black text-slate-950">
                        Add to compare matrix
                    </span>
                    , then use{" "}
                    <span className="font-black text-slate-950">
                        Open matrix
                    </span>{" "}
                    on the floating dock.
                </p>
                <Link
                    href="/registry"
                    className="inline-flex items-center rounded-xl bg-slate-950 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-600 transition-colors"
                >
                    Browse registry
                </Link>
            </section>
        )
    }

    if (products.length < 2) {
        return (
            <section className="max-w-xl mx-auto py-16 px-4 sm:px-6 text-center border border-rose-100 rounded-3xl bg-rose-50/40">
                <CompareHeader />
                <p className="text-sm text-slate-600 mb-6">
                    Some slugs may be invalid or removed from the registry.
                    Adjust your selection and try again.
                </p>
                <Link
                    href="/registry"
                    className="text-blue-600 font-bold underline-offset-2 hover:underline"
                >
                    Back to registry
                </Link>
            </section>
        )
    }

    return (
        <div className="space-y-10">
            <CompareHeader />
            <CompareTable products={products} />
        </div>
    )
}

function CompareHeader() {
    return (
        <header className="border-b border-slate-100 pb-8">
            <p className="text-[9px] font-black uppercase tracking-[0.35em] text-blue-600 mb-3">
                Forensic_compare
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-[1000] uppercase italic tracking-tighter text-slate-950">
                Side-by-side matrix
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-slate-600 leading-relaxed">
                Same scoring axes and specification keys as individual audit
                dossiers. Remove columns with the × control; changes sync to your
                compare list.
            </p>
        </header>
    )
}
