"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
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
import { formatShelfPriceUsd } from "@/lib/deals-utils"

export function ProductCard({
    data,
    className
}: {
    data: ProductData
    className?: string
    }) {
    const [isMounted, setIsMounted] = useState(false)
    const [imageError, setImageError] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    const detailUrl = `/registry/${data.slug}`
    const primaryOffer = data.offers?.find((o) => o.primary) ||
        data.offers?.[0] || { price: 0, url: "#", site: "Store" }
    const displayPrice = data.price || primaryOffer.price || 0
    const overallScore = Number(
        data.audit_scores?.overall || data.rating || 0
    ).toFixed(1)

    if (!isMounted) {
        return (
            <div
                className={cn(
                    "h-[580px] bg-slate-50/50 rounded-[2rem] animate-pulse border border-slate-100",
                    className
                )}
            />
        )
    }

    return (
        <div
            className={cn(
                "group relative bg-white border border-slate-200 rounded-[2rem] flex flex-col h-full transition-all duration-500",
                // 高级悬浮特效：深度阴影 + 向上平移 + 蓝色边框微光
                "hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.12)] md:hover:-translate-y-2 hover:border-blue-500/30",
                className
            )}
        >
            {/* --- 顶部标识层 --- */}
            <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-start pointer-events-none">
                <div className="flex flex-col gap-1.5">
                    {data.tag && (
                        <div className="bg-blue-600 text-white text-[9px] font-black uppercase px-2.5 py-1 rounded shadow-lg flex items-center gap-1 tracking-widest leading-none">
                            <Zap className="w-2.5 h-2.5 fill-white" />
                            {data.tag}
                        </div>
                    )}
                    <div className="bg-slate-900/90 backdrop-blur-md text-white text-[8px] font-mono px-2 py-0.5 rounded flex items-center gap-1.5 shadow-sm">
                        <span className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" />
                        LOG:{data.id.split("-")[0].toUpperCase()}
                    </div>
                </div>

                {/* RTINGS 分数徽章：增加悬浮时的色彩切换 */}
                <div className="bg-white border-2 border-slate-950 px-2.5 py-1 rounded-xl shadow-xl flex flex-col items-center justify-center pointer-events-auto shrink-0 transition-transform group-hover:scale-110 group-hover:border-blue-600">
                    <span className="text-[7px] font-black text-slate-400 leading-none mb-0.5 transition-colors group-hover:text-blue-600">
                        SCORE
                    </span>
                    <span className="text-xl font-[1000] text-slate-950 italic leading-none">
                        {overallScore}
                    </span>
                </div>
            </div>

            {/* --- 图片区：改用 16:9 比例压低重心 --- */}
            <Link
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
                        className="object-contain p-8 transition-transform duration-1000 ease-out group-hover:scale-110"
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
            </Link>

            {/* --- 内容核心区 --- */}
            <div className="p-7 flex flex-col flex-grow">
                {/* 标题锁高：严格对齐 */}
                <div className="min-h-[85px] mb-4">
                    <div className="flex items-center gap-2 mb-2 text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] italic">
                        <TrendingUp className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                        {data.brand}
                    </div>
                    <Link href={detailUrl}>
                        <h3 className="text-2xl font-[1000] text-slate-900 tracking-[-0.03em] leading-[1.05] uppercase italic transition-colors group-hover:text-blue-600 line-clamp-2">
                            {data.name || data.model}
                        </h3>
                    </Link>
                </div>

                {/* --- 性能矩阵：悬浮变蓝特效 --- */}
                <div className="grid grid-cols-3 gap-6 py-5 border-y border-slate-100 mb-6">
                    {["support", "cooling", "pressure"].map((key) => {
                        const val = Number(
                            data.audit_scores?.[
                                key as keyof typeof data.audit_scores
                            ] || 0
                        )
                        return (
                            <div key={key} className="flex flex-col gap-1.5">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest transition-colors group-hover:text-slate-600">
                                    {key}
                                </span>
                                <div className="flex items-baseline gap-0.5">
                                    <span className="text-xl font-[1000] text-slate-950 italic leading-none transition-colors group-hover:text-blue-600">
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
                <div className="min-h-[50px] space-y-2.5 mb-8">
                    {data.pros?.slice(0, 2).map((pro, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-2.5 group/line"
                        >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 transition-transform group-hover/line:scale-110" />
                            <span className="text-[11px] font-[800] text-slate-700 uppercase tracking-tight transition-colors group-hover:text-slate-900">
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

                    <a
                        href={outboundDealLink(
                            data.slug,
                            data.brand,
                            primaryOffer.url
                        )}
                        target="_blank"
                        rel="nofollow sponsored"
                        className="group/btn relative flex items-center justify-between w-full bg-slate-950 hover:bg-blue-600 text-white rounded-2xl p-2 transition-all duration-500 shadow-xl hover:shadow-blue-500/40"
                    >
                        <div className="pl-4 py-1.5">
                            <div className="text-[9px] font-bold uppercase opacity-50 mb-0.5 tracking-[0.1em]">
                                {primaryOffer.site} DEAL
                            </div>
                            <div className="text-2xl font-[1000] italic leading-none tracking-tighter">
                                {displayPrice > 0
                                    ? formatShelfPriceUsd(Number(displayPrice))
                                    : "CHECK PRICE"}
                            </div>
                        </div>
                        <div className="bg-white/10 h-14 px-5 flex items-center gap-3 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] backdrop-blur-md group-hover/btn:bg-white/20 transition-all">
                            <span>{primaryOffer.promo || "LATEST_DEAL"}</span>
                            <ExternalLink className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                        </div>
                    </a>
                </div>
            </div>
        </div>
    )
}
