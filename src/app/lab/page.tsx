"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation" // 导入路由钩子
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

function LabDataSkeleton() {
    return (
        <div className="space-y-4 py-4 animate-in fade-in duration-500">
            {[1, 2, 3].map((i) => (
                <div
                    key={i}
                    className="flex justify-between items-end border-b border-slate-100 pb-4"
                >
                    <div className="h-2 w-16 md:w-20 bg-slate-100 rounded-full animate-pulse" />
                    <div className="h-3 w-24 md:w-32 bg-slate-50 rounded-full animate-pulse" />
                </div>
            ))}
            <div className="flex items-center gap-2 mt-4 text-[8px] md:text-[9px] font-mono text-blue-500 italic">
                <Loader2 className="w-3 h-3 animate-spin" />
                UPLINKING_TO_STATION_01...
            </div>
        </div>
    )
}

export default function LabPage() {
    const router = useRouter() // 初始化路由
    const [currentTime, setCurrentTime] = useState("")
    const [isSystemReady, setIsSystemReady] = useState(false)

    useEffect(() => {
        const readyTimer = setTimeout(() => setIsSystemReady(true), 1200)

        // 核心：每秒更新本地时区时间
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

    // 处理跳转函数
    const handleNavigate = () => {
        router.push("/registry") // 这里填写你想跳转的路径，比如 /archive 或 /compare
    }

    return (
        <main className="relative min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-600 selection:text-white antialiased overflow-x-hidden">
            <div className="fixed inset-0 pointer-events-none z-0">
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
                        backgroundSize: "40px 40px"
                    }}
                />
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-white/50 to-white" />
            </div>

            <div className="relative z-10 pt-24 md:pt-32 pb-16">
                <div className="container mx-auto px-5 md:px-6 max-w-7xl">
                    {/* Status Bar */}
                    <div className="flex items-center gap-x-6 overflow-x-auto no-scrollbar py-4 border-b border-slate-200/60 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-blue-600 font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] shrink-0">
                            <Activity className="w-3 h-3 animate-pulse" />
                            <span>System: Operational</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] shrink-0">
                            <Cpu className="w-3 h-3" />
                            <span>Nodes: 1,420 Active</span>
                        </div>
                        {/* 增加 suppressHydrationWarning 防止 SSR 报错 */}
                        <div
                            suppressHydrationWarning
                            className="ml-auto flex items-center gap-3 font-mono text-[10px] md:text-[11px] text-blue-600 font-bold tabular-nums shrink-0 bg-blue-50 px-3 py-1 rounded"
                        >
                            [{currentTime || "SYNCING..."}]
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-12 gap-y-12 lg:gap-16 py-12 md:py-28 items-start">
                        <div className="lg:col-span-7">
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="inline-flex items-center gap-2 mb-8 px-4 py-2 bg-slate-950 text-white rounded-none text-[9px] font-black uppercase tracking-[0.3em] shadow-[4px_4px_0px_0px_rgba(59,130,246,1)]"
                            >
                                <Terminal className="w-4 h-4 text-blue-400" />
                                EXEC_PROTOCOL // NEURAL_AUDIT
                            </motion.div>

                            <h1 className="text-[clamp(2.5rem,12vw,6.5rem)] font-[1000] tracking-tighter uppercase mb-10 leading-[0.85] italic">
                                Deciphering <br />
                                <span className="text-blue-600 not-italic">
                                    Quality_
                                </span>
                            </h1>

                            <div className="max-w-xl border-l-4 border-blue-600 pl-6 md:pl-8">
                                <p className="text-lg md:text-xl text-slate-500 font-bold leading-relaxed italic">
                                    "Marketing claims are noise.{" "}
                                    <span className="text-slate-950 not-italic uppercase tracking-tighter">
                                        Data is the signal.
                                    </span>{" "}
                                    <br />
                                    Our audit engine decodes owner metadata to
                                    expose the truth behind the label."
                                </p>
                            </div>
                        </div>

                        {/* Terminal Interface */}
                        <div className="lg:col-span-5">
                            <div className="p-8 md:p-12 border-2 border-slate-950 rounded-none bg-white shadow-[12px_12px_0px_0px_rgba(2,6,23,0.05)] relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600" />

                                <div className="flex justify-between items-center mb-10">
                                    <div className="flex items-center gap-3 text-slate-900 font-black text-[10px] md:text-[11px] uppercase tracking-widest">
                                        <Database className="w-4 h-4 text-blue-600" />
                                        Audit_Registry_v4
                                    </div>
                                    <div className="flex gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
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
                                            {[
                                                {
                                                    label: "Neural_Scan_Volume",
                                                    val: "10.2K / HR",
                                                    color: "text-slate-950"
                                                },
                                                {
                                                    label: "Accuracy_Rating",
                                                    val: "99.28%",
                                                    color: "text-emerald-600"
                                                },
                                                {
                                                    label: "Audit_Model",
                                                    val: "Scored-Matrix™",
                                                    color: "text-blue-600"
                                                }
                                            ].map((stat, i) => (
                                                <div
                                                    key={i}
                                                    className="flex justify-between items-end border-b border-slate-100 pb-3 group"
                                                >
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter group-hover:text-blue-600 transition-colors">
                                                        {stat.label}
                                                    </span>
                                                    <span
                                                        className={`text-xs md:text-sm font-black uppercase tracking-tight ${stat.color}`}
                                                    >
                                                        {stat.val}
                                                    </span>
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </div>

                                {/* 修复点击：通过 handleNavigate 函数跳转 */}
                                <button
                                    onClick={handleNavigate}
                                    className="w-full mt-10 group bg-slate-950 text-white py-5 rounded-none text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-blue-600 transition-all active:translate-y-1"
                                >
                                    View Audit Archive
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>

                            <div className="mt-6 flex items-start gap-3 px-4 py-3 bg-blue-50/50 border border-blue-100/50">
                                <Binary className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-[8px] md:text-[9px] font-bold text-blue-900/60 leading-tight uppercase tracking-tight">
                                    Encryption active: All audit logs are
                                    cryptographically verified to prevent brand
                                    tampering.
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
