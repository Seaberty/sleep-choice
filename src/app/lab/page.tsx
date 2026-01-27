"use client"

import React, { useState, useEffect } from "react"
import { ArrowRight, Terminal, Loader2, Database, Binary } from "lucide-react"
import { motion } from "framer-motion"

// 模拟的情报感骨架屏：当数据加载时显示
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
                CONNECTING_TO_STATION_01...
            </div>
        </div>
    )
}

export default function LabPage() {
    const [currentTime, setCurrentTime] = useState("")
    const [isSystemReady, setIsSystemReady] = useState(false)

    useEffect(() => {
        const readyTimer = setTimeout(() => setIsSystemReady(true), 100)
        const timer = setInterval(() => {
            setCurrentTime(
                new Date().toLocaleTimeString("en-US", { hour12: false })
            )
        }, 1000)
        return () => {
            clearTimeout(readyTimer)
            clearInterval(timer)
        }
    }, [])

    return (
        <main className="relative min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-600 selection:text-white antialiased overflow-x-hidden">
            {/* 背景层纹理 */}
            <div
                className="fixed inset-0 pointer-events-none z-0"
                style={{ willChange: "opacity" }}
            >
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
                        backgroundSize:
                            "clamp(20px, 5vw, 40px) clamp(20px, 5vw, 40px)"
                    }}
                />
            </div>

            <div className="relative z-10 pt-20 md:pt-32 pb-16">
                <div className="container mx-auto px-5 md:px-6 max-w-7xl">
                    {/* 1. Status Bar: 优化移动端溢出 */}
                    <div className="flex items-center gap-x-4 md:gap-x-6 overflow-x-auto no-scrollbar py-4 border-b border-slate-200/60 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-blue-600 font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] shrink-0">
                            <div className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                            </div>
                            <span>Node: Online</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] shrink-0">
                            <Binary className="w-3 h-3 md:w-3.5 md:h-3.5" />
                            <span>AES_256</span>
                        </div>
                        <div className="ml-auto flex items-center gap-3 font-mono text-[10px] md:text-[11px] text-blue-600 font-bold tabular-nums shrink-0">
                            [{currentTime || "00:00:00"}]
                        </div>
                    </div>

                    {/* 2. Hero Section Layout */}
                    <div className="grid lg:grid-cols-12 gap-y-12 lg:gap-12 py-12 md:py-28 items-start lg:items-center">
                        <div className="lg:col-span-7">
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="inline-flex items-center gap-2 md:gap-3 mb-6 md:mb-8 px-3 py-1.5 md:px-4 md:py-2 bg-slate-950 text-white rounded-none text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] shadow-[3px_3px_0px_0px_rgba(59,130,246,1)]"
                            >
                                <Terminal className="w-3 h-3 md:w-4 md:h-4 text-blue-400" />
                                EXEC_PROTOCOL // MATERIAL
                            </motion.div>

                            {/* 修复：使用 clamp 限制字体大小，防止移动端标题过大 */}
                            <h1 className="text-[clamp(2.5rem,12vw,6.5rem)] font-[1000] tracking-tighter uppercase mb-8 md:mb-10 leading-[0.85] italic break-words">
                                Decrypting <br />
                                <span className="text-blue-600 not-italic whitespace-nowrap md:whitespace-normal">
                                    Comfort_
                                </span>
                            </h1>

                            <div className="max-w-xl border-l-4 border-blue-600 pl-5 md:pl-8">
                                <p className="text-base md:text-xl text-slate-500 font-bold leading-relaxed italic">
                                    "Marketing is an opinion.{" "}
                                    <br className="md:hidden" />
                                    <span className="text-slate-950 not-italic">
                                        Data is a verdict.
                                    </span>{" "}
                                    <br />
                                    Our lab audits physical molecular
                                    integrity."
                                </p>
                            </div>
                        </div>

                        {/* 3. Data Terminal: 终端容器适配 */}
                        <div className="lg:col-span-5 relative">
                            <div className="p-6 md:p-12 border border-slate-200 rounded-none bg-white shadow-2xl shadow-blue-900/5 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-slate-900" />

                                <div className="flex justify-between items-center mb-8 md:mb-10">
                                    <div className="flex items-center gap-2 md:gap-3 text-slate-900 font-black text-[9px] md:text-[11px] uppercase tracking-widest">
                                        <Database className="w-4 h-4 text-blue-600" />
                                        Registry_Logs
                                    </div>
                                    <span className="animate-pulse px-2 py-0.5 bg-blue-50 text-blue-600 text-[7px] md:text-[8px] font-black uppercase">
                                        Live
                                    </span>
                                </div>

                                <div className="min-h-[140px] md:min-h-[160px]">
                                    {!isSystemReady ? (
                                        <LabDataSkeleton />
                                    ) : (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="space-y-5 md:space-y-6 font-mono"
                                        >
                                            {[
                                                {
                                                    label: "Active_Audits",
                                                    val: "12_Models",
                                                    color: "text-slate-900"
                                                },
                                                {
                                                    label: "Lab_Efficiency",
                                                    val: "99.8%",
                                                    color: "text-emerald-600"
                                                },
                                                {
                                                    label: "Sensor_Array",
                                                    val: "V4_Tactile_X",
                                                    color: "text-blue-600"
                                                }
                                            ].map((stat, i) => (
                                                <div
                                                    key={i}
                                                    className="flex justify-between items-end border-b border-slate-100 pb-3 hover:border-blue-200 transition-colors"
                                                >
                                                    <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase">
                                                        {stat.label}
                                                    </span>
                                                    <span
                                                        className={`text-[11px] md:text-[13px] font-bold uppercase tracking-tight ${stat.color}`}
                                                    >
                                                        {stat.val}
                                                    </span>
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </div>

                                <button className="w-full mt-8 md:mt-10 group bg-slate-950 text-white py-4 md:py-5 rounded-none text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-3 hover:bg-blue-600 transition-all active:scale-[0.98]">
                                    Enter Archive
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
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
