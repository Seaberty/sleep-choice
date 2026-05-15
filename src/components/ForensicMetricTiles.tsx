"use client"

import type { AuditRadarDatum } from "@/components/AuditRadarChart"
import { HelpCircle } from "lucide-react"

function MetricHintPanel({ row }: { row: AuditRadarDatum }) {
    const v = row.A
    const isPending =
        typeof v === "number" ? v === 0 : String(v).toUpperCase() === "PENDING"
    const score =
        typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(1)}` : String(v)

    return (
        <div
            className="w-[min(17.5rem,calc(100vw-2rem))] animate-in fade-in zoom-in-95 duration-200"
            role="tooltip"
        >
            <div
                className="relative overflow-hidden rounded-2xl border border-white/10 text-left"
                style={{
                    background:
                        "linear-gradient(145deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 45%, rgba(15,23,42,0.99) 100%)",
                    boxShadow:
                        "0 18px 48px -12px rgba(15,23,42,0.75), 0 0 0 1px rgba(59,130,246,0.14), inset 0 1px 0 rgba(255,255,255,0.07)"
                }}
            >
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent"
                    aria-hidden
                />
                <div className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-gradient-to-b from-sky-400 via-blue-500 to-indigo-600 opacity-90" />

                <div className="relative px-4 pb-3.5 pt-3 sm:px-4 sm:pt-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-sky-300">
                            {row.subject}
                        </span>
                        <span className="text-[8px] font-bold uppercase tracking-[0.28em] text-slate-500">
                            Forensic index
                        </span>
                    </div>
                    <div className="mt-2.5 flex items-baseline gap-1.5">
                        <span
                            className={`font-mono text-2xl font-black tabular-nums tracking-tight ${isPending ? "text-rose-400" : "text-white"}`}
                        >
                            {isPending ? "—" : score}
                        </span>
                        {!isPending ? (
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                                / 10
                            </span>
                        ) : null}
                    </div>
                    <div className="my-2.5 h-px w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
                    {row.hint ? (
                        <p className="text-[11px] font-medium leading-relaxed text-slate-400 [text-wrap:pretty]">
                            {row.hint}
                        </p>
                    ) : (
                        <p className="text-[11px] leading-relaxed text-slate-500 [text-wrap:pretty]">
                            Forensic 0–10 estimate from listing + corpus; not
                            lab-tested.
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

/**
 * 产品页顶部四格分数：与雷达图同一套 hint；桌面悬停/键盘聚焦显示卡片，触摸设备依赖原生 title。
 */
export function ForensicMetricTiles({ items }: { items: AuditRadarDatum[] }) {
    return (
        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 sm:gap-6 md:grid-cols-4 md:pt-8">
            {items.map((m, i) => {
                const isPending =
                    typeof m.A === "number" ? m.A === 0 : false
                return (
                    <div
                        key={`${m.subject}-${i}`}
                        className="group relative rounded-xl border border-slate-100/90 bg-gradient-to-b from-white to-slate-50/70 p-4 shadow-sm ring-0 transition-all duration-200 hover:z-20 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md focus-within:z-20 focus-within:-translate-y-0.5 focus-within:border-slate-200 focus-within:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
                        tabIndex={0}
                        title={m.hint}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                {m.subject}
                            </div>
                            <HelpCircle
                                className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-sky-500 group-focus-visible:text-sky-500"
                                aria-hidden
                            />
                        </div>
                        <div
                            className={`mt-1.5 text-3xl font-black italic tabular-nums tracking-tight ${isPending ? "font-mono text-xl not-italic text-rose-500" : "text-slate-950"}`}
                        >
                            {isPending ? "PENDING" : m.A}
                        </div>

                        {/* 悬停 / 键盘：与雷达 Tooltip 同系的深色卡片；窄屏仍可用 title */}
                        <div className="absolute left-1/2 top-full z-[70] mt-2 hidden w-max min-w-[12rem] max-w-[min(17.5rem,calc(100vw-2rem))] -translate-x-1/2 opacity-0 translate-y-1 scale-[0.98] transition-all duration-200 ease-out group-hover:block group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:block group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100 sm:min-w-[14rem] [@media(hover:none)]:hidden">
                            <MetricHintPanel row={m} />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
