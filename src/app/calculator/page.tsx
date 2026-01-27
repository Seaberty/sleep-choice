"use client"

import React, { useState, useMemo } from "react"
import {
    Calculator,
    CheckCircle2,
    AlertCircle,
    Maximize,
    Box,
    Grid,
    Move
} from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export default function CalculatorPage() {
    const [roomWidthFt, setRoomWidthFt] = useState<string>("12")
    const [roomLengthFt, setRoomLengthFt] = useState<string>("14")
    const [bedSize, setBedSize] = useState<string>("queen")

    const bedSizes = {
        twin: { width: 38, length: 75, label: "Twin" },
        "twin-xl": { width: 38, length: 80, label: "Twin XL" },
        full: { width: 54, length: 75, label: "Full" },
        queen: { width: 60, length: 80, label: "Queen" },
        king: { width: 76, length: 80, label: "King" },
        "cal-king": { width: 72, length: 84, label: "California King" }
    }

    const selectedBed = bedSizes[bedSize as keyof typeof bedSizes]

    // 数值转换逻辑
    const rW = parseFloat(roomWidthFt) || 0
    const rL = parseFloat(roomLengthFt) || 0
    const roomInches = { w: rW * 12, l: rL * 12 }

    // 计算比例用于可视化
    const scale = useMemo(() => {
        const maxDim = Math.max(rW, rL, 1)
        return 280 / maxDim // 容器宽度基准
    }, [rW, rL])

    const clearanceW = (roomInches.w - selectedBed.width) / 2
    const clearanceL = (roomInches.l - selectedBed.length) / 2
    const isFitting =
        roomInches.w >= selectedBed.width && roomInches.l >= selectedBed.length
    const hasOptimalClearance = clearanceW >= 24 && clearanceL >= 24

    return (
        <main className="relative min-h-screen bg-white pt-24 pb-20 overflow-hidden font-sans">
            {/* 背景工业网格 */}
            <div
                className="fixed inset-0 pointer-events-none opacity-[0.03]"
                style={{
                    backgroundImage:
                        "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
                    backgroundSize: "40px 40px"
                }}
            />

            <div className="container mx-auto px-6 relative z-10 max-w-6xl">
                {/* 头部：系统风格 */}
                <header className="mb-16">
                    <div className="flex items-center gap-3 text-blue-600 font-black text-[9px] uppercase tracking-[0.3em] mb-4">
                        <Maximize className="w-3.5 h-3.5" />
                        Spatial_Audit_v2.0
                    </div>
                    <h1 className="text-5xl md:text-7xl font-[1000] tracking-tighter uppercase leading-[0.85] mb-6 italic">
                        Dimension <br />
                        <span className="text-blue-600 not-italic">
                            Analyzer
                        </span>
                    </h1>
                    <div className="h-px w-full bg-slate-100 relative">
                        <div className="absolute left-0 top-0 h-full w-24 bg-blue-600" />
                    </div>
                </header>

                <div className="grid lg:grid-cols-12 gap-12 items-start">
                    {/* 左侧：参数输入区域 */}
                    <div className="lg:col-span-4 space-y-6">
                        <section className="p-8 border border-slate-200 bg-white shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 text-[8px] font-mono text-slate-200 uppercase">
                                Input_Field
                            </div>

                            <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2">
                                <Calculator className="w-4 h-4 text-blue-600" />
                                Parameter_Config
                            </h2>

                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-900 mb-2">
                                            Width (ft)
                                        </label>
                                        <input
                                            type="number"
                                            value={roomWidthFt}
                                            onChange={(e) =>
                                                setRoomWidthFt(e.target.value)
                                            }
                                            className="w-full bg-slate-50 border border-slate-200 p-4 font-mono font-bold text-lg focus:outline-none focus:border-blue-600 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-900 mb-2">
                                            Length (ft)
                                        </label>
                                        <input
                                            type="number"
                                            value={roomLengthFt}
                                            onChange={(e) =>
                                                setRoomLengthFt(e.target.value)
                                            }
                                            className="w-full bg-slate-50 border border-slate-200 p-4 font-mono font-bold text-lg focus:outline-none focus:border-blue-600 transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-900 mb-4 tracking-widest">
                                        Mattress_Standard
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(bedSizes).map(
                                            ([key, size]) => (
                                                <button
                                                    key={key}
                                                    onClick={() =>
                                                        setBedSize(key)
                                                    }
                                                    className={cn(
                                                        "p-3 text-[10px] font-black uppercase tracking-tighter transition-all border",
                                                        bedSize === key
                                                            ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200"
                                                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"
                                                    )}
                                                >
                                                    {size.label}
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 状态指示条 */}
                        <div
                            className={cn(
                                "p-4 flex items-center gap-4 border font-black text-[10px] uppercase tracking-[0.2em]",
                                isFitting
                                    ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                                    : "bg-red-50 border-red-100 text-red-600"
                            )}
                        >
                            <div
                                className={cn(
                                    "w-2 h-2 rounded-full animate-pulse",
                                    isFitting ? "bg-emerald-500" : "bg-red-500"
                                )}
                            />
                            Status:{" "}
                            {isFitting ? "Optimal_Fit" : "Spatial_Violation"}
                        </div>
                    </div>

                    {/* 中间：实时可视化制图区 */}
                    <div className="lg:col-span-5">
                        <section className="aspect-square bg-slate-50 border border-slate-200 relative p-12 flex items-center justify-center overflow-hidden group">
                            <div
                                className="absolute inset-0 opacity-[0.2] pointer-events-none"
                                style={{
                                    backgroundImage:
                                        "radial-gradient(#94a3b8 1px, transparent 1px)",
                                    backgroundSize: "16px 16px"
                                }}
                            />

                            {/* 动态房间边框 */}
                            <motion.div
                                animate={{
                                    width: rW * scale,
                                    height: rL * scale
                                }}
                                className="border-2 border-slate-900 bg-white relative flex items-center justify-center shadow-2xl"
                                transition={{
                                    type: "spring",
                                    stiffness: 100,
                                    damping: 20
                                }}
                            >
                                {/* 房间尺寸标注 */}
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 font-mono text-[10px] font-bold text-slate-400">
                                    {rW}ft
                                </div>
                                <div className="absolute top-1/2 -right-10 -translate-y-1/2 font-mono text-[10px] font-bold text-slate-400 rotate-90">
                                    {rL}ft
                                </div>

                                {/* 床位示意图 */}
                                <motion.div
                                    animate={{
                                        width: (selectedBed.width / 12) * scale,
                                        height:
                                            (selectedBed.length / 12) * scale
                                    }}
                                    className={cn(
                                        "border-2 relative flex items-center justify-center transition-colors duration-500",
                                        isFitting
                                            ? "bg-blue-600/10 border-blue-600"
                                            : "bg-red-600/20 border-red-600"
                                    )}
                                >
                                    <div className="text-[8px] font-black uppercase text-blue-600 tracking-tighter text-center px-1">
                                        {selectedBed.label}
                                    </div>

                                    {/* 间距标注线 */}
                                    {isFitting && (
                                        <>
                                            <div className="absolute -left-4 top-1/2 h-px w-4 bg-blue-400" />
                                            <div className="absolute -right-4 top-1/2 h-px w-4 bg-blue-400" />
                                        </>
                                    )}
                                </motion.div>
                            </motion.div>

                            <div className="absolute bottom-4 left-4 flex items-center gap-2 text-[8px] font-mono text-slate-400 uppercase tracking-widest">
                                <Grid className="w-3 h-3" />
                                Live_Render_Scale: 1:12_Ratio
                            </div>
                        </section>
                    </div>

                    {/* 右侧：审计报告区 */}
                    <div className="lg:col-span-3 space-y-6">
                        <section className="p-6 bg-slate-950 text-white space-y-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Box className="w-16 h-16 text-white" />
                            </div>

                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">
                                Audit_Summary
                            </h3>

                            <div className="space-y-4">
                                <div className="border-b border-white/10 pb-4">
                                    <div className="text-[8px] font-black text-slate-500 uppercase mb-1">
                                        Operational_Perimeter
                                    </div>
                                    <div className="text-xl font-mono font-bold">
                                        {clearanceW.toFixed(0)}"{" "}
                                        <span className="text-[10px] text-slate-400">
                                            SIDE
                                        </span>
                                    </div>
                                </div>
                                <div className="border-b border-white/10 pb-4">
                                    <div className="text-[8px] font-black text-slate-500 uppercase mb-1">
                                        Vertical_Access
                                    </div>
                                    <div className="text-xl font-mono font-bold">
                                        {clearanceL.toFixed(0)}"{" "}
                                        <span className="text-[10px] text-slate-400">
                                            FOOT
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                {hasOptimalClearance ? (
                                    <div className="flex gap-2 text-emerald-400 items-start">
                                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                                        <p className="text-[9px] font-bold leading-relaxed uppercase tracking-tight">
                                            Clearance exceeds 24" threshold.
                                            Mobility rating: OPTIMAL.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex gap-2 text-amber-400 items-start">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <p className="text-[9px] font-bold leading-relaxed uppercase tracking-tight">
                                            Below 24" threshold. Circulation may
                                            be restricted.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>

                        <div className="p-6 border border-slate-100 space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Move className="w-3 h-3 text-blue-600" />
                                Access_Notes
                            </h4>
                            <ul className="text-[9px] font-bold text-slate-500 space-y-3 uppercase tracking-tight">
                                <li>
                                    • Verify door swing arc radius (min 32")
                                </li>
                                <li>• Check radiator/HVAC protrusion depth</li>
                                <li>
                                    • Cal-King requires custom bed-frame
                                    clearance
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}
