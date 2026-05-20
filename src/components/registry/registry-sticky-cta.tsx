"use client"

import { useEffect, useState } from "react"
import { OutboundDealLink } from "@/components/outbound-deal-link"
import { formatShelfPriceUsd } from "@/lib/deals-utils"
import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
    href: string
    brand: string
    model: string
    price: number
}

export function RegistryStickyCta({
    href,
    brand,
    model,
    price
}: Props) {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const onScroll = () => {
            setVisible(window.scrollY > 480)
        }
        onScroll()
        window.addEventListener("scroll", onScroll, { passive: true })
        return () => window.removeEventListener("scroll", onScroll)
    }, [])

    const priceLabel =
        price > 0 ? formatShelfPriceUsd(price) : "Check price"

    return (
        <div
            role="region"
            aria-label="Deal actions"
            className={cn(
                "fixed bottom-0 left-0 right-0 z-40 border-t-4 border-slate-950 bg-white/95 backdrop-blur-md shadow-[0_-12px_40px_rgba(0,0,0,0.08)] transition-transform duration-300 md:hidden",
                visible ? "translate-y-0" : "translate-y-full pointer-events-none"
            )}
        >
            <div className="container mx-auto flex items-center gap-3 px-4 py-3 sm:px-6">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[9px] font-black uppercase tracking-widest text-blue-600">
                        {brand}
                    </p>
                    <p className="truncate text-xs font-[1000] uppercase italic text-slate-950">
                        {model}
                    </p>
                </div>
                <OutboundDealLink
                    href={href}
                    loadingVariant="inline"
                    className="shrink-0 flex items-center gap-2 border-2 border-slate-950 bg-blue-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-slate-950"
                >
                    <span>View deal</span>
                    <span className="font-mono tabular-nums">{priceLabel}</span>
                    <ExternalLink className="h-4 w-4" aria-hidden />
                </OutboundDealLink>
            </div>
        </div>
    )
}
