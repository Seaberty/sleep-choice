"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
    Scale,
    ShieldAlert,
    FileText,
    Globe,
    Fingerprint,
    CheckCircle2,
    AlertTriangle,
    Copy,
    CheckCheck,
    LayoutList,
    Cpu,
    Activity
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function TermsPage() {
    // 动态生成版本号，例如 REV_FEB_2026
    const lastUpdated = new Date()
        .toLocaleString("en-US", { month: "short", year: "numeric" })
        .toUpperCase()
        .replace(" ", "_")
    const [copied, setCopied] = React.useState(false)
    const [activeSection, setActiveSection] = React.useState("")

    const copyEmail = () => {
        navigator.clipboard.writeText("legal@sleepchoiceguide.com")
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const sections = React.useMemo(
        () => [
            {
                id: "neural-audit",
                icon: <Fingerprint className="w-5 h-5" />,
                title: "01. Neural_Audit_Integrity",
                content:
                    "SleepChoice Intelligence Unit operates as a high-dimensional data research node. Our 'Verified' scores are derived from proprietary Scored-Matrix™ algorithms, which audit 10,000+ anonymized owner feedback data points using natural language processing (NLP) to bypass editorial bias."
            },
            {
                id: "affiliate",
                icon: <ShieldAlert className="w-5 h-5" />,
                title: "02. Affiliate_Protocol",
                content:
                    "In alignment with FTC directive 16 CFR Part 255, we disclose that this facility receives referral compensation. These 'Arbitrage Yields' fund our computational overhead and ensure the Scored-Matrix™ neural engines remain strictly independent of brand sponsorships."
            },
            {
                id: "ip-assets",
                icon: <Cpu className="w-5 h-5" />,
                title: "03. Data_Intellectual_Property",
                content:
                    "All proprietary metrics, including sentiment heatmaps, 'Sleep Score' coefficients, and Scored-Matrix™ weight distributions, are protected digital assets of the Intelligence Unit. Unauthorized reproduction is flagged as a protocol violation."
            },
            {
                id: "conduct",
                icon: <Activity className="w-5 h-5" />,
                title: "04. Extraction_Prohibition",
                content:
                    "Users are strictly prohibited from deploying automated extraction bots, scrapers, or neural network training scripts against our performance index. We enforce a zero-tolerance policy for data harvesting."
            }
        ],
        []
    )

    React.useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) setActiveSection(entry.target.id)
                })
            },
            { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
        )
        sections.forEach((s) => {
            const el = document.getElementById(s.id)
            if (el) observer.observe(el)
        })
        return () => observer.disconnect()
    }, [sections])

    return (
        <main className="min-h-screen bg-[#fdfdfd] pt-20 md:pt-32 pb-24 relative overflow-x-hidden w-full font-sans">
            {/* 1. 背景水印：确保不撑开宽度 */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.01] select-none z-0 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] h-full">
                    {[...Array(8)].map((_, i) => (
                        <div
                            key={i}
                            className="flex justify-around mb-40 uppercase tracking-[1em] rotate-12 font-mono text-[9px] whitespace-nowrap"
                        >
                            <span>LEGAL_PROTOCOL_V4.2</span>
                            <span>INTEL_UNIT_ENCRYPTED</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. 移动端快捷导航 */}
            <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm">
                <div className="bg-slate-950/95 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl flex items-center justify-between text-white">
                    <div className="flex items-center gap-2 pl-2 overflow-hidden">
                        <LayoutList className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="text-[9px] font-black uppercase tracking-tight truncate">
                            {activeSection
                                ? activeSection.toUpperCase().replace("-", "_")
                                : "INDEX"}
                        </span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        {sections.map((s, idx) => (
                            <button
                                key={s.id}
                                onClick={() =>
                                    document
                                        .getElementById(s.id)
                                        ?.scrollIntoView({ behavior: "smooth" })
                                }
                                className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all text-[10px] font-bold",
                                    activeSection === s.id
                                        ? "bg-blue-600"
                                        : "bg-white/5"
                                )}
                            >
                                {idx + 1}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-5 md:px-6 max-w-7xl relative z-10">
                {/* Header Section */}
                <header className="max-w-5xl mb-16 md:mb-24">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded-md mb-6 shadow-lg"
                    >
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span className="text-[9px] font-black uppercase tracking-widest">
                            Legal_Binding
                        </span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[clamp(2.5rem,10vw,8rem)] font-[1000] tracking-tighter uppercase mb-6 leading-[0.9] text-slate-950 break-words"
                    >
                        Terms of <br />
                        <span className="text-blue-600">Service.</span>
                    </motion.h1>

                    <div className="flex flex-wrap items-center gap-3 text-slate-500 font-mono text-[9px] uppercase">
                        <div className="flex items-center gap-2 text-slate-950 font-sans font-black bg-slate-100 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />{" "}
                            STATUS: ACTIVE
                        </div>
                        <span className="opacity-30">/</span>
                        <div className="tracking-tighter">
                            REV_{lastUpdated}
                        </div>
                    </div>
                </header>

                <div className="grid lg:grid-cols-12 gap-10 items-start">
                    {/* PC Navigation Sidebar */}
                    <aside className="lg:col-span-4 hidden lg:block sticky top-32">
                        <div className="p-8 border border-slate-200 bg-white/80 backdrop-blur-md rounded-[2.5rem]">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">
                                Protocol_Index
                            </h4>
                            <nav className="space-y-1.5">
                                {sections.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() =>
                                            document
                                                .getElementById(s.id)
                                                ?.scrollIntoView({
                                                    behavior: "smooth"
                                                })
                                        }
                                        className={cn(
                                            "w-full flex items-center gap-4 p-4 rounded-xl transition-all border text-left",
                                            activeSection === s.id
                                                ? "bg-slate-950 text-white border-slate-950 shadow-xl"
                                                : "border-transparent text-slate-500 hover:bg-slate-50"
                                        )}
                                    >
                                        <span className="font-mono text-[10px] opacity-40">
                                            0{i + 1}
                                        </span>
                                        <span className="text-xs font-black uppercase tracking-widest truncate">
                                            {s.title.split(". ")[1]}
                                        </span>
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <div className="lg:col-span-8 space-y-24 md:space-y-40 pb-20">
                        {sections.map((section, i) => (
                            <section
                                id={section.id}
                                key={i}
                                className="scroll-mt-24 md:scroll-mt-32 group"
                            >
                                <div className="flex items-start gap-4 md:gap-6 mb-5">
                                    <div className="shrink-0 w-10 h-10 md:w-14 md:h-14 bg-white border border-slate-200 text-blue-600 rounded-lg md:rounded-2xl flex items-center justify-center group-hover:bg-slate-950 group-hover:text-white transition-colors duration-300 shadow-sm">
                                        {section.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-xl md:text-3xl font-[1000] uppercase tracking-tighter text-slate-950 leading-tight">
                                            {section.title}
                                        </h2>
                                        <div className="h-1 w-8 bg-blue-600 mt-2 rounded-full group-hover:w-16 transition-all duration-500" />
                                    </div>
                                </div>
                                <p className="text-slate-600 text-base md:text-xl leading-relaxed font-semibold tracking-tight max-w-3xl">
                                    {section.content}
                                </p>
                            </section>
                        ))}

                        {/* Legal Contact Card */}
                        <div className="p-8 md:p-12 bg-slate-950 rounded-[2.5rem] text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/20 rounded-full -mr-20 -mt-20 blur-[60px] pointer-events-none" />
                            <div className="relative z-10 flex flex-col gap-10">
                                <div>
                                    <Scale className="w-8 h-8 text-blue-500 mb-6" />
                                    <h3 className="text-xl md:text-2xl font-black uppercase mb-2">
                                        Legal_Liaison_Node
                                    </h3>
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                        Operational hours: 0900-1700 UTC
                                    </p>
                                </div>
                                <button
                                    onClick={copyEmail}
                                    className={cn(
                                        "p-5 md:p-6 border rounded-2xl transition-all w-full text-center group",
                                        copied
                                            ? "border-emerald-500 text-emerald-500 bg-emerald-500/10"
                                            : "border-white/10 bg-white/5 hover:border-blue-500"
                                    )}
                                >
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                        {copied ? (
                                            <CheckCheck className="w-3 h-3" />
                                        ) : (
                                            <Copy className="w-3 h-3 opacity-30 group-hover:opacity-100" />
                                        )}
                                        <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-50">
                                            {copied
                                                ? "NODE_COPIED"
                                                : "SECURE_RELAY_ENDPOINT"}
                                        </span>
                                    </div>
                                    <div className="text-[12px] md:text-sm font-mono font-black break-all tracking-widest uppercase">
                                        legal@sleepchoiceguide.com
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}
