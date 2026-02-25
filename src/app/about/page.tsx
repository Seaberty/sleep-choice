"use client"

import React from "react"
import { motion } from "framer-motion"
import {
    ShieldCheck,
    Binary,
    Hash,
    Terminal,
    CheckCircle2,
    FileText,
    MapPin,
    Cpu,
    Radar,
    Network,
    Database,
    Fingerprint,
    Activity
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function AboutPage() {
    return (
        <main className="min-h-screen bg-[#FAFAFA] pb-24 pt-20 selection:bg-blue-600 selection:text-white font-sans">
            {/* 1. Intelligence Hero Section */}
            <section className="relative overflow-hidden border-b border-slate-200 bg-white py-24 md:py-32">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] [background-size:30px_30px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#3b82f615,transparent_50%)]" />

                <div className="container relative z-10 mx-auto px-6">
                    <div className="flex flex-col items-center text-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mb-8 inline-flex items-center gap-3 border border-slate-900 bg-slate-950 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.4em] text-white shadow-[4px_4px_0px_0px_rgba(59,130,246,1)]"
                        >
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            INTEL_NODE: CENTRAL_STATION
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="mb-8 text-6xl font-[1000] leading-[0.85] tracking-[-0.06em] text-slate-950 md:text-[10rem] uppercase"
                        >
                            Deciphering <br />
                            <span className="text-blue-600">Sleep_Data.</span>
                        </motion.h1>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="max-w-2xl border-l-2 border-blue-600 pl-8 text-left"
                        >
                            <p className="text-lg font-bold italic leading-relaxed text-slate-500 md:text-xl">
                                "Marketing claims are{" "}
                                <span className="text-slate-950 not-italic uppercase tracking-tighter">
                                    noise
                                </span>
                                . We provide the
                                <span className="text-slate-950 not-italic uppercase tracking-tighter">
                                    signal
                                </span>
                                . Using NLP neural mapping and sentiment data
                                clusters, we treat every mattress as a digital
                                asset to be audited."
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* 2. Intelligence Framework (Industrial Cards) */}
            <section className="container mx-auto px-6 py-24">
                <div className="mb-20 flex flex-col items-end justify-between gap-6 border-b-4 border-slate-950 pb-12 md:flex-row">
                    <div className="max-w-xl">
                        <div className="flex items-center gap-2 text-blue-600 mb-3 font-black text-[10px] uppercase tracking-[0.3em]">
                            <Binary className="w-4 h-4" />
                            Scored-Matrix™_Audit_System
                        </div>
                        <h2 className="text-5xl font-[1000] uppercase tracking-tighter text-slate-950 md:text-6xl">
                            Core Protocols
                        </h2>
                    </div>
                    <div className="flex gap-2">
                        {[
                            {
                                label: "Verified_Nodes",
                                val: "1.2M+",
                                color: "text-slate-950"
                            },
                            {
                                label: "Audit_Cycles",
                                val: "24/7",
                                color: "text-blue-600"
                            }
                        ].map((s, i) => (
                            <div
                                key={i}
                                className="bg-white border border-slate-200 p-6 min-w-[140px] shadow-sm"
                            >
                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                    {s.label}
                                </span>
                                <span
                                    className={cn(
                                        "text-2xl font-black tracking-tighter",
                                        s.color
                                    )}
                                >
                                    {s.val}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid gap-8 md:grid-cols-3">
                    {[
                        {
                            icon: <Network className="h-6 w-6" />,
                            title: "Neural Mapping",
                            tag: "DATA_EXTRACTION",
                            desc: "Our NLP engine parses 10,000+ verified owner feedback nodes to isolate authentic pressure-relief metadata across all body types.",
                            color: "bg-blue-600"
                        },
                        {
                            icon: <ShieldCheck className="h-6 w-6" />,
                            title: "Independent Audit",
                            tag: "ZERO_SPONSORSHIP",
                            desc: "We process anonymized retail data only. Zero free samples, zero brand interference. Our scores are mathematically objective.",
                            color: "bg-slate-900"
                        },
                        {
                            icon: <Cpu className="h-6 w-6" />,
                            title: "Algorithm Synthesis",
                            tag: "NLP_WEIGHTING",
                            desc: "Raw data is filtered through our Scored-Matrix™ to ensure outlier bias is removed and true long-term durability is revealed.",
                            color: "bg-blue-600"
                        }
                    ].map((item, i) => (
                        <div
                            key={i}
                            className="group relative border border-slate-200 bg-white p-1 transition-all hover:border-blue-600 shadow-sm"
                        >
                            <div className="bg-slate-50 p-8">
                                <div
                                    className={cn(
                                        "mb-8 flex h-14 w-14 items-center justify-center text-white",
                                        item.color
                                    )}
                                >
                                    {item.icon}
                                </div>
                                <div className="mb-2 flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                    <Hash className="h-3 w-3 text-blue-500" />
                                    {item.tag}
                                </div>
                                <h3 className="mb-4 text-2xl font-[1000] uppercase tracking-tighter text-slate-950">
                                    {item.title}
                                </h3>
                                <p className="text-sm font-bold leading-relaxed text-slate-500 italic">
                                    "{item.desc}"
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 3. The Black Box (Intelligence Dossier) */}
            <section className="container mx-auto px-6">
                <div className="relative overflow-hidden bg-slate-950 px-8 py-20 text-white md:px-20 border-y-8 border-blue-600 rounded-[3rem]">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />

                    <div className="relative z-10 grid gap-16 lg:grid-cols-2 items-center">
                        <div>
                            <div className="mb-6 flex items-center gap-3 font-mono text-blue-500">
                                <Terminal className="h-5 w-5" />
                                <span className="text-xs font-black uppercase tracking-[0.4em]">
                                    PROTOCOL_V4.2_STABLE
                                </span>
                            </div>
                            <h2 className="mb-10 text-5xl font-[1000] leading-[0.9] tracking-tighter md:text-7xl uppercase">
                                Real-World <br />
                                <span className="text-blue-500">Evidence_</span>
                            </h2>
                            <div className="space-y-2">
                                {[
                                    {
                                        t: "Owner Sentiment Triangulation",
                                        c: "DATA_X"
                                    },
                                    {
                                        t: "Long-term Durability Regression",
                                        c: "LIFE_MAP"
                                    },
                                    {
                                        t: "Neural Heatmap Analysis",
                                        c: "SENT_MET"
                                    },
                                    {
                                        t: "Certification Integrity Scan",
                                        c: "CERT_SCAN"
                                    }
                                ].map((item, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between border border-white/10 bg-white/5 p-4 hover:bg-blue-600/20 transition-all rounded-xl"
                                    >
                                        <div className="flex items-center gap-4">
                                            <Activity className="h-4 w-4 text-blue-500" />
                                            <span className="text-sm font-black uppercase tracking-widest">
                                                {item.t}
                                            </span>
                                        </div>
                                        <span className="font-mono text-[9px] text-white/30">
                                            {item.c}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative p-1 bg-white/10 rounded-[2.5rem]">
                            <div className="relative border border-white/20 bg-slate-900 p-10 backdrop-blur-xl rounded-[2.5rem]">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Database size={80} />
                                </div>
                                <Fingerprint className="mb-6 h-10 w-10 text-blue-500" />
                                <h4 className="mb-4 text-2xl font-black uppercase tracking-tighter">
                                    Affiliate Transparency
                                </h4>
                                <p className="mb-8 text-sm font-bold leading-relaxed text-slate-400 italic">
                                    "To sustain this computational audit node,
                                    we earn commissions on qualifying purchases.
                                    <span className="text-white not-italic underline decoration-blue-600 decoration-2 underline-offset-4">
                                        {" "}
                                        This decouples our scoring from brand
                                        influence.
                                    </span>{" "}
                                    Our algorithms routinely rank budget models
                                    over legacy brands based on objective data
                                    clusters."
                                </p>
                                <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-blue-500 uppercase">
                                    <ShieldCheck className="w-4 h-4" />
                                    Verified Neutral Intelligence
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. Global HQ Section */}
            <section className="container mx-auto px-6 py-32 text-center">
                <div className="mx-auto max-w-2xl">
                    <div className="mb-8 inline-flex items-center gap-4 px-6 py-2 border border-slate-200 rounded-full bg-white shadow-sm">
                        <MapPin className="h-4 w-4 text-blue-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Digital Intelligence Node / 2026
                        </span>
                    </div>
                    <h3 className="mb-6 text-4xl font-[1000] uppercase tracking-tighter text-slate-950">
                        SleepChoice{" "}
                        <span className="text-blue-600 italic">Intel_Unit</span>
                    </h3>
                    <p className="text-sm font-bold leading-relaxed text-slate-500 uppercase tracking-widest max-w-lg mx-auto">
                        Aggregating multi-source owner metadata to provide the
                        world's most granular objective mattress index.
                    </p>
                </div>
            </section>
        </main>
    )
}
