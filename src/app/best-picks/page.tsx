import { Metadata } from "next"
import Link from "next/link"
import { getAutomatedRegistry } from "@/lib/registry"
import { ProductCard } from "@/components/product-card"
import {
    Activity,
    ArrowRight,
    Database,
    Fingerprint,
    ShieldCheck
} from "lucide-react"

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
        <main className="relative min-h-screen bg-white pt-20 md:pt-32 pb-20 overflow-x-hidden">
            {/* 注入结构化数据 */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* 背景层：优化移动端背景显示 */}
            <div
                className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
                style={{
                    backgroundImage:
                        "radial-gradient(#000 1px, transparent 1px)",
                    backgroundSize: "20px 20px"
                }}
            />

            <div className="container mx-auto px-5 md:px-6 relative z-10">
                {/* --- 1. Header: 终端感标题优化 --- */}
                <header className="max-w-5xl mb-16 md:mb-24">
                    <div className="flex items-center gap-2 md:gap-3 text-blue-600 font-black text-[8px] md:text-[9px] uppercase tracking-[0.3em] md:tracking-[0.4em] mb-4 md:mb-6">
                        <Database className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        Audit_Registry_v26.1
                    </div>

                    {/* 修复：使用 vw 单位确保超大标题在手机端按比例缩放不溢出 */}
                    <h1 className="text-[12vw] sm:text-7xl md:text-9xl font-[1000] tracking-tighter uppercase leading-[0.85] mb-8 italic break-words">
                        The{" "}
                        <span className="text-blue-600 not-italic">Elite_</span>{" "}
                        <br />
                        Selection.
                    </h1>

                    <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8 py-6 md:py-8 border-y border-slate-100">
                        <p className="flex-1 text-[11px] md:text-sm font-mono font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                            Data-driven mattress calibration. Ranking derived
                            from sensor-array feedback. Updated every 3600s.
                        </p>
                        <div className="flex gap-8 md:gap-10 border-t md:border-t-0 pt-6 md:pt-0">
                            <div className="flex flex-col">
                                <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Active_Trials
                                </span>
                                <span className="text-xl md:text-2xl font-mono font-bold">
                                    142
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Trust_Index
                                </span>
                                <span className="text-xl md:text-2xl font-mono font-bold text-emerald-500">
                                    99.8%
                                </span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* --- 2. Scoring Protocol Grid: 响应式网格优化 --- */}
                <section className="mb-16 md:mb-24">
                    <div className="bg-slate-950 text-white p-8 md:p-16 relative overflow-hidden rounded-[1.5rem] md:rounded-[2rem]">
                        <div className="absolute -bottom-6 -right-6 md:top-0 md:right-0 p-8 opacity-10">
                            <Fingerprint className="w-24 h-24 md:w-32 md:h-32" />
                        </div>
                        <h2 className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.3em] text-blue-400 mb-8 md:mb-12">
                            Scoring_Logic_Protocols
                        </h2>

                        {/* 修复：移动端从 1 列改为 2 列紧凑布局，PC 保持 4 列 */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8 md:gap-12 relative z-10">
                            {[
                                {
                                    label: "Spinal_Axis",
                                    val: "Support",
                                    desc: "Digital mapping."
                                },
                                {
                                    label: "Thermal_Flow",
                                    val: "Cooling",
                                    desc: "BTU dissipation."
                                },
                                {
                                    label: "Mass_Transfer",
                                    val: "Motion",
                                    desc: "Kinetic energy."
                                },
                                {
                                    label: "Emission_Spec",
                                    val: "Safety",
                                    desc: "VOC sensor audit."
                                }
                            ].map((spec, i) => (
                                <div key={i} className="space-y-2 md:space-y-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-1 bg-blue-500" />
                                        <span className="text-[7px] md:text-[9px] font-mono text-slate-500 uppercase font-bold tracking-widest truncate">
                                            {spec.label}
                                        </span>
                                    </div>
                                    <h3 className="text-base md:text-xl font-black uppercase tracking-tight">
                                        {spec.val}
                                    </h3>
                                    <p className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase leading-tight md:leading-relaxed">
                                        {spec.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* --- 3. Champion Tier (#01 Highlight) --- */}
                {sortedProducts.length > 0 && (
                    <section className="mb-24 md:mb-32">
                        <div className="flex items-center gap-4 mb-10 md:mb-12">
                            <div className="h-px flex-1 bg-slate-100" />
                            <span className="text-[8px] md:text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] whitespace-nowrap">
                                Market_Leader_Detected
                            </span>
                            <div className="h-px flex-1 bg-slate-100" />
                        </div>
                        <div className="relative group mx-1 md:mx-0">
                            {/* 修复：缩小移动端标签尺寸，防止遮挡过载 */}
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30 bg-blue-600 text-white px-4 md:px-6 py-1.5 md:py-2 font-black text-[8px] md:text-[10px] uppercase tracking-[0.2em] italic shadow-xl whitespace-nowrap">
                                #01 Recommendation
                            </div>
                            <div className="border-2 md:border-4 border-blue-600 p-1 md:p-2 transition-all rounded-[1.5rem] md:rounded-none">
                                <ProductCard data={sortedProducts[0]} />
                            </div>
                        </div>
                    </section>
                )}

                {/* --- 4. The Registry Grid --- */}
                <section className="mb-24 md:mb-32">
                    <div className="flex items-end justify-between mb-10 md:mb-16 border-b border-slate-900 pb-4 md:pb-6">
                        <h2 className="text-2xl md:text-4xl font-[1000] uppercase italic tracking-tighter">
                            The_Registry
                        </h2>
                        <div className="flex items-center gap-2 text-[8px] md:text-[10px] font-black uppercase text-slate-400">
                            <Activity className="w-2.5 h-2.5 md:w-3 md:h-3 text-emerald-500 animate-pulse" />
                            <span className="hidden xs:inline">
                                Live_Feed_Active
                            </span>
                            <span className="xs:inline text-emerald-500 font-bold sm:hidden">
                                LIVE
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-12">
                        {sortedProducts.slice(1).map((product, index) => (
                            <div
                                key={product.id}
                                className="relative group px-1 md:px-0"
                            >
                                {/* 修复：在移动端将索引数字移至内部 left-0，防止原本的 -left-4 导致元素超出屏幕 */}
                                <div className="absolute -top-3 left-0 md:-top-4 md:-left-4 z-20 bg-white border border-slate-200 text-slate-900 w-8 h-8 md:w-10 md:h-10 flex items-center justify-center font-mono font-bold text-[10px] md:text-xs shadow-sm rounded-full md:rounded-none">
                                    {index + 2}
                                </div>
                                <ProductCard data={product} />
                            </div>
                        ))}
                    </div>
                </section>

                {/* --- 5. Authority Disclosure --- */}
                <footer className="mt-20 md:mt-40 border-t-2 border-slate-100 pt-16 md:pt-20">
                    <div className="grid lg:grid-cols-2 gap-12 md:gap-20 px-1">
                        <div>
                            <div className="flex items-center gap-3 mb-4 md:mb-6">
                                <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />
                                <h4 className="text-[11px] md:text-sm font-black uppercase tracking-widest">
                                    Audit Transparency
                                </h4>
                            </div>
                            <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase leading-relaxed tracking-tight">
                                Our rankings are derived from objective lab
                                measurements. Revenue is generated via affiliate
                                commissions which fund our equipment.
                            </p>
                        </div>
                        <div className="flex flex-col items-start lg:items-end justify-center pt-8 border-t border-slate-50 lg:border-t-0 lg:pt-0">
                            <Link
                                href="/quiz"
                                className="group w-full md:w-auto"
                            >
                                <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block lg:text-right">
                                    Personalized calibration
                                </span>
                                <div className="text-xl md:text-3xl font-[1000] uppercase italic group-hover:text-blue-600 transition-colors flex items-center gap-3 justify-between md:justify-end">
                                    Execute_Match{" "}
                                    <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
                                </div>
                            </Link>
                        </div>
                    </div>
                </footer>
            </div>
        </main>
    )
}
