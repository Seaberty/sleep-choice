import Link from "next/link"
import { getAutomatedRegistry } from "@/lib/registry"
import {
    Scale,
    TrendingUp,
    TrendingDown,
    Minus,
    CheckCircle2,
    ArrowRight,
    Sparkles,
    Database,
    Binary,
    ShieldCheck
} from "lucide-react"
import { cn } from "@/lib/utils"

export const metadata = {
    title: "Technical Benchmarks | Side-by-Side Comparison",
    description:
        "Lab-verified mattress metrics comparison. Strategic data for optimal sleep environment engineering."
}

export const revalidate = 3600

export default async function ComparePage() {
    const products = await getAutomatedRegistry()
    const topProducts = products.slice(0, 3)

    // 辅助函数：获取该列是否为全局最高/最低
    const getBestValue = (key: string) => {
        const values = topProducts.map((p) => {
            if (key === "price") return p.offers[0]?.price || 9999
            return (p.metrics as any)[key] || 0
        })
        return key === "price" ? Math.min(...values) : Math.max(...values)
    }

    return (
        <main className="relative min-h-screen bg-white pt-24 pb-20 overflow-hidden font-sans">
            {/* 实验室背景纹理 */}
            <div
                className="fixed inset-0 pointer-events-none opacity-[0.03]"
                style={{
                    backgroundImage:
                        "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
                    backgroundSize: "40px 40px"
                }}
            />

            <div className="container mx-auto px-6 relative z-10 max-w-7xl">
                {/* 1. Header: 强化审计终端感 */}
                <header className="max-w-4xl mb-16 border-l-4 border-blue-600 pl-8">
                    <div className="flex items-center gap-3 text-blue-600 font-black text-[9px] uppercase tracking-[0.4em] mb-4">
                        <Binary className="w-4 h-4" />
                        Benchmark_Engine // V.2.6
                    </div>
                    <h1 className="text-5xl md:text-8xl font-[1000] tracking-tighter uppercase leading-[0.8] mb-6 italic">
                        Metric <br />
                        <span className="text-blue-600 not-italic">
                            Comparison
                        </span>
                    </h1>
                    <p className="text-sm font-mono font-bold text-slate-500 uppercase tracking-widest max-w-xl">
                        Cross-referencing laboratory sensor data for precision
                        selection.
                    </p>
                </header>

                {/* 2. Comparison Table: 工业化重构 */}
                {topProducts.length >= 2 ? (
                    <div className="relative group overflow-hidden border border-slate-200 bg-white">
                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="bg-slate-950 text-white">
                                        <th className="p-8 border-r border-white/10 min-w-[200px]">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-black tracking-[0.3em] text-blue-400 uppercase">
                                                    Registry
                                                </span>
                                                <span className="text-xl font-black uppercase italic">
                                                    Index
                                                </span>
                                            </div>
                                        </th>
                                        {topProducts.map((product) => (
                                            <th
                                                key={product.id}
                                                className="p-8 border-r border-white/10 min-w-[300px] relative"
                                            >
                                                <div className="flex flex-col gap-2">
                                                    <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-widest">
                                                        REF_
                                                        {product.id.substring(
                                                            0,
                                                            6
                                                        )}
                                                    </span>
                                                    <h3 className="text-2xl font-[1000] tracking-tighter uppercase leading-none">
                                                        {product.brand}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <div className="px-2 py-0.5 bg-blue-600 text-[10px] font-black uppercase">
                                                            Score:{" "}
                                                            {product.rating}
                                                        </div>
                                                    </div>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody className="font-mono">
                                    {/* 核心指标行渲染逻辑 */}
                                    {[
                                        {
                                            label: "Overall_Performance",
                                            key: "rating",
                                            icon: (
                                                <TrendingUp className="w-3 h-3" />
                                            )
                                        },
                                        {
                                            label: "Structural_Support",
                                            key: "support",
                                            metricKey: "support"
                                        },
                                        {
                                            label: "Thermal_Regulation",
                                            key: "cooling",
                                            metricKey: "cooling"
                                        },
                                        {
                                            label: "Pressure_Relief",
                                            key: "pressure",
                                            metricKey: "pressure"
                                        },
                                        {
                                            label: "Price_Point (USD)",
                                            key: "price"
                                        }
                                    ].map((row, idx) => {
                                        const bestVal = getBestValue(
                                            row.metricKey || row.key
                                        )
                                        return (
                                            <tr
                                                key={idx}
                                                className={cn(
                                                    "border-b border-slate-100 group/row hover:bg-slate-50/50 transition-colors",
                                                    idx % 2 === 0
                                                        ? "bg-white"
                                                        : "bg-slate-50/30"
                                                )}
                                            >
                                                <td className="p-6 border-r border-slate-100">
                                                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover/row:text-blue-600 transition-colors">
                                                        {row.label}
                                                    </span>
                                                </td>
                                                {topProducts.map((product) => {
                                                    const val =
                                                        row.key === "price"
                                                            ? product.offers[0]
                                                                  ?.price
                                                            : row.metricKey
                                                            ? (
                                                                  product.metrics as any
                                                              )[row.metricKey]
                                                            : product.rating
                                                    const isBest =
                                                        val === bestVal

                                                    return (
                                                        <td
                                                            key={product.id}
                                                            className={cn(
                                                                "p-8 text-center border-r border-slate-100 relative",
                                                                isBest &&
                                                                    "bg-blue-50/30"
                                                            )}
                                                        >
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span
                                                                    className={cn(
                                                                        "text-2xl font-black tabular-nums",
                                                                        isBest
                                                                            ? "text-blue-600"
                                                                            : "text-slate-900"
                                                                    )}
                                                                >
                                                                    {row.key ===
                                                                    "price"
                                                                        ? `$${val?.toLocaleString()}`
                                                                        : val?.toFixed(
                                                                              1
                                                                          )}
                                                                </span>
                                                                {isBest && (
                                                                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-500">
                                                                        [Peak_Performance]
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        )
                                    })}

                                    {/* 特色点对照 */}
                                    <tr className="border-b border-slate-100">
                                        <td className="p-6 border-r border-slate-100">
                                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                                                Tactical_Features
                                            </span>
                                        </td>
                                        {topProducts.map((product) => (
                                            <td
                                                key={product.id}
                                                className="p-8 border-r border-slate-100"
                                            >
                                                <ul className="space-y-3">
                                                    {product.pros
                                                        ?.slice(0, 3)
                                                        .map((pro, i) => (
                                                            <li
                                                                key={i}
                                                                className="flex items-start gap-2 text-[10px] font-bold text-slate-600 uppercase leading-tight"
                                                            >
                                                                <div className="w-1.5 h-1.5 bg-blue-600 shrink-0 mt-0.5" />
                                                                {pro}
                                                            </li>
                                                        ))}
                                                </ul>
                                            </td>
                                        ))}
                                    </tr>

                                    {/* Action Row */}
                                    <tr className="bg-white">
                                        <td className="p-6 border-r border-slate-100"></td>
                                        {topProducts.map((product) => (
                                            <td
                                                key={product.id}
                                                className="p-8 border-r border-slate-100"
                                            >
                                                <Link
                                                    href={`/registry/${product.slug}`}
                                                    className="flex items-center justify-center gap-3 w-full bg-slate-950 text-white py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-[4px_4px_0px_0px_rgba(59,130,246,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                                                >
                                                    Full_Report{" "}
                                                    <ArrowRight className="w-3 h-3" />
                                                </Link>
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="py-32 flex flex-col items-center justify-center border-2 border-slate-950 border-dashed rounded-none">
                        <Database className="w-8 h-8 text-slate-200 mb-4 animate-pulse" />
                        <p className="font-mono text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                            Awaiting_Database_Sync...
                        </p>
                    </div>
                )}

                {/* 3. Bottom CTA: 深度链接 */}
                <section className="mt-24 grid md:grid-cols-2 gap-8">
                    <div className="bg-slate-950 p-12 relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="text-white text-3xl font-[1000] uppercase italic mb-4">
                                Precision <br /> Matching
                            </h3>
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-tight mb-8">
                                Execute biometric scan to determine optimal
                                model.
                            </p>
                            <Link
                                href="/quiz"
                                className="inline-flex items-center gap-4 text-blue-400 font-black text-[10px] uppercase tracking-[0.3em] hover:text-white transition-colors"
                            >
                                Start_Analysis{" "}
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                        <Sparkles className="absolute -right-8 -bottom-8 w-40 h-40 text-white/5 group-hover:text-blue-600/10 transition-colors duration-700" />
                    </div>

                    <div className="border-4 border-slate-950 p-12 flex flex-col justify-between">
                        <div>
                            <ShieldCheck className="w-10 h-10 text-blue-600 mb-6" />
                            <h3 className="text-slate-950 text-3xl font-[1000] uppercase italic mb-4">
                                Verified <br /> Integrity
                            </h3>
                            <p className="text-slate-500 text-[10px] font-mono font-bold uppercase leading-relaxed">
                                All metrics derived from sensor-based physical
                                testing. Methodology version 4.0 // No editorial
                                bias.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    )
}
