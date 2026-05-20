"use client"

import React, { useState } from "react"
import { RegistryDetailLink } from "@/components/registry-detail-link"
import {
    ExternalLink,
    Activity,
    ShieldCheck,
    Clock,
    Zap,
    BadgeCheck,
    TrendingUp
} from "lucide-react"
import Image from "next/image"
import { cn, withImageCacheBust } from "@/lib/utils"
import { ProductData } from "@/types/product"
import { AddToCompareButton } from "@/components/compare/add-to-compare-button"
import { outboundDealLink } from "@/lib/go-redirect"
import { OutboundDealLink } from "@/components/outbound-deal-link"
import { formatShelfPriceUsd } from "@/lib/deals-utils"

export function ProductCard({
    data,
    className
}: {
    data: ProductData
    className?: string
    }) {
    const [imageError, setImageError] = useState(false)
    const detailUrl = `/registry/${data.slug}`
    const primaryOffer = data.offers?.find((o) => o.primary) ||
        data.offers?.[0] || { price: 0, url: "#", site: "Store" }
    const displayPrice = data.price || primaryOffer.price || 0
    const overallScore = Number(
        data.audit_scores?.overall || data.rating || 0
    ).toFixed(1)

    return (
        <div
            className={cn(
                "group relative bg-white border border-slate-200 rounded-3xl sm:rounded-[2rem] flex flex-col h-full min-w-0 transition-all duration-500",
                // 高级悬浮特效：深度阴影 + 向上平移 + 蓝色边框微光
                "hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.12)] md:hover:-translate-y-2 hover:border-blue-500/30",
                className
            )}
        >
            {/* --- 顶部标识层：左侧限宽避免与分数角标重叠 --- */}
            <div className="absolute top-3 left-3 right-3 z-20 flex justify-between items-start gap-3 pointer-events-none sm:top-4 sm:left-4 sm:right-4">
                <div className="flex min-w-0 max-w-[calc(100%-4.5rem)] flex-col gap-1.5">
                    {data.tag && (
                        <div className="bg-blue-600 text-white text-[8px] sm:text-[9px] font-black uppercase px-2 py-0.5 sm:px-2.5 sm:py-1 rounded shadow-lg flex w-fit max-w-full items-center gap-1 tracking-widest leading-none">
                            <Zap className="w-2.5 h-2.5 shrink-0 fill-white" />
                            <span className="truncate">{data.tag}</span>
                        </div>
                    )}
                    <div className="bg-slate-900/90 backdrop-blur-md text-white text-[7px] sm:text-[8px] font-mono px-1.5 py-0.5 sm:px-2 rounded flex w-fit max-w-full items-center gap-1 shadow-sm">
                        <span className="w-1 h-1 shrink-0 bg-blue-400 rounded-full animate-pulse" />
                        <span className="truncate">
                            LOG:{data.id.split("-")[0].toUpperCase()}
                        </span>
                    </div>
                </div>

                {/* RTINGS 分数徽章：增加悬浮时的色彩切换 */}
                <div className="bg-white border-2 border-slate-950 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl shadow-xl flex flex-col items-center justify-center pointer-events-auto shrink-0 transition-transform group-hover:scale-110 group-hover:border-blue-600">
                    <span className="text-[7px] font-black text-slate-400 leading-none mb-0.5 transition-colors group-hover:text-blue-600">
                        SCORE
                    </span>
                    <span className="text-xl font-[1000] text-slate-950 italic leading-none">
                        {overallScore}
                    </span>
                </div>
            </div>

            {/* --- 图片区：改用 16:9 比例压低重心 --- */}
            <RegistryDetailLink
                href={detailUrl}
                className="relative w-full aspect-video bg-slate-50/50 overflow-hidden block shrink-0 border-b border-slate-50"
            >
                {data.image_url && !imageError ? (
                    <Image
                        // 关键点 1: 对 URL 进行编码，处理 & 等特殊字符
                        src={
                            withImageCacheBust(
                                data.image_url || "/placeholder-product.png",
                                data.last_audited_at
                            ) || "/placeholder-product.png"
                        }
                        alt={data.name || "Product Image"}
                        // 关键点 2: 使用 fill 模式填充父容器
                        fill
                        // 关键点 3: 设置 sizes 优化性能并防止警告
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-contain p-4 sm:p-8 transition-transform duration-1000 ease-out group-hover:scale-110"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-10">
                        <Activity className="w-12 h-12 text-slate-900" />
                    </div>
                )}
                {/* 实验室对焦线：悬浮时变为蓝色 */}
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end opacity-20 transition-colors group-hover:text-blue-600">
                    <div className="h-4 w-4 border-l border-b border-current" />
                    <div className="h-4 w-4 border-r border-b border-current" />
                </div>
            </RegistryDetailLink>

            {/* --- 内容核心区 --- */}
            <div className="flex min-w-0 grow flex-col p-4 sm:p-7">
                {/* 标题：小屏略小字号，避免长型号溢出 */}
                <div className="mb-4 min-h-0 sm:min-h-[5.25rem]">
                    <div className="mb-2 flex items-center gap-2 text-blue-600 font-black text-[9px] sm:text-[10px] uppercase tracking-[0.2em] italic">
                        <TrendingUp className="w-3 h-3 shrink-0 transition-transform group-hover:translate-x-1" />
                        <span className="truncate">{data.brand}</span>
                    </div>
                    <RegistryDetailLink href={detailUrl} className="block min-w-0">
                        <h3 className="line-clamp-2 text-lg font-[1000] uppercase italic leading-[1.08] tracking-[-0.03em] text-slate-900 transition-colors group-hover:text-blue-600 sm:text-xl md:text-2xl">
                            {data.name || data.model}
                        </h3>
                    </RegistryDetailLink>
                </div>

                {/* --- 性能矩阵：悬浮变蓝特效 --- */}
                <div className="mb-6 grid grid-cols-3 gap-2 py-4 sm:gap-6 sm:py-5 border-y border-slate-100">
                    {["support", "cooling", "pressure"].map((key) => {
                        const val = Number(
                            data.audit_scores?.[
                                key as keyof typeof data.audit_scores
                            ] || 0
                        )
                        return (
                            <div key={key} className="flex min-w-0 flex-col gap-1">
                                <span className="truncate text-[7px] font-black uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-600 sm:text-[8px] sm:tracking-widest">
                                    {key}
                                </span>
                                <div className="flex items-baseline gap-0.5">
                                    <span className="text-base font-[1000] italic leading-none text-slate-950 transition-colors group-hover:text-blue-600 sm:text-lg md:text-xl">
                                        {val > 0 ? val.toFixed(1) : "N/A"}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-300">
                                        /10
                                    </span>
                                </div>
                                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden mt-1">
                                    <div
                                        className="h-full bg-slate-950 transition-all duration-1000 group-hover:bg-blue-600 group-hover:shadow-[0_0_8px_rgba(37,99,235,0.6)]"
                                        style={{ width: `${val * 10}%` }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* --- 权威优点 --- */}
                <div className="mb-8 space-y-2.5">
                    {data.pros?.slice(0, 2).map((pro, i) => (
                        <div
                            key={i}
                            className="group/line flex items-start gap-2.5"
                        >
                            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500 transition-transform group-hover/line:scale-110" />
                            <span className="min-w-0 break-words text-[10px] font-[800] uppercase tracking-tight text-slate-700 transition-colors group-hover:text-slate-900 sm:text-[11px]">
                                {pro}
                            </span>
                        </div>
                    ))}
                </div>

                {/* --- 转化底座 --- */}
                <div className="mt-auto pt-6 border-t border-slate-50">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            <Clock className="w-3 h-3" />
                            UPDATED: JAN 2026
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            <AddToCompareButton
                                slug={data.slug}
                                productTitle={
                                    data.name || data.model || data.slug
                                }
                                variant="compact"
                            />
                            <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-black tracking-tighter">
                                <BadgeCheck className="w-3 h-3" />{" "}
                                VERIFIED_DATA
                            </div>
                        </div>
                    </div>

                    <OutboundDealLink
                        href={outboundDealLink(
                            data.slug,
                            data.brand,
                            primaryOffer.url
                        )}
                        loadingVariant="overlay"
                        className="group/btn relative flex w-full min-w-0 flex-col gap-2 rounded-2xl bg-slate-950 p-2 text-white shadow-xl transition-all duration-500 hover:bg-blue-600 hover:shadow-blue-500/40 sm:flex-row sm:items-stretch sm:justify-between sm:gap-0"
                    >
                        <div className="min-w-0 px-3 py-1.5 sm:pl-4">
                            <div className="mb-0.5 truncate text-[8px] font-bold uppercase tracking-[0.1em] opacity-50 sm:text-[9px]">
                                {primaryOffer.site} DEAL
                            </div>
                            <div className="text-xl font-[1000] italic leading-none tracking-tighter tabular-nums sm:text-2xl">
                                {displayPrice > 0
                                    ? formatShelfPriceUsd(Number(displayPrice))
                                    : "CHECK PRICE"}
                            </div>
                        </div>
                        <div className="flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 font-black text-[9px] uppercase tracking-[0.15em] backdrop-blur-md transition-all group-hover/btn:bg-white/20 sm:min-h-[3.5rem] sm:px-5 sm:text-[11px] sm:tracking-[0.2em]">
                            <span className="truncate text-center">
                                {primaryOffer.promo || "LATEST_DEAL"}
                            </span>
                            <ExternalLink className="h-4 w-4 shrink-0 transition-transform group-hover/btn:translate-x-1" />
                        </div>
                    </OutboundDealLink>
                </div>
            </div>
        </div>
    )
}
