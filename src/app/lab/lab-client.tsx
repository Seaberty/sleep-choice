"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
    ArrowRight,
    Terminal,
    Loader2,
    Database,
    Binary,
    Cpu,
    Activity
} from "lucide-react"
import { motion } from "framer-motion"
import type { SiteHeaderMetrics } from "@/lib/site-metrics"

function LabDataSkeleton() {
    return (
        <div className="space-y-4 py-4 animate-in fade-in duration-500">
            {[1, 2, 3].map((i) => (
                <div
                    key={i}
                    className="flex justify-between items-end border-b border-slate-100 pb-4"
                >
                    <div className="h-2 w-16 animate-pulse rounded-full bg-slate-100 md:w-20" />
                    <div className="h-3 w-24 animate-pulse rounded-full bg-slate-50 md:w-32" />
                </div>
            ))}
            <div className="mt-4 flex items-center gap-2 text-[8px] font-mono italic text-blue-500 md:text-[9px]">
                <Loader2 className="h-3 w-3 animate-spin" />
                UPLINKING_TO_STATION_01...
            </div>
        </div>
    )
}

export default function LabPageClient({
    metrics
}: {
    metrics: SiteHeaderMetrics
}) {
    const router = useRouter()
    const [currentTime, setCurrentTime] = useState("")
    const [isSystemReady, setIsSystemReady] = useState(false)

    useEffect(() => {
        const readyTimer = setTimeout(() => setIsSystemReady(true), 1200)

        const updateTime = () => {
            const now = new Date()
            setCurrentTime(
                now.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false
                })
            )
        }

        updateTime()
        const timer = setInterval(updateTime, 1000)

        return () => {
            clearTimeout(readyTimer)
            clearInterval(timer)
        }
    }, [])

    const handleNavigate = () => {
        router.push("/registry")
    }

    const terminalStats = [
        {
            label: "Indexed_Models",
            val: `${metrics.modelsAnalyzed} units`,
            color: "text-slate-950"
        },
        {
            label: "Registry_Sync",
            val: metrics.lastUpdate,
            color: "text-emerald-600"
        },
        {
            label: "Deploy_Node",
            val: metrics.node,
            color: "text-slate-700"
        },
        {
            label: "Audit_Model",
            val: "Scored-Matrix™",
            color: "text-blue-600"
        }
    ]

    return (
        <main className="relative min-h-screen overflow-x-hidden bg-[#F8FAFC] font-sans text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
            <div className="pointer-events-none fixed inset-0 z-0">
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
                        backgroundSize: "40px 40px"
                    }}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-transparent" />
            </div>

            <div className="relative z-10 pb-16 pt-24 md:pt-32">
                <div className="container mx-auto max-w-7xl px-5 md:px-6">
                    <div className="no-scrollbar flex items-center gap-x-6 overflow-x-auto whitespace-nowrap border-b border-slate-200/60 py-4">
                        <div className="flex shrink-0 items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-blue-600 md:text-[10px]">
                            <Activity className="h-3 w-3 animate-pulse" />
                            <span>System: Operational</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 md:text-[10px]">
                            <Cpu className="h-3 w-3" />
                            <span>
                                Live registry index: {metrics.modelsAnalyzed}{" "}
                                models
                            </span>
                        </div>
                        <div
                            suppressHydrationWarning
                            className="ml-auto flex shrink-0 items-center gap-3 rounded bg-blue-50 px-3 py-1 font-mono text-[10px] font-bold tabular-nums text-blue-600 md:text-[11px]"
                        >
                            [{currentTime || "SYNCING..."}]
                        </div>
                    </div>

                    <div className="grid items-start gap-y-12 py-12 md:gap-16 md:py-28 lg:grid-cols-12">
                        <div className="lg:col-span-7">
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="mb-8 inline-flex items-center gap-2 rounded-none bg-slate-950 px-4 py-2 text-[9px] font-black uppercase tracking-[0.3em] text-white shadow-[4px_4px_0px_0px_rgba(59,130,246,1)]"
                            >
                                <Terminal className="h-4 w-4 text-blue-400" />
                                EXEC_PROTOCOL // NEURAL_AUDIT
                            </motion.div>

                            <h1 className="mb-10 text-[clamp(2.5rem,12vw,6.5rem)] font-[1000] uppercase leading-[0.85] tracking-tighter italic">
                                Deciphering <br />
                                <span className="text-blue-600 not-italic">
                                    Quality_
                                </span>
                            </h1>

                            <div className="max-w-xl border-l-4 border-blue-600 pl-6 md:pl-8">
                                <p className="text-lg font-bold italic leading-relaxed text-slate-500 md:text-xl">
                                    &quot;Marketing claims are noise.{" "}
                                    <span className="text-slate-950 not-italic uppercase tracking-tighter">
                                        Data is the signal.
                                    </span>{" "}
                                    <br />
                                    Our audit engine decodes owner metadata to
                                    expose the truth behind the label.&quot;
                                </p>
                            </div>
                        </div>

                        <div className="lg:col-span-5">
                            <div className="relative overflow-hidden rounded-none border-2 border-slate-950 bg-white p-8 shadow-[12px_12px_0px_0px_rgba(2,6,23,0.05)] md:p-12">
                                <div className="absolute left-0 top-0 h-1.5 w-full bg-blue-600" />

                                <div className="mb-10 flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-900 md:text-[11px]">
                                        <Database className="h-4 w-4 text-blue-600" />
                                        Audit_Registry · {metrics.protocol}
                                    </div>
                                    <div className="flex gap-1.5">
                                        <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />
                                    </div>
                                </div>

                                <div className="min-h-[160px]">
                                    {!isSystemReady ? (
                                        <LabDataSkeleton />
                                    ) : (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-6 font-mono"
                                        >
                                            {terminalStats.map((stat, i) => (
                                                <div
                                                    key={i}
                                                    className="group flex items-end justify-between border-b border-slate-100 pb-3"
                                                >
                                                    <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400 transition-colors group-hover:text-blue-600">
                                                        {stat.label}
                                                    </span>
                                                    <span
                                                        className={`text-xs font-black uppercase tracking-tight md:text-sm ${stat.color}`}
                                                    >
                                                        {stat.val}
                                                    </span>
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleNavigate}
                                    className="group mt-10 flex w-full items-center justify-center gap-3 rounded-none bg-slate-950 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-white transition-all hover:bg-blue-600 active:translate-y-1"
                                >
                                    View Audit Archive
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </button>
                            </div>

                            <div className="mt-6 flex items-start gap-3 border border-blue-100/50 bg-blue-50/50 px-4 py-3">
                                <Binary className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                                <p className="text-[8px] font-bold uppercase leading-tight tracking-tight text-blue-900/60 md:text-[9px]">
                                    Figures mirror the header trust strip (registry
                                    uplink). This page is not in the main nav during
                                    launch — scoring details live on /methodology.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </main>
    )
}
