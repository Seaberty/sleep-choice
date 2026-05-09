"use client"

import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    isInStockAvailability,
    isVolatilePromo,
    stablePick
} from "@/lib/deals-utils"

type Props = {
    productId: string
    availability: string | null | undefined
    promoText: string | undefined
}

/**
 * 库存条：紧迫 promo → 橙条低水位；IN_STOCK → 绿条 75–95%；无 availability → AUDIT_PENDING。
 */
export function StockBar({ productId, availability, promoText }: Props) {
    const avRaw = availability?.trim() ?? ""
    const volatile = isVolatilePromo(promoText)

    if (!avRaw) {
        return (
            <div className="mb-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono">
                    AUDIT_PENDING
                </p>
            </div>
        )
    }

    if (volatile) {
        const w = 5 + stablePick(`${productId}:volatile`, 15)
        return (
            <div className="flex items-center gap-4 mb-2">
                <div className="flex-grow h-1 bg-slate-100 overflow-hidden rounded-full">
                    <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-500"
                        style={{ width: `${w}%` }}
                    />
                </div>
                <span className="text-[9px] font-black uppercase text-amber-600 whitespace-nowrap flex items-center gap-1 font-mono tracking-tight">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    STOCK_LEVEL: VOLATILE
                </span>
            </div>
        )
    }

    if (isInStockAvailability(avRaw)) {
        const w = 75 + stablePick(`${productId}:secure`, 21)
        return (
            <div className="flex items-center gap-4 mb-2">
                <div className="flex-grow h-1 bg-slate-100 overflow-hidden rounded-full">
                    <div
                        className={cn(
                            "h-full rounded-full bg-emerald-500 transition-all duration-500",
                            "group-focus-within:bg-emerald-600"
                        )}
                        style={{ width: `${w}%` }}
                    />
                </div>
                <span className="text-[9px] font-black uppercase text-emerald-600 whitespace-nowrap font-mono tracking-tight">
                    AVAILABILITY: SECURE
                </span>
            </div>
        )
    }

    const wMid = 25 + stablePick(`${productId}:other`, 40)
    return (
        <div className="flex items-center gap-4 mb-2">
            <div className="flex-grow h-1 bg-slate-100 overflow-hidden rounded-full">
                <div
                    className="h-full rounded-full bg-slate-400/70 transition-all"
                    style={{ width: `${wMid}%` }}
                />
            </div>
            <span className="text-[9px] font-black uppercase text-slate-500 whitespace-nowrap font-mono tracking-tight max-w-[50%] truncate">
                {avRaw.toUpperCase().replace(/\s+/g, "_")}
            </span>
        </div>
    )
}
