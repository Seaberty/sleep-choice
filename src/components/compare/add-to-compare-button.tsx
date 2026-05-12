"use client"

import * as React from "react"
import Link from "next/link"
import { Columns2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    COMPARE_UPDATE_EVENT,
    MAX_COMPARE_ITEMS
} from "@/lib/compare-constants"
import {
    addCompareSlug,
    compareHref,
    getCompareSlugs
} from "@/components/compare/compare-storage"

type Props = {
    slug: string
    productTitle: string
    /** compact for ProductCard */
    variant?: "default" | "compact"
}

export function AddToCompareButton({
    slug,
    productTitle,
    variant = "default"
}: Props) {
    const [mounted, setMounted] = React.useState(false)
    const [inList, setInList] = React.useState(false)
    const [atMax, setAtMax] = React.useState(false)

    const refresh = React.useCallback(() => {
        const cur = getCompareSlugs()
        setInList(cur.includes(slug.trim()))
        setAtMax(cur.length >= MAX_COMPARE_ITEMS && !cur.includes(slug.trim()))
    }, [slug])

    React.useEffect(() => {
        setMounted(true)
        refresh()
    }, [refresh])

    React.useEffect(() => {
        const onUpdate = () => refresh()
        window.addEventListener(COMPARE_UPDATE_EVENT, onUpdate)
        return () => window.removeEventListener(COMPARE_UPDATE_EVENT, onUpdate)
    }, [refresh])

    if (!mounted) {
        return (
            <div
                className={cn(
                    "rounded-xl bg-slate-100 animate-pulse border border-slate-200",
                    variant === "compact" ? "h-8 w-28" : "h-10 w-44"
                )}
            />
        )
    }

    const handleClick = () => {
        const r = addCompareSlug(slug)
        refresh()
        if (!r.ok && r.reason === "max") {
            /* optional: toast */
        }
    }

    if (inList) {
        const label =
            variant === "compact" ? "In compare" : "In compare matrix"
        return (
            <div
                className={cn(
                    "flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-black uppercase tracking-widest",
                    variant === "compact"
                        ? "text-[8px] px-2 py-1"
                        : "text-[9px] px-4 py-2.5"
                )}
                title={productTitle}
            >
                <Check className={variant === "compact" ? "w-3 h-3" : "w-3.5 h-3.5"} />
                {label}
                <Link
                    href={compareHref(getCompareSlugs())}
                    className="text-blue-700 underline-offset-2 hover:underline ml-1"
                >
                    Open
                </Link>
            </div>
        )
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={atMax}
            title={
                atMax
                    ? `Compare matrix full (${MAX_COMPARE_ITEMS}). Remove one on the compare page.`
                    : `Add ${productTitle} to forensic compare matrix`
            }
            className={cn(
                "flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border font-black uppercase tracking-widest transition-colors",
                variant === "compact"
                    ? "text-[8px] px-2 py-1 border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
                    : "text-[9px] px-4 py-2.5 border-slate-950 bg-white text-slate-950 hover:bg-blue-600 hover:text-white hover:border-blue-600 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-950",
                atMax && "cursor-not-allowed opacity-50"
            )}
        >
            <Columns2 className={variant === "compact" ? "w-3 h-3" : "w-3.5 h-3.5"} />
            {variant === "compact" ? "Compare" : "Add to compare matrix"}
        </button>
    )
}
