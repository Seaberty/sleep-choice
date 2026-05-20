"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { trackGa4Event } from "@/lib/analytics"
import { cn } from "@/lib/utils"

type Props = {
    code: string
    brand: string
    slug: string
    className?: string
}

export function DealCouponCopy({ code, brand, slug, className }: Props) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const trimmed = code.trim()
        if (!trimmed) return
        try {
            await navigator.clipboard.writeText(trimmed)
            setCopied(true)
            trackGa4Event("deal_copy_coupon", {
                item_id: slug,
                coupon_code: trimmed,
                brand
            })
            window.setTimeout(() => setCopied(false), 2000)
        } catch {
            /* ignore */
        }
    }

    return (
        <button
            type="button"
            onClick={handleCopy}
            className={cn(
                "inline-flex items-center gap-2 border-2 border-emerald-600 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-900 hover:bg-emerald-100",
                className
            )}
        >
            {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
            ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
            )}
            {copied ? "Copied" : `Copy code · ${code}`}
        </button>
    )
}
