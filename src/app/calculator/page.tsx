"use client"

import React, { useState, useMemo } from "react"
import {
    Calculator,
    CheckCircle2,
    AlertCircle,
    Maximize,
    Box,
    Grid,
    Move,
    Cpu,
    Compass,
    Ruler,
    Layout
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { APP_PROTOCOL } from "@/lib/constants"

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

    const rW = parseFloat(roomWidthFt) || 0
    const rL = parseFloat(roomLengthFt) || 0
    const roomInches = { w: rW * 12, l: rL * 12 }

    const scale = useMemo(() => {
        const maxDim = Math.max(rW, rL, 1)
        return 320 / maxDim
    }, [rW, rL])

    const clearanceW = (roomInches.w - selectedBed.width) / 2
    const clearanceL = (roomInches.l - selectedBed.length) / 2

    // 硬核指标计算
    const roomArea = rW * rL
    const bedArea = (selectedBed.width * selectedBed.length) / 144
    const utilization = ((bedArea / roomArea) * 100).toFixed(1)

    const isFitting =
        roomInches.w >= selectedBed.width && roomInches.l >= selectedBed.length
    const hasOptimalClearance = clearanceW >= 30 && clearanceL >= 30 // 提高到 30 英寸

    return (
        <main className="relative min-h-screen bg-white pt-24 pb-20 overflow-x-hidden font-sans">
            {/* 实验室环境纹理 */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage:
                            "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
                        backgroundSize: "40px 40px"
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent pointer-events-none" />
            </div>

            <div className="container mx-auto px-6 relative z-10 max-w-7xl">
                {/* 1. Header: 终端化处理 */}
                <header className="max-w-4xl mb-16 border-l-4 border-blue-600 pl-8">
                    <div className="flex items-center gap-3 text-blue-600 font-black text-[9px] uppercase tracking-[0.4em] mb-4">
                        <Cpu className="w-4 h-4" />
                        {`Spatial_Audit_System_${APP_PROTOCOL} // Dimension_Scanner`}
                    </div>
                    <h1 className="text-5xl md:text-8xl font-[1000] tracking-tighter uppercase leading-[0.8] mb-6 italic">
                        Spatial <br />
                        <span className="text-blue-600 not-italic">
                            Analyzer
                        </span>
                    </h1>
                    <p className="text-sm font-mono font-bold text-slate-500 uppercase tracking-widest max-w-xl">
                        Calculating biometric clearance and structural movement
                        radius for high-performance sleep environments.
                    </p>
                </header>

                <div className="grid lg:grid-cols-12 gap-8 items-start">
                    {/* 2. Control Node: 参数配置 */}
                    <div className="lg:col-span-3 space-y-4">
                        <section className="bg-slate-950 p-8 text-white relative overflow-hidden">
                            <div className="relative z-10">
                                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-8 flex items-center gap-2">
                                    <Compass className="w-4 h-4" />
                                    Input_Parameters
                                </h2>

                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase mb-2">
                                                <span>Room_Width</span>
                                                <span>{rW} FT</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="8"
                                                max="25"
                                                step="0.5"
                                                value={roomWidthFt}
                                                onChange={(e) =>
                                                    setRoomWidthFt(
                                                        e.target.value
                                                    )
                                                }
                                                className="w-full h-1 bg-slate-800 appearance-none rounded-full accent-blue-500 cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase mb-2">
                                                <span>Room_Length</span>
                                                <span>{rL} FT</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="8"
                                                max="25"
                                                step="0.5"
                                                value={roomLengthFt}
                                                onChange={(e) =>
                                                    setRoomLengthFt(
                                                        e.target.value
                                                    )
                                                }
                                                className="w-full h-1 bg-slate-800 appearance-none rounded-full accent-blue-500 cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-white/10">
                                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-4">
                                            Mattress_Payload
                                        </label>
                                        <div className="grid grid-cols-1 gap-1.5">
                                            {Object.entries(bedSizes).map(
                                                ([key, size]) => (
                                                    <button
                                                        key={key}
                                                        onClick={() =>
                                                            setBedSize(key)
                                                        }
                                                        className={cn(
                                                            "text-left p-3 text-[10px] font-black uppercase tracking-widest transition-all",
                                                            bedSize === key
                                                                ? "bg-blue-600 text-white translate-x-1"
                                                                : "text-slate-400 hover:text-white hover:bg-white/5"
                                                        )}
                                                    >
                                                        {size.label}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* 3. Render Node: 实时制图 */}
                    <div className="lg:col-span-6">
                        <section className="aspect-square bg-slate-50 border border-slate-200 relative flex items-center justify-center overflow-hidden shadow-inner">
                            {/* 扫描参考背景 */}
                            <div
                                className="absolute inset-0 opacity-[0.3]"
                                style={{
                                    backgroundImage:
                                        "radial-gradient(#94a3b8 1.5px, transparent 1.5px)",
                                    backgroundSize: "24px 24px"
                                }}
                            />

                            {/* 比例尺 */}
                            <div className="absolute top-8 left-8 flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-12 h-[2px] bg-slate-900" />
                                    <span className="text-[10px] font-mono font-bold">
                                        5.0 FT (Scaled)
                                    </span>
                                </div>
                            </div>

                            {/* 动态房间 */}

                            <motion.div
                                layout
                                animate={{
                                    width: rW * scale,
                                    height: rL * scale
                                }}
                                className="border-[3px] border-slate-950 bg-white relative flex items-center justify-center shadow-2xl transition-all"
                            >
                                {/* 边长标注 */}
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                    <span className="text-[10px] font-black uppercase tracking-tighter">
                                        {rW}ft
                                    </span>
                                    <div className="w-px h-2 bg-slate-400" />
                                </div>
                                <div className="absolute top-1/2 -right-12 -translate-y-1/2 flex items-center">
                                    <div className="h-px w-2 bg-slate-400" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter rotate-90">
                                        {rL}ft
                                    </span>
                                </div>

                                {/* 床体组件 */}
                                <motion.div
                                    layout
                                    animate={{
                                        width: (selectedBed.width / 12) * scale,
                                        height:
                                            (selectedBed.length / 12) * scale
                                    }}
                                    className={cn(
                                        "border-[2px] relative flex flex-col items-center justify-center transition-all shadow-lg",
                                        isFitting
                                            ? "bg-blue-50 border-blue-600"
                                            : "bg-red-50 border-red-600"
                                    )}
                                >
                                    <Layout
                                        className={cn(
                                            "w-6 h-6 mb-1 opacity-20",
                                            isFitting
                                                ? "text-blue-600"
                                                : "text-red-600"
                                        )}
                                    />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 px-2 text-center">
                                        {selectedBed.label}
                                    </span>

                                    {/* 辅助对齐线 (仅在符合规格时显示) */}
                                    {isFitting && (
                                        <div className="absolute inset-0 border border-blue-200 border-dashed animate-pulse" />
                                    )}
                                </motion.div>
                            </motion.div>

                            <div className="absolute bottom-6 right-6 flex items-center gap-3 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                <Ruler className="w-3.5 h-3.5" />
                                Computed_Scale: 1:12 // Unit: Imperial
                            </div>
                        </section>
                    </div>

                    {/* 4. Report Node: 审计摘要 */}
                    <div className="lg:col-span-3 space-y-6">
                        <section className="border-4 border-slate-950 p-8 space-y-8">
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-6">
                                    Efficiency_Metrics
                                </h3>
                                <div className="space-y-6">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">
                                                Space_Utilization
                                            </p>
                                            <p className="text-3xl font-black italic tracking-tighter">
                                                {utilization}%
                                            </p>
                                        </div>
                                        <div
                                            className={cn(
                                                "w-1 h-8",
                                                parseFloat(utilization) > 40
                                                    ? "bg-amber-500"
                                                    : "bg-blue-500"
                                            )}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-6">
                                        <div>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">
                                                Side_Access
                                            </p>
                                            <p className="text-lg font-mono font-bold tracking-tighter">
                                                {clearanceW.toFixed(0)}"
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">
                                                Foot_Access
                                            </p>
                                            <p className="text-lg font-mono font-bold tracking-tighter">
                                                {clearanceL.toFixed(0)}"
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
                                    System_Verdict
                                </h3>
                                <AnimatePresence mode="wait">
                                    {isFitting ? (
                                        <motion.div
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className={cn(
                                                "p-4 border-l-4",
                                                hasOptimalClearance
                                                    ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                                                    : "bg-amber-50 border-amber-500 text-amber-800"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                {hasOptimalClearance ? (
                                                    <CheckCircle2 className="w-4 h-4" />
                                                ) : (
                                                    <AlertCircle className="w-4 h-4" />
                                                )}
                                                <span className="text-[10px] font-black uppercase tracking-widest">
                                                    {hasOptimalClearance
                                                        ? "Optimal_Flow"
                                                        : "Compressed_Flow"}
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-bold leading-relaxed uppercase opacity-80">
                                                {hasOptimalClearance
                                                    ? 'Clearance exceeds 30" protocol. Ideal for nightstand placement and user rotation.'
                                                    : 'Clearance falls below 30" margin. Furniture placement will be high-density.'}
                                            </p>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            initial={{
                                                opacity: 0,
                                                scale: 0.95
                                            }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="p-4 bg-red-950 text-red-200 border-l-4 border-red-500"
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <AlertCircle className="w-4 h-4" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">
                                                    Crit_Violation
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-bold leading-relaxed uppercase">
                                                Geometric collision detected.
                                                The selected payload exceeds
                                                containment boundaries.
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </section>

                        <div className="p-6 bg-slate-50 border border-slate-200">
                            <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-4">
                                <Move className="w-3.5 h-3.5 text-blue-600" />
                                Movement_Radius
                            </h4>
                            <div className="space-y-3 opacity-60">
                                <div className="flex justify-between text-[9px] font-bold uppercase">
                                    <span>Door_Arc_Min</span>
                                    <span>32"</span>
                                </div>
                                <div className="flex justify-between text-[9px] font-bold uppercase">
                                    <span>Rug_Overlap_Min</span>
                                    <span>24"</span>
                                </div>
                                <div className="flex justify-between text-[9px] font-bold uppercase text-blue-600">
                                    <span>Nightstand_Buffer</span>
                                    <span>+4"</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}
