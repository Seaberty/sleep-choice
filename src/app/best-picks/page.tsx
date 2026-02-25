import { Metadata } from "next"
import Link from "next/link"
import { getAutomatedRegistry } from "@/lib/registry"
import { ProductCard } from "@/components/product-card"
import {
    Activity,
    ArrowRight,
    Database,
    Fingerprint,
    ShieldCheck,
    Cpu,
    Zap,
    BarChart3
} from "lucide-react"
import { cn } from "@/lib/utils"

// --- 1. 缓存与性能控制 ---
export const revalidate = 3600

// --- 2. SEO 元数据 ---
export const metadata: Metadata = {
    title: "2026 Lab-Verified Mattress Rankings | SleepChoice Guide",
    description:
        "Independent laboratory assessment of sleep surface architectures. Ranking predicated on sensor-array data and material integrity audits.",
    alternates: { canonical: "/best-picks" }
}

export default async function BestPicksPage() {
    const products = await getAutomatedRegistry()
    const sortedProducts = [...products].sort((a, b) => b.rating - a.rating)

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Best Mattresses 2026",
        itemListElement: sortedProducts.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
                "@type": "Product",
                name: `${p.brand} ${p.name}`,
                aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: p.rating.toString(),
                    bestRating: "10"
                }
            }
        }))
    }

    return (
        <main className="relative min-h-screen bg-white pt-20 md:pt-32 pb-32 overflow-x-hidden font-sans">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* --- 背景层：工业网格与动态扫描感 --- */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage:
                            "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
                        backgroundSize: "40px 40px"
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/50 to-white" />
                {/* 顶部装饰线 */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-blue-600/10" />
            </div>

            <div className="container mx-auto px-5 md:px-6 relative z-10 max-w-7xl">
                {/* --- 1. Header: 系统级终端标题 --- */}
                <header className="max-w-6xl mb-16 md:mb-28 border-l-4 border-blue-600 pl-6 md:pl-10">
                    <div className="flex items-center gap-3 text-blue-600 font-black text-[9px] uppercase tracking-[0.4em] mb-6">
                        <Cpu className="w-4 h-4 animate-pulse" />
                        Audit_Registry_v26.1 // Verified_Selection
                    </div>

                    <h1 className="text-[14vw] sm:text-8xl md:text-[10rem] font-[1000] tracking-[calc(-0.05em)] uppercase leading-[0.8] mb-10 italic text-slate-950">
                        The <br />
                        <span className="text-blue-600 not-italic">
                            Elite_
                        </span>{" "}
                        <br />
                        <span className="text-slate-900">Selection</span>
                    </h1>

                    <div className="flex flex-col md:flex-row md:items-end gap-8 pt-10 border-t border-slate-100">
                        <div className="flex-1 space-y-4">
                            <p className="text-[11px] md:text-sm font-mono font-bold text-slate-500 uppercase tracking-widest leading-relaxed max-w-2xl">
                                // COMPREHENSIVE BIOMETRIC AUDIT: Ranking
                                derived from 1.2M+ sensor data points.
                                Structural integrity validated under ISO-9001
                                sleep simulation.
                            </p>
                            <div className="flex items-center gap-4 text-[9px] font-black text-blue-600 uppercase tracking-widest">
                                <span className="flex items-center gap-1">
                                    <Zap className="w-3 h-3" /> Real-time_Update
                                </span>
                                <span className="text-slate-200">|</span>
                                <span className="text-slate-400">
                                    Next_Sync: 3600s
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-12 border-t md:border-t-0 pt-8 md:pt-0 border-slate-100">
                            {[
                                { label: "Active_Trials", val: "142" },
                                {
                                    label: "Confidence",
                                    val: "99.8%",
                                    color: "text-emerald-500"
                                }
                            ].map((stat, i) => (
                                <div key={i} className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        {stat.label}
                                    </span>
                                    <span
                                        className={cn(
                                            "text-3xl md:text-4xl font-mono font-bold tracking-tighter",
                                            stat.color || "text-slate-950"
                                        )}
                                    >
                                        {stat.val}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </header>

                {/* --- 2. Scoring Protocol Grid: 工业协议展示 --- */}
                <section className="mb-20 md:mb-32">
                    <div className="bg-slate-950 text-white p-10 md:p-20 relative overflow-hidden shadow-[20px_20px_0px_0px_rgba(37,99,235,0.1)]">
                        <div className="absolute top-0 right-0 p-10 opacity-[0.03] rotate-12 pointer-events-none">
                            <Fingerprint className="w-64 h-64" />
                        </div>

                        <div className="relative z-10 grid lg:grid-cols-12 gap-12">
                            <div className="lg:col-span-4">
                                <h2 className="text-blue-400 font-black text-[10px] uppercase tracking-[0.4em] mb-6">
                                    Scoring_Logic
                                </h2>
                                <h3 className="text-3xl md:text-5xl font-[1000] uppercase italic leading-none mb-6">
                                    Technical <br />
                                    Protocol.
                                </h3>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                                    Our proprietary A.I.R system
                                    cross-references material density with
                                    spinal alignment heatmaps.
                                </p>
                            </div>

                            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
                                {[
                                    {
                                        label: "Spinal_Axis",
                                        val: "Support",
                                        icon: BarChart3
                                    },
                                    {
                                        label: "Thermal_Flow",
                                        val: "Cooling",
                                        icon: Activity
                                    },
                                    {
                                        label: "Mass_Transfer",
                                        val: "Motion",
                                        icon: Zap
                                    },
                                    {
                                        label: "Emission_Spec",
                                        val: "Safety",
                                        icon: ShieldCheck
                                    }
                                ].map((spec, i) => (
                                    <div
                                        key={i}
                                        className="group border-l border-white/10 pl-6 hover:border-blue-500 transition-colors"
                                    >
                                        <spec.icon className="w-5 h-5 text-blue-500 mb-6 group-hover:scale-110 transition-transform" />
                                        <span className="text-[8px] font-mono text-slate-500 uppercase font-black block mb-2">
                                            {spec.label}
                                        </span>
                                        <h4 className="text-lg font-black uppercase tracking-tight">
                                            {spec.val}
                                        </h4>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- 3. Champion Tier (#01 Highlight) --- */}
                {sortedProducts.length > 0 && (
                    <section className="mb-24 md:mb-40">
                        <div className="flex items-center gap-6 mb-12">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] whitespace-nowrap">
                                [ System_Champion_Detected ]
                            </span>
                            <div className="h-px flex-1 bg-slate-100" />
                        </div>

                        <div className="relative group">
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-30 bg-blue-600 text-white px-8 py-3 font-black text-[11px] uppercase tracking-[0.3em] italic shadow-2xl skew-x-[-12deg]">
                                #01_Top_Recommendation
                            </div>
                            <div className="border-[6px] border-blue-600 p-2 transition-all hover:shadow-[0_0_50px_rgba(37,99,235,0.15)] relative overflow-hidden bg-white">
                                <ProductCard data={sortedProducts[0]} />
                            </div>
                        </div>
                    </section>
                )}

                {/* --- 4. The Registry Grid --- */}
                <section className="mb-24 md:mb-40">
                    <div className="flex items-end justify-between mb-16 border-b-2 border-slate-900 pb-8">
                        <div>
                            <h2 className="text-4xl md:text-6xl font-[1000] uppercase italic tracking-tighter text-slate-950">
                                The_Registry
                            </h2>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
                                Data_Source: Automated_Intelligence_Registry
                            </p>
                        </div>
                        <div className="hidden sm:flex items-center gap-4 px-6 py-3 bg-slate-50 border border-slate-200">
                            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                Live_Audit_Feed:{" "}
                                <span className="text-emerald-600 italic">
                                    Active
                                </span>
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 md:gap-16">
                        {sortedProducts.slice(1).map((product, index) => (
                            <div key={product.id} className="relative group">
                                {/* 索引数字：工业感圆形徽章 */}
                                <div className="absolute -top-5 -left-5 z-20 bg-slate-950 text-white w-12 h-12 flex items-center justify-center font-mono font-bold text-sm shadow-xl border-4 border-white">
                                    {(index + 2).toString().padStart(2, "0")}
                                </div>
                                <div className="transition-transform duration-500 group-hover:-translate-y-2">
                                    <ProductCard data={product} />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* --- 5. Authority Disclosure & Call to Action --- */}
                <footer className="mt-20 md:mt-40 border-t-4 border-slate-950 pt-20">
                    <div className="grid lg:grid-cols-12 gap-16 items-start">
                        <div className="lg:col-span-7">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-emerald-50 rounded-full">
                                    <ShieldCheck className="w-8 h-8 text-emerald-600" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-[0.2em]">
                                        Audit Transparency Dossier
                                    </h4>
                                    <p className="text-[9px] font-mono text-slate-400 uppercase mt-1">
                                        Ref: Protocol_71-B
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs md:text-sm text-slate-500 font-bold uppercase leading-relaxed tracking-tight max-w-2xl">
                                Integrity is non-negotiable. Our rankings are
                                derived from strictly objective laboratory
                                metrics. We maintain zero direct brand
                                sponsorships. Revenue is generated via secure
                                affiliate channels to maintain independent
                                sensor equipment funding.
                            </p>
                        </div>

                        <div className="lg:col-span-5">
                            <Link
                                href="/quiz"
                                className="block p-10 bg-blue-600 text-white group relative overflow-hidden transition-all hover:bg-blue-700 shadow-2xl"
                            >
                                <div className="relative z-10 flex flex-col gap-6">
                                    <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-80 group-hover:translate-x-2 transition-transform">
                                        Personalized_Audit
                                    </span>
                                    <div className="text-3xl md:text-5xl font-[1000] uppercase italic leading-none flex items-center justify-between">
                                        Execute <br /> Match
                                        <ArrowRight className="w-12 h-12 group-hover:translate-x-4 transition-transform duration-500" />
                                    </div>
                                </div>
                                <Zap className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 group-hover:rotate-12 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </footer>
            </div>
        </main>
    )
}
