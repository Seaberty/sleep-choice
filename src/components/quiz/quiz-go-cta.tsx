"use client"

import { OutboundDealLink } from "@/components/outbound-deal-link"
import { outboundDealLink } from "@/lib/go-redirect"
import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
    slug: string
    brand: string
    label: string
    priceLabel?: string
    rank: number
}

export function QuizGoCta({
    slug,
    brand,
    label,
    priceLabel,
    rank
}: Props) {
    const href = outboundDealLink(slug, brand, "#")

    return (
        <OutboundDealLink
            href={href}
            loadingVariant="inline"
            className={cn(
                "flex w-full min-w-0 flex-col gap-1 rounded-none border-2 border-slate-950 bg-slate-950 px-4 py-3.5 text-white transition-colors hover:bg-blue-600 hover:border-blue-600 sm:flex-row sm:items-center sm:justify-between",
                rank === 1 && "ring-2 ring-blue-600/30"
            )}
        >
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                {label}
            </span>
            <span className="flex items-center gap-2 font-mono text-sm font-bold tabular-nums">
                {priceLabel ?? "Open gateway"}
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
            </span>
        </OutboundDealLink>
    )
}
