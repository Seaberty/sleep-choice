"use client"

import { useMemo, useState } from "react"
import type { ProductData } from "@/types/product"
import { outboundDealLink } from "@/lib/go-redirect"
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

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
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
                            <a
                                key={p.id}
                                href={dealHref}
                                target="_blank"
                                rel="nofollow noopener noreferrer"
                                className={cn(
                                    "group relative flex flex-col bg-white border-2 border-slate-950 outline-none transition-all duration-500",
                                    "hover:-translate-y-2 hover:shadow-[16px_16px_0px_0px_rgba(16,185,129,0.1)]",
                                    "focus-within:border-emerald-500 focus-within:ring-8 focus-within:ring-emerald-500/5 focus-within:shadow-[24px_24px_0px_0px_rgba(16,185,129,0.15)]"
                                )}
                            >
                                <div className="absolute inset-0 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-300 overflow-hidden">
                                    <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_40px,rgba(16,185,129,0.02)_40px,rgba(16,185,129,0.02)_41px)]" />
                                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-[scan_4s_linear_infinite]" />
                                </div>

                                {showSavingsUi && (
                                    <div className="absolute -top-3 -right-3 bg-emerald-500 text-white font-mono font-black text-xs px-4 py-2 rotate-3 z-20 shadow-lg group-focus-within:rotate-0 group-focus-within:scale-110 transition-all">
                                        SAVE_{effPct}%
                                    </div>
                                )}

                                <div className="p-8 flex-grow relative z-10">
                                    <div className="mb-8">
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
                                        <h3 className="text-3xl font-[1000] uppercase tracking-tighter text-slate-950 leading-[0.85] group-hover:text-emerald-600 group-focus-within:text-emerald-600 transition-all">
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

                                    <div className="flex items-end gap-3 mb-8">
                                        <div className="text-5xl font-mono font-bold tracking-tighter text-slate-950 tabular-nums leading-none">
                                            {formatShelfPriceUsd(
                                                Number(offer.price)
                                            )}
                                        </div>
                                        {offer.oldPrice ? (
                                            <div className="text-lg font-bold text-slate-200 line-through mb-1 italic decoration-emerald-500/50">
                                                {formatShelfPriceUsd(
                                                    Number(offer.oldPrice)
                                                )}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="bg-slate-50 border-l-4 border-slate-950 group-focus-within:border-emerald-500 p-5 mb-8 transition-colors">
                                        <div className="flex items-center justify-between mb-3">
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
                                        <p className="text-[10px] font-bold text-slate-600 uppercase leading-tight italic">
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

                                <div className="px-8 pb-4 h-0 group-focus-within:h-10 opacity-0 group-focus-within:opacity-100 transition-all duration-300 flex items-center justify-between">
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
                                        "mt-auto flex items-center justify-between w-full p-6 text-white font-black uppercase tracking-[0.2em] text-[11px] transition-all",
                                        "bg-slate-950 group-hover:bg-emerald-600 group-focus-within:bg-emerald-500"
                                    )}
                                >
                                    EXECUTE_PURCHASE_SEQUENCE
                                    <ArrowUpRight className="w-5 h-5 group-hover:rotate-45 group-focus-within:rotate-45 transition-transform duration-300" />
                                </div>
                            </a>
                        )
                    })
                )}
            </div>
        </div>
    )
}
