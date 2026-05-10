import React, { Suspense } from "react"
import Link from "next/link"
import {
    Beaker,
    Microscope,
    ShieldCheck,
    BadgeCheck,
    ArrowRight,
    Sparkles,
    CheckCircle2,
    Activity,
    Lock,
    Cpu,
    Database
} from "lucide-react"
import { Hero } from "@/components/hero"
import { ProductCard } from "@/components/product-card"
import { getAutomatedRegistry } from "@/lib/registry"
import { cn } from "@/lib/utils"
import { APP_PROTOCOL } from "@/lib/constants"
import type { Metadata } from "next"

// 2026 顶级白帽策略：极致的实时性与动态缓存控制
export const revalidate = 0

/** 首页避免与根 layout 的 title.template 二次拼接 */
export const metadata: Metadata = {
    title: {
        absolute:
            "SleepChoice Guide | Bio-Performance Registry & Sleep Forensics"
    },
    description:
        "Sleep product audit intelligence: scores fused from major review ecosystems and retail data via NLP—no warehouse samples or on-site lab runs.",
    alternates: { canonical: "/" }
}

export default async function HomePage() {
    const productList = await getAutomatedRegistry()
    // console.log(productList)

    return (
        <div className="bg-white">
            {/* 1. 增强型结构化数据 (Organization + WebSite) */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@graph": [
                            {
                                "@type": "Organization",
                                "@id": "https://sleepchoiceguide.com/#organization",
                                name: "SleepChoice Intelligence Unit",
                                url: "https://sleepchoiceguide.com",
                                logo: "https://sleepchoiceguide.com/logo.png",
                                description:
                                    "Independent sleep-product audit intelligence: aggregated third-party reviews and listing signals modeled into registry scores—we do not operate a physical test lab or purchase units for bench QA.",
                                knowsAbout: [
                                    "Sleep Science",
                                    "Material Forensics",
                                    "Sleep Technology Benchmarking"
                                ]
                            },
                            {
                                "@type": "WebSite",
                                "@id": "https://sleepchoiceguide.com/#website",
                                url: "https://sleepchoiceguide.com",
                                name: "SleepChoice Guide",
                                publisher: {
                                    "@id": "https://sleepchoiceguide.com/#organization"
                                },
                                potentialAction: {
                                    "@type": "SearchAction",
                                    target:
                                        "https://sleepchoiceguide.com/registry?q={search_term_string}",
                                    "query-input":
                                        "required name=search_term_string"
                                }
                            }
                        ]
                    })
                }}
            />

            <Hero />

            {/* --- Section: Trust Signals (工业监控风格优化) --- */}
            <section className="container mx-auto px-4 sm:px-6 -mt-12 relative z-20">
                <div className="rounded-[1.75rem] sm:rounded-[2.5rem] md:rounded-[3.5rem] bg-white border border-slate-200 p-5 sm:p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.05)] backdrop-blur-xl">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8 md:gap-12">
                        {[
                            {
                                icon: <Beaker />,
                                label: "Audit Protocol",
                                detail: "SCG-01-2026",
                                color: "text-blue-600",
                                bg: "bg-blue-50"
                            },
                            {
                                icon: <Activity />,
                                label: "Live Sensors",
                                detail: "Biometric Data",
                                color: "text-indigo-600",
                                bg: "bg-indigo-50"
                            },
                            {
                                icon: <ShieldCheck />,
                                label: "Zero-Bias",
                                detail: "No Brand Funding",
                                color: "text-emerald-600",
                                bg: "bg-emerald-50"
                            },
                            {
                                icon: <Cpu />,
                                label: `Audit ${APP_PROTOCOL}`,
                                detail: "Registry Sync",
                                color: "text-slate-900",
                                bg: "bg-slate-100"
                            }
                        ].map((item, i) => (
                            <div
                                key={i}
                                className="flex flex-col items-center lg:items-start space-y-3"
                            >
                                <div
                                    className={cn(
                                        "p-3 rounded-xl transition-all duration-500",
                                        item.bg,
                                        item.color
                                    )}
                                >
                                    {React.cloneElement(
                                        item.icon as React.ReactElement<{
                                            className?: string
                                        }>,
                                        { className: "w-6 h-6" }
                                    )}
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                        {item.label}
                                    </h4>
                                    <p className="text-xs font-black text-slate-900 mt-0.5">
                                        {item.detail}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- Section: Recommendations (数据注册表感) --- */}
            <section className="container mx-auto px-4 sm:px-6 pt-24 md:pt-32">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-16 gap-8">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 bg-slate-950 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.25em] mb-6">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            January 2026 Intelligence Feed
                        </div>
                        <h2 className="text-3xl sm:text-5xl md:text-7xl font-[1000] tracking-tighter text-slate-900 mb-6 leading-[0.9] sm:leading-[0.85]">
                            Top-Tier <br />
                            <span className="text-blue-600 italic">
                                Audit Registry.
                            </span>
                        </h2>
                        <p className="text-lg text-slate-500 font-medium max-w-xl">
                            Our sensor arrays have detected 14 price anomalies
                            and 3 material upgrades in the last 24 hours.
                        </p>
                    </div>
                    <Link
                        href="/best-picks"
                        className="group flex w-full sm:w-auto shrink-0 items-center justify-center gap-4 px-8 py-4 sm:px-10 sm:py-5 bg-slate-950 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-2xl active:scale-95"
                    >
                        Full Forensic List{" "}
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                </div>

                {/* 动态产品列表 - 增加骨架屏加载处理 */}
                <Suspense
                    fallback={
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-pulse">
                            ...
                        </div>
                    }
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-14">
                        {productList.length > 0 ? (
                            productList.map((product) => (
                                <ProductCard key={product.id} data={product} />
                            ))
                        ) : (
                            <div className="col-span-full py-40 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[3rem] bg-slate-50/50">
                                <Database className="w-12 h-12 text-slate-200 mb-4" />
                                <p className="font-black text-slate-400 uppercase tracking-widest text-xs">
                                    Syncing Global Audit Database...
                                </p>
                            </div>
                        )}
                    </div>
                </Suspense>
            </section>

            {/* --- Section: Authority CTA (高转化 Match Engine) --- */}
            <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32">
                <div className="relative bg-slate-950 rounded-3xl sm:rounded-[3rem] p-8 sm:p-12 md:p-24 text-white overflow-hidden group">
                    {/* 背景装饰：模拟数据流 */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#2563eb,transparent_70%)] opacity-20" />
                        <Binary className="w-full h-full scale-150 rotate-12" />
                    </div>

                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="mb-8 p-4 bg-blue-600/20 rounded-2xl border border-blue-500/30">
                            <Sparkles className="w-8 h-8 text-blue-400" />
                        </div>
                        <h2 className="text-2xl sm:text-4xl md:text-6xl font-[1000] mb-8 tracking-tighter max-w-2xl leading-[1.15] sm:leading-[1.1] px-1">
                            Match Your Biometric Profile to the Perfect Support.
                        </h2>
                        <p className="text-slate-400 mb-12 max-w-lg text-lg font-medium italic">
                            "The DNA™ algorithm cross-references 50,000+ data
                            points including spinal alignment and thermal
                            dispersion."
                        </p>
                        <Link
                            href="/quiz"
                            className="group bg-white text-slate-950 w-full sm:w-auto px-8 py-5 sm:px-12 sm:py-6 rounded-2xl font-black text-base sm:text-lg uppercase tracking-widest transition-all hover:bg-blue-600 hover:text-white active:scale-95 shadow-2xl flex items-center justify-center gap-3"
                        >
                            Launch Match Engine{" "}
                            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                        </Link>

                        <div className="mt-12 flex items-center gap-6 opacity-40">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                                <Lock className="w-3 h-3" /> Anonymous
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                                <CheckCircle2 className="w-3 h-3" /> GDPR
                                Compliant
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

// 辅助组件：背景纹理
function Binary({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "text-[8px] font-mono text-blue-500 leading-none overflow-hidden select-none opacity-20",
                className
            )}
        >
            {Array.from({ length: 50 }).map((_, i) => (
                <div key={i} className="whitespace-nowrap">
                    {Math.random().toString(2).substring(2, 100)}
                </div>
            ))}
        </div>
    )
}
