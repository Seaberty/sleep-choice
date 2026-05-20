"use client"

import { useMemo, useState } from "react"
import type { ProductData } from "@/types/product"
import { outboundDealLink } from "@/lib/go-redirect"
import { OutboundDealLink } from "@/components/outbound-deal-link"
import {
    effectiveSavingsPercent,
    formatShelfPriceUsd
} from "@/lib/deals-utils"
import { StockBar } from "@/app/deals/stock-bar"
import {
    ArrowUpRight,
    TrendingDown,
    BarChart,
    Target,
    Filter
} from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
    products: ProductData[]
}

export function DealsVault({ products }: Props) {
    const [brand, setBrand] = useState<string>("all")
    const [minDiscount, setMinDiscount] = useState<number>(0)
    const [sort, setSort] = useState<"score" | "discount" | "price-asc">(
        "score"
    )

    const brands = useMemo(() => {
        const s = new Set(products.map((p) => p.brand).filter(Boolean))
        return [...s].sort((a, b) => a.localeCompare(b))
    }, [products])

    const filtered = useMemo(() => {
        let list = [...products]
        if (brand !== "all") list = list.filter((p) => p.brand === brand)
        if (minDiscount > 0) {
            list = list.filter((p) => {
                const o = p.offers?.[0]
                if (!o) return false
                const e = effectiveSavingsPercent(o)
                return e != null && e >= minDiscount
            })
        }
        if (sort === "discount") {
            list.sort((a, b) => {
                const oa = a.offers?.[0]
                const ob = b.offers?.[0]
                if (!oa || !ob) return 0
                return (
                    (effectiveSavingsPercent(ob) ?? -1) -
                    (effectiveSavingsPercent(oa) ?? -1)
                )
            })
        } else if (sort === "price-asc") {
            list.sort(
                (a, b) =>
                    (a.offers?.[0]?.price ?? 0) - (b.offers?.[0]?.price ?? 0)
            )
        }
        return list
    }, [products, brand, minDiscount, sort])

    if (products.length === 0) {
        return (
            <div className="col-span-full py-40 text-center border-4 border-dashed border-slate-100">
                <p className="font-mono text-[11px] font-black text-slate-300 uppercase tracking-[0.6em] animate-pulse">
                    [ Querying_Liquidation_Databases... ]
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-10">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 border-b border-slate-100 pb-8">
                <div className="flex items-center gap-2 text-slate-950">
                    <Filter className="w-4 h-4 text-emerald-600" />
                    <span className="text-[11px] font-black uppercase tracking-[0.3em]">
                        Vault_Filters
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <label className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            Brand
                        </span>
                        <select
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                            className="border-2 border-slate-950 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wide focus:border-emerald-500 focus:outline-none min-w-[140px]"
                        >
                            <option value="all">All brands</option>
                            {brands.map((b) => (
                                <option key={b} value={b}>
                                    {b}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            Min discount
                        </span>
                        <select
                            value={minDiscount}
                            onChange={(e) =>
                                setMinDiscount(Number(e.target.value))
                            }
                            className="border-2 border-slate-950 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wide focus:border-emerald-500 focus:outline-none min-w-[140px]"
                        >
                            <option value={0}>Any</option>
                            <option value={5}>≥ 5%</option>
                            <option value={10}>≥ 10%</option>
                            <option value={15}>≥ 15%</option>
                            <option value={20}>≥ 20%</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            Sort
                        </span>
                        <select
                            value={sort}
                            onChange={(e) =>
                                setSort(e.target.value as typeof sort)
                            }
                            className="border-2 border-slate-950 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wide focus:border-emerald-500 focus:outline-none min-w-[160px]"
                        >
                            <option value="score">Registry order</option>
                            <option value="discount">Discount (high)</option>
                            <option value="price-asc">Price (low)</option>
                        </select>
                    </label>
                </div>
            </div>

            <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                Showing {filtered.length} of {products.length} listings
            </p>

            <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-10">
                {filtered.length === 0 ? (
                    <div className="col-span-full py-24 text-center border-4 border-dashed border-slate-100">
                        <p className="font-mono text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">
                            [ No matches — adjust filters ]
                        </p>
                    </div>
                ) : (
                    filtered.map((p) => {
                        const offer = p.offers[0]
                        const effPct = effectiveSavingsPercent(offer)
                        const showSavingsUi =
                            effPct != null && effPct > 0
                        const savingsAmount =
                            offer.savingsAmount ??
                            (typeof offer.oldPrice === "number" &&
                            typeof offer.price === "number" &&
                            offer.oldPrice > offer.price
                                ? offer.oldPrice - offer.price
                                : 0)

                        const dealHref = outboundDealLink(
                            p.slug,
                            p.brand,
                            offer.url
                        )

                        return (
                            <OutboundDealLink
                                key={p.id}
                                href={dealHref}
                                loadingVariant="overlay"
                                rel="nofollow noopener noreferrer"
                                className={cn(
                                    "group relative flex min-w-0 flex-col overflow-hidden bg-white border-2 border-slate-950 outline-none transition-all duration-500",
                                    "hover:-translate-y-2 hover:shadow-[16px_16px_0px_0px_rgba(16,185,129,0.1)]",
                                    "focus-within:border-emerald-500 focus-within:ring-8 focus-within:ring-emerald-500/5 focus-within:shadow-[24px_24px_0px_0px_rgba(16,185,129,0.15)]"
                                )}
                            >
                                <div className="absolute inset-0 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-300 overflow-hidden">
                                    <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_40px,rgba(16,185,129,0.02)_40px,rgba(16,185,129,0.02)_41px)]" />
                                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-[scan_4s_linear_infinite]" />
                                </div>

                                {showSavingsUi && (
                                    <div className="absolute right-2 top-2 z-20 rotate-2 bg-emerald-500 px-2 py-1 font-mono text-[10px] font-black text-white shadow-lg transition-all group-focus-within:rotate-0 group-focus-within:scale-105 sm:right-3 sm:top-3 sm:px-4 sm:py-2 sm:text-xs">
                                        SAVE_{effPct}%
                                    </div>
                                )}

                                <div className="relative z-10 flex-grow p-4 sm:p-6 md:p-8">
                                    <div className="mb-6 sm:mb-8">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                                            <BarChart className="w-3 h-3 text-emerald-500 shrink-0 group-focus-within:animate-pulse" />
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic group-focus-within:text-emerald-600 transition-colors">
                                                {p.brand}
                                            </span>
                                            {offer.site?.trim() &&
                                                offer.site.trim().toLowerCase() !==
                                                    (p.brand ?? "")
                                                        .trim()
                                                        .toLowerCase() && (
                                                    <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-tight">
                                                        · {offer.site.trim()}
                                                    </span>
                                                )}
                                        </div>
                                        <h3 className="break-words text-xl font-[1000] uppercase leading-[0.95] tracking-tighter text-slate-950 transition-all group-hover:text-emerald-600 group-focus-within:text-emerald-600 sm:text-2xl md:text-3xl md:leading-[0.85]">
                                            {p.name}
                                        </h3>
                                        {p.audit_data?.audit_variant ? (
                                            <p className="mt-2 text-[9px] font-mono font-bold text-slate-500 uppercase tracking-[0.25em]">
                                                AUDIT_VARIANT:{" "}
                                                {p.audit_data.audit_variant
                                                    .trim()
                                                    .replace(/\s+/g, "_")}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="mb-6 flex flex-wrap items-end gap-2 sm:mb-8 sm:gap-3">
                                        <div className="min-w-0 font-mono text-2xl font-bold tabular-nums leading-none tracking-tighter text-slate-950 sm:text-4xl md:text-5xl">
                                            {formatShelfPriceUsd(
                                                Number(offer.price)
                                            )}
                                        </div>
                                        {offer.oldPrice ? (
                                            <div className="mb-0.5 text-base font-bold italic leading-none text-slate-200 line-through decoration-emerald-500/50 sm:text-lg">
                                                {formatShelfPriceUsd(
                                                    Number(offer.oldPrice)
                                                )}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="mb-6 border-l-4 border-slate-950 bg-slate-50 p-4 transition-colors group-focus-within:border-emerald-500 sm:mb-8 sm:p-5">
                                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            {showSavingsUi ? (
                                                <>
                                                    <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase">
                                                        <TrendingDown className="w-3.5 h-3.5" />
                                                        Price_Drop:{" "}
                                                        {typeof savingsAmount ===
                                                            "number" &&
                                                        savingsAmount > 0
                                                            ? "-" +
                                                              formatShelfPriceUsd(
                                                                  savingsAmount
                                                              )
                                                            : null}
                                                    </div>
                                                    <div className="text-[8px] font-mono font-bold text-slate-300 uppercase tracking-tighter">
                                                        Audit_ID:{" "}
                                                        {p.id.slice(0, 8)}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="ml-auto text-[8px] font-mono font-bold text-slate-300 uppercase tracking-tighter">
                                                    Audit_ID:{" "}
                                                    {p.id.slice(0, 8)}
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-bold uppercase leading-snug italic text-slate-600 sm:leading-tight">
                                            &quot;
                                            {offer.promo_text ||
                                                "Automated audit suggests this is a 6-month historical low."}
                                            &quot;
                                        </p>
                                    </div>

                                    <StockBar
                                        productId={p.id}
                                        availability={offer.availability}
                                        promoText={offer.promo_text}
                                    />
                                </div>

                                <div className="flex h-0 items-center justify-between px-4 pb-4 opacity-0 transition-all duration-300 group-focus-within:h-auto group-focus-within:min-h-[2.5rem] group-focus-within:opacity-100 sm:px-8">
                                    <div className="flex items-center gap-2">
                                        <Target className="w-4 h-4 text-emerald-500 animate-spin-slow" />
                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest underline decoration-2 underline-offset-4">
                                            Target_Locked
                                        </span>
                                    </div>
                                    <div className="text-[9px] font-mono text-slate-400 font-bold uppercase">
                                        Ready_To_Export
                                    </div>
                                </div>

                                <div
                                    className={cn(
                                        "mt-auto flex w-full min-w-0 flex-col items-stretch justify-center gap-2 p-4 font-black uppercase tracking-[0.12em] text-white transition-all sm:flex-row sm:items-center sm:justify-between sm:p-6 sm:tracking-[0.2em]",
                                        "bg-slate-950 text-[10px] sm:text-[11px]",
                                        "group-hover:bg-emerald-600 group-focus-within:bg-emerald-500"
                                    )}
                                >
                                    <span className="text-center sm:text-left">
                                        EXECUTE_PURCHASE_SEQUENCE
                                    </span>
                                    <ArrowUpRight className="mx-auto h-5 w-5 shrink-0 transition-transform duration-300 group-hover:rotate-45 group-focus-within:rotate-45 sm:mx-0" />
                                </div>
                            </OutboundDealLink>
                        )
                    })
                )}
            </div>
        </div>
    )
}
