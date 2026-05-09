"use client"

import * as React from "react"
import Link from "next/link"
import { Columns2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    COMPARE_UPDATE_EVENT,
    MAX_COMPARE_ITEMS
} from "@/lib/compare-constants"
import {
    compareHref,
    getCompareSlugs,
    setCompareSlugs
} from "@/components/compare/compare-storage"

export function CompareDock() {
    const [mounted, setMounted] = React.useState(false)
    const [slugs, setSlugs] = React.useState<string[]>([])

    const refresh = React.useCallback(() => {
        setSlugs(getCompareSlugs())
    }, [])

    React.useEffect(() => {
        setMounted(true)
        refresh()
    }, [refresh])

    React.useEffect(() => {
        const onUp = () => refresh()
        window.addEventListener(COMPARE_UPDATE_EVENT, onUp)
        window.addEventListener("storage", onUp)
        return () => {
            window.removeEventListener(COMPARE_UPDATE_EVENT, onUp)
            window.removeEventListener("storage", onUp)
        }
    }, [refresh])

    if (!mounted || slugs.length === 0) return null

    return (
        <div
            className={cn(
                "fixed bottom-4 left-1/2 z-[95] flex max-w-[min(100vw-2rem,520px)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur-md",
                "font-mono text-[10px] font-black uppercase tracking-widest text-slate-800"
            )}
        >
            <Columns2 className="h-4 w-4 shrink-0 text-blue-600" />
            <span className="text-slate-500">
                Compare ({slugs.length}/{MAX_COMPARE_ITEMS})
            </span>
            <Link
                href={compareHref(slugs)}
                className="rounded-lg bg-slate-950 px-4 py-2 text-white transition-colors hover:bg-blue-600"
            >
                Open matrix
            </Link>
            <button
                type="button"
                onClick={() => {
                    setCompareSlugs([])
                }}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-slate-500 hover:bg-slate-50"
                title="Clear compare list"
            >
                <X className="h-3.5 w-3.5" />
                Clear
            </button>
        </div>
    )
}
