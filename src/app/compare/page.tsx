import Link from "next/link"
import { getAutomatedRegistry } from "@/lib/registry"
import {
    TrendingUp,
    CheckCircle2,
    ArrowRight,
    Database,
    ShieldCheck,
    Cpu,
    Fingerprint,
    Search
} from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_PROTOCOL } from "@/lib/constants"

export const metadata = {
    title: "Technical Benchmarks | Side-by-Side Audit",
    description:
        "Algorithmic mattress comparison based on 1.2M+ consumer data points and material simulations."
}

// 建议每小时重新验证数据
export const revalidate = 3600

export default async function ComparePage() {
    // 获取数据，提供空数组作为保底
    const products = (await getAutomatedRegistry()) || []
    // 过滤掉无效数据并取前三
    const topProducts = products.filter(Boolean).slice(0, 3)

    // 安全获取对比项的最佳值
    const getBestValue = (key: string) => {
        if (topProducts.length === 0) return 0
        const values = topProducts.map((p) => {
            if (!p) return 0
            if (key === "price") return p.offers?.[0]?.price || 9999
            // 尝试从不同的可能字段读取数值
            return (
                (p.audit_scores as any)?.[key] ??
                (p.metrics as any)?.[key] ??
                (p as any)[key] ??
                0
            )
        })
        return key === "price" ? Math.min(...values) : Math.max(...values)
    }

    return (
        <main className="relative min-h-screen bg-white pt-24 pb-20 overflow-hidden font-sans">
            {/* --- 工业级审计背景 --- */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
                        backgroundSize: "50px 50px"
                    }}
                />
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent animate-[bounce_4s_infinite] opacity-20" />
            </div>

            <div className="container mx-auto px-6 relative z-10 max-w-7xl">
                {/* 1. Header */}
                <header className="max-w-4xl mb-16 border-l-4 border-blue-600 pl-8">
                    <div className="flex items-center gap-3 text-blue-600 font-black text-[9px] uppercase tracking-[0.4em] mb-4">
                        <Cpu className="w-4 h-4" />
                        {`System_Protocol: AIR_${APP_PROTOCOL}_Comparison`}
                    </div>
                    <h1 className="text-5xl md:text-8xl font-[1000] tracking-tighter uppercase leading-[0.8] mb-6 italic text-slate-950">
                        Metric <br />
                        <span className="text-blue-600 not-italic">
                            Comparison
                        </span>
                    </h1>
                    <p className="text-sm font-mono font-bold text-slate-400 uppercase tracking-widest max-w-xl leading-relaxed">
                        Synthesizing verified owner logs and material density
                        simulations to identify structural variances.
                    </p>
                </header>

                {/* 2. Comparison Table */}
                {topProducts.length >= 2 ? (
                    <div className="relative border border-slate-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="bg-slate-950 text-white">
                                        <th className="p-8 border-r border-white/10 min-w-[200px] relative overflow-hidden">
                                            <div className="flex flex-col gap-1 relative z-10">
                                                <span className="text-[10px] font-black tracking-[0.3em] text-blue-400 uppercase">
                                                    Audit_Node
                                                </span>
                                                <span className="text-xl font-black uppercase italic">
                                                    Comparison
                                                </span>
                                            </div>
                                            <Fingerprint className="absolute right-[-10%] bottom-[-10%] w-24 h-24 text-white/5" />
                                        </th>
                                        {topProducts.map((product) => (
                                            <th
                                                key={product.id}
                                                className="p-8 border-r border-white/10 min-w-[300px]"
                                            >
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">
                                                            ID:{" "}
                                                            {product.id?.substring(
                                                                0,
                                                                8
                                                            ) || "UNKNOWN"}
                                                        </span>
                                                        {product?.rating &&
                                                            product.rating >
                                                                9 && (
                                                                <div className="flex items-center gap-1 text-emerald-400 text-[8px] font-black uppercase">
                                                                    <CheckCircle2 className="w-2.5 h-2.5" />{" "}
                                                                    High_Confidence
                                                                </div>
                                                            )}
                                                    </div>
                                                    <h3 className="text-2xl font-[1000] tracking-tighter uppercase leading-none">
                                                        {product.brand}
                                                    </h3>
                                                    <div className="mt-2 inline-flex items-center px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black uppercase w-fit">
                                                        Score:{" "}
                                                        {product.rating ||
                                                            "N/A"}
                                                    </div>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody className="font-mono">
                                    {[
                                        {
                                            label: "Durability_Forecast",
                                            key: "rating"
                                        },
                                        {
                                            label: "Structural_Support",
                                            key: "support",
                                            metricKey: "support"
                                        },
                                        {
                                            label: "Thermal_Dissipation",
                                            key: "cooling",
                                            metricKey: "cooling"
                                        },
                                        {
                                            label: "Pressure_Map_Score",
                                            key: "pressure",
                                            metricKey: "pressure"
                                        },
                                        {
                                            label: "Market_Price (USD)",
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
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover/row:text-blue-600 transition-colors">
                                                        {"// "}
                                                        {row.label}
                                                    </span>
                                                </td>
                                                {topProducts.map((product) => {
                                                    // 深度防御取值逻辑
                                                    const val =
                                                        row.key === "price"
                                                            ? product
                                                                  .offers?.[0]
                                                                  ?.price
                                                            : (
                                                                  product.audit_scores as any
                                                              )?.[
                                                                  row.metricKey ||
                                                                      row.key
                                                              ] ||
                                                              (
                                                                  product.metrics as any
                                                              )?.[
                                                                  row.metricKey ||
                                                                      row.key
                                                              ] ||
                                                              0

                                                    const isBest =
                                                        val !== 0 &&
                                                        val === bestVal

                                                    return (
                                                        <td
                                                            key={product.id}
                                                            className={cn(
                                                                "p-8 text-center border-r border-slate-100 relative",
                                                                isBest &&
                                                                    "bg-blue-50/20"
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
                                                                        ? `$${(val || 0).toLocaleString()}`
                                                                        : typeof val ===
                                                                            "number"
                                                                          ? val.toFixed(
                                                                                1
                                                                            )
                                                                          : "0.0"}
                                                                </span>
                                                                {isBest && (
                                                                    <div className="flex items-center gap-1 text-[8px] font-black uppercase text-blue-500">
                                                                        <TrendingUp className="w-2 h-2" />{" "}
                                                                        Peak_Val
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        )
                                    })}

                                    {/* 核心卖点对照 */}
                                    <tr className="border-b border-slate-100">
                                        <td className="p-6 border-r border-slate-100">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                {"// "}Key_Insights
                                            </span>
                                        </td>
                                        {topProducts.map((product) => (
                                            <td
                                                key={product.id}
                                                className="p-8 border-r border-slate-100"
                                            >
                                                <ul className="space-y-3">
                                                    {(product.pros || [])
                                                        .slice(0, 2)
                                                        .map((pro, i) => (
                                                            <li
                                                                key={i}
                                                                className="flex items-start gap-2 text-[9px] font-bold text-slate-500 uppercase leading-tight italic"
                                                            >
                                                                <Search className="w-3 h-3 text-blue-600 shrink-0" />
                                                                {pro}
                                                            </li>
                                                        ))}
                                                </ul>
                                            </td>
                                        ))}
                                    </tr>

                                    {/* Action Row */}
                                    <tr className="bg-white">
                                        <td className="p-6 border-r border-slate-100 bg-slate-50/50"></td>
                                        {topProducts.map((product) => (
                                            <td
                                                key={product.id}
                                                className="p-8 border-r border-slate-100"
                                            >
                                                <Link
                                                    href={`/registry/${product.slug}`}
                                                    className="flex items-center justify-center gap-3 w-full bg-slate-950 text-white py-5 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-[4px_4px_0px_0px_rgba(37,99,235,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                                                >
                                                    View_Full_Audit{" "}
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
                            Registry_Data_Insufficient_For_Comparison
                        </p>
                    </div>
                )}

                {/* 3. Bottom Utility */}
                <section className="mt-24 grid md:grid-cols-2 gap-8">
                    <Link
                        href="/quiz"
                        className="bg-slate-950 p-12 relative overflow-hidden group transition-all hover:ring-2 hover:ring-blue-600/50"
                    >
                        <div className="relative z-10">
                            <h3 className="text-white text-3xl font-[1000] uppercase italic mb-4 leading-none">
                                Biometric <br /> Logic_Match
                            </h3>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-8">
                                Cross-reference your body profile against our
                                registry.
                            </p>
                            <span className="inline-flex items-center gap-4 text-blue-400 font-black text-[10px] uppercase tracking-[0.3em] group-hover:text-white transition-colors">
                                Execute_Scan <ArrowRight className="w-4 h-4" />
                            </span>
                        </div>
                        <Cpu className="absolute -right-8 -bottom-8 w-40 h-40 text-white/5 group-hover:text-blue-600/10 transition-colors duration-700" />
                    </Link>

                    <div className="border-4 border-slate-950 p-12 flex flex-col justify-between">
                        <div>
                            <ShieldCheck className="w-10 h-10 text-blue-600 mb-6" />
                            <h3 className="text-slate-950 text-3xl font-[1000] uppercase italic mb-4 leading-none">
                                Audit <br /> Integrity
                            </h3>
                            <p className="text-slate-500 text-[10px] font-mono font-bold uppercase leading-relaxed mb-6">
                                Data synthesized via Automated Intelligence
                                Registry (A.I.R). 0% direct brand sponsorship
                                influence.
                            </p>
                            <Link
                                href="/disclosure"
                                className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline decoration-2 underline-offset-4"
                            >
                                [View_Affiliate_Disclosure_Dossier]
                            </Link>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    )
}
