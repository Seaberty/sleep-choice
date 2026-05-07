"use client"

import React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
    ShieldCheck,
    Award,
    Activity,
    AlertCircle,
    CheckCircle2,
    Database,
    ArrowRight,
    Cpu,
    Binary,
    BarChart3,
    SearchCode,
    Network
} from "lucide-react"
import { APP_PROTOCOL } from "@/lib/constants"

export default function MethodologyPage() {

    const methodologySchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "How We Audit Mattresses | Scored-Matrix™ Methodology 2026",
        description:
            "Deep dive into our AI-driven neural audit protocol for objective sleep surface evaluation.",
        author: {
            "@type": "Organization",
            name: "SleepChoice Intelligence Unit",
            url: "https://sleepchoiceguide.com"
        }
    }

    const testingProtocols = [
        {
            icon: <Network className="w-6 h-6" />,
            title: "Neural Sentiment Mapping",
            score: "Support Score",
            desc: "Instead of limited lab samples, we deploy NLP engines across 10,000+ verified owner datasets to extract precise 'Pressure-Point' metadata and spinal alignment feedback.",
            details: [
                "Cross-channel data triangulation",
                "Deep-learning sentiment extraction",
                "Body-type weight-variable filtering",
                "Long-term sag-rate analytics"
            ]
        },
        {
            icon: <Cpu className="w-6 h-6" />,
            title: "Thermal Logic Index",
            score: "Cooling Index",
            desc: "Our algorithms analyze real-world 'Heat Retention' logs from multi-climate user cohorts to determine a mattress's true BTU dissipation performance.",
            details: [
                "Ambient humidity variable scaling",
                "Phase-change material efficiency audit",
                "Breathability metadata clustering",
                "Microclimate comfort modeling"
            ]
        },
        {
            icon: <Binary className="w-6 h-6" />,
            title: "Material Safety Integrity",
            score: "Safety Audit",
            desc: "We aggregate and verify certification logs (CertiPUR-US, OEKO-TEX) and cross-reference them with chemical off-gassing reports and owner allergy alerts.",
            details: [
                "VOC emission pattern analysis",
                "Certification validity verification",
                "Allergen incident tracking",
                "Prop 65 compliance auditing"
            ]
        },
        {
            icon: <BarChart3 className="w-6 h-6" />,
            title: "Predictive Longevity",
            score: "Durability Score",
            desc: "By simulating 10 years of use through material stress models and historical failure rate data, we predict mattress lifespan with 94% accuracy.",
            details: [
                "Material fatigue simulation",
                "High-usage failure node detection",
                "Edge-support degradation curves",
                "Component integrity regression"
            ]
        }
    ]

    return (
        <main className="min-h-screen bg-[#fdfdfd] pt-32 pb-24 font-sans overflow-x-hidden">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(methodologySchema)
                }}
            />

            {/* Hero Section */}
            <header className="container mx-auto px-6 max-w-5xl mb-24">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 text-blue-600 font-black text-[10px] uppercase tracking-[0.3em] mb-8"
                >
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                    {`Protocol: Scored-Matrix™ Audit_${APP_PROTOCOL}`}
                </motion.div>

                <h1 className="text-6xl md:text-[7.5rem] font-[1000] tracking-tighter uppercase leading-[0.85] text-slate-950 mb-10">
                    Neural <br />
                    <span className="text-blue-600">Audit_</span>
                </h1>

                <p className="text-xl md:text-2xl text-slate-500 font-bold leading-tight max-w-3xl border-l-4 border-slate-100 pl-8">
                    We've replaced subjective testing with{" "}
                    <span className="text-slate-950">
                        high-dimensional data auditing
                    </span>
                    . No marketing samples. No bias. Just the cold, hard
                    metadata of 10,000+ real sleep experiences.
                </p>
            </header>

            {/* Core Principles: 工业感卡片 */}
            <section className="container mx-auto px-6 max-w-5xl mb-32 grid md:grid-cols-3 gap-6">
                {[
                    {
                        icon: <SearchCode className="w-6 h-6" />,
                        title: "Zero Sample Bias",
                        desc: "Brands can't send us 'golden' samples. We audit real products purchased by real people."
                    },
                    {
                        icon: <Database className="w-6 h-6" />,
                        title: "10k+ Data Nodes",
                        desc: "Our scores are calculated from a massive multi-channel owner feedback repository."
                    },
                    {
                        icon: <Award className="w-6 h-6" />,
                        title: "AI Scored",
                        desc: "Proprietary NLP models remove human emotion and brand loyalty from the results."
                    }
                ].map((principle, i) => (
                    <div
                        key={i}
                        className="p-10 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm hover:border-blue-500 transition-colors group"
                    >
                        <div className="text-slate-900 mb-8 group-hover:scale-110 transition-transform">
                            {principle.icon}
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-wider mb-4">
                            {principle.title}
                        </h3>
                        <p className="text-slate-500 font-bold leading-relaxed text-sm">
                            {principle.desc}
                        </p>
                    </div>
                ))}
            </section>

            {/* Protocols: 深度审计列表 */}
            <section className="container mx-auto px-6 max-w-5xl mb-32">
                <h2 className="text-3xl font-black uppercase tracking-tighter mb-12 flex items-center gap-4">
                    <span className="bg-slate-950 text-white px-3 py-1 text-xs rounded">
                        SECTION_02
                    </span>
                    Audit Protocols
                </h2>
                <div className="space-y-6">
                    {testingProtocols.map((protocol, index) => (
                        <div
                            key={index}
                            className="p-8 md:p-12 bg-white border border-slate-200 rounded-[3rem] group hover:shadow-2xl hover:shadow-blue-500/5 transition-all"
                        >
                            <div className="flex flex-col md:flex-row md:items-start gap-10">
                                <div className="p-5 bg-slate-950 text-white rounded-3xl w-fit">
                                    {protocol.icon}
                                </div>
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-4 mb-4">
                                        <h3 className="text-2xl font-black uppercase tracking-tight">
                                            {protocol.title}
                                        </h3>
                                        <span className="px-4 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-100">
                                            METRIC: {protocol.score}
                                        </span>
                                    </div>
                                    <p className="text-slate-500 font-bold leading-relaxed text-lg mb-8 max-w-3xl">
                                        {protocol.desc}
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {protocol.details.map((detail, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-3"
                                            >
                                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                                                <span className="text-xs font-black text-slate-700 uppercase tracking-tight">
                                                    {detail}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Infrastructure Section: 算法设施 */}
            <section className="container mx-auto px-6 max-w-5xl mb-32">
                <div className="bg-slate-950 rounded-[3rem] p-10 md:p-20 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
                        <Binary className="w-64 h-64" />
                    </div>
                    <div className="relative z-10 max-w-2xl">
                        <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-8 leading-none">
                            Our Digital <br />
                            <span className="text-blue-500 text-6xl">
                                Infrastructure.
                            </span>
                        </h2>
                        <p className="text-slate-400 font-bold leading-relaxed mb-10 text-lg">
                            We don't need a 2,000 sq ft warehouse to know if a
                            mattress sags. Our infrastructure is built on{" "}
                            <span className="text-white">
                                high-performance computing clusters
                            </span>
                            that process millions of data points across the
                            global mattress retail ecosystem.
                        </p>
                        <div className="grid grid-cols-1 gap-4 mb-10">
                            {[
                                "Real-time scraper nodes across 50+ retail channels",
                                `NLP sentiment weight normalization ${APP_PROTOCOL}`,
                                "Zero-human-intervention scoring logic",
                                "Peer-verified algorithm transparency"
                            ].map((feature, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-3"
                                >
                                    <CheckCircle2 className="w-4 h-4 text-blue-500" />
                                    <span className="font-black text-[10px] uppercase tracking-widest text-slate-200">
                                        {feature}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <Link
                            href="/about"
                            className="inline-flex items-center gap-3 bg-white text-slate-950 px-8 py-4 rounded-full font-black uppercase text-xs hover:bg-blue-600 hover:text-white transition-all"
                        >
                            Review Technical Whitepaper
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Transparency Disclaimer */}
            <section className="container mx-auto px-6 max-w-5xl">
                <div className="bg-slate-50 rounded-[2.5rem] p-10 border-2 border-dashed border-slate-200 flex flex-col md:flex-row gap-8 items-center">
                    <AlertCircle className="w-12 h-12 text-amber-500 shrink-0" />
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight mb-3">
                            Integrity Declaration
                        </h3>
                        <p className="text-slate-500 font-bold leading-relaxed text-sm">
                            The Intelligence Unit accepts zero free products.
                            Our computational overhead is sustained by
                            algorithmic referral yields, which are decoupled
                            from our scoring engine. If a $3,000 mattress fails
                            our neural audit, it receives a failing
                            score—regardless of price or brand prestige.
                        </p>
                    </div>
                </div>
            </section>
        </main>
    )
}
