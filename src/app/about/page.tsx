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
    Microscope,
    Radar
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function AboutPage() {
    return (
        <main className="min-h-screen bg-[#FAFAFA] pb-24 pt-20 selection:bg-blue-600 selection:text-white">
            {/* 1. Intelligence Hero Section */}
            <section className="relative overflow-hidden border-b border-slate-200 bg-white py-24 md:py-32">
                {/* 增加情报单位背景网格 */}
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
                            INTEL_NODE: STATION_01
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="mb-8 text-6xl font-[1000] leading-[0.85] tracking-[-0.06em] text-slate-950 md:text-[10rem] uppercase"
                        >
                            Deciphering <br />
                            <span className="text-blue-600">Sleep.</span>
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
                                . Using biometric sensors and spinal alignment
                                arrays, we treat every mattress as a technical
                                asset to be audited."
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* 2. Laboratory Framework (Industrial Cards) */}
            <section className="container mx-auto px-6 py-24">
                <div className="mb-20 flex flex-col items-end justify-between gap-6 border-b-4 border-slate-950 pb-12 md:flex-row">
                    <div className="max-w-xl">
                        <div className="flex items-center gap-2 text-blue-600 mb-3 font-black text-[10px] uppercase tracking-[0.3em]">
                            <Binary className="w-4 h-4" />
                            Metric_Verification_System
                        </div>
                        <h2 className="text-5xl font-[1000] uppercase tracking-tighter text-slate-950 md:text-6xl">
                            Core Protocols
                        </h2>
                    </div>
                    <div className="flex gap-2">
                        {[
                            {
                                label: "Data_Points",
                                val: "850K+",
                                color: "text-slate-950"
                            },
                            {
                                label: "Lab_Hours",
                                val: "14,200",
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
                            icon: <Radar className="h-6 w-6" />,
                            title: "Physical Metrology",
                            tag: "SENSORY_UNIT",
                            desc: "Based in our 2,000 sq ft facility, we track heat dissipation via infrared thermography and motion isolation with high-resolution accelerometers.",
                            color: "bg-blue-600"
                        },
                        {
                            icon: <ShieldCheck className="h-6 w-6" />,
                            title: "Zero Bias Audit",
                            tag: "LEGAL_CLEARANCE",
                            desc: "We accept no review units. Every specimen is acquired via retail channels to ensure the integrity of the testing batch.",
                            color: "bg-slate-900"
                        },
                        {
                            icon: <Cpu className="h-6 w-6" />,
                            title: "Expert Synthesis",
                            tag: "HUMAN_LOGIC",
                            desc: "Data is cross-referenced by CSCT coaches to ensure sensory output aligns with human physiological requirements.",
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
                <div className="relative overflow-hidden bg-slate-950 px-8 py-20 text-white md:px-20 border-y-8 border-blue-600">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />

                    <div className="relative z-10 grid gap-16 lg:grid-cols-2 items-center">
                        <div>
                            <div className="mb-6 flex items-center gap-3 font-mono text-blue-500">
                                <Terminal className="h-5 w-5" />
                                <span className="text-xs font-black uppercase tracking-[0.4em]">
                                    DECRYPTION_LOG_V3
                                </span>
                            </div>
                            <h2 className="mb-10 text-5xl font-[1000] leading-[0.9] tracking-tighter md:text-7xl uppercase">
                                No-B.S. <br />
                                <span className="text-blue-500">Evidence_</span>
                            </h2>
                            <div className="space-y-2">
                                {[
                                    {
                                        t: "30-Night Compression Stress",
                                        c: "STRESS_X"
                                    },
                                    {
                                        t: "Spinal Alignment Mapping",
                                        c: "BIO_MAP"
                                    },
                                    {
                                        t: "Motion Isolation Metrics",
                                        c: "ISO_MET"
                                    },
                                    {
                                        t: "Third-party VOC Scan",
                                        c: "CHEM_SCAN"
                                    }
                                ].map((item, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between border border-white/10 bg-white/5 p-4 hover:bg-blue-600/20 transition-all"
                                    >
                                        <div className="flex items-center gap-4">
                                            <CheckCircle2 className="h-4 w-4 text-blue-500" />
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

                        <div className="relative p-1 bg-white/10">
                            <div className="relative border border-white/20 bg-slate-900 p-10 backdrop-blur-xl">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Microscope size={80} />
                                </div>
                                <FileText className="mb-6 h-10 w-10 text-blue-500" />
                                <h4 className="mb-4 text-2xl font-black uppercase tracking-tighter">
                                    Affiliate Disclosure
                                </h4>
                                <p className="mb-8 text-sm font-bold leading-relaxed text-slate-400 italic">
                                    "To maintain this laboratory node, we earn
                                    commissions on qualifying purchases.
                                    <span className="text-white not-italic underline decoration-blue-600 decoration-2 underline-offset-4">
                                        {" "}
                                        This ensures zero brand interference.
                                    </span>{" "}
                                    We rank budget models over luxury brands if
                                    the sensors prove superior performance."
                                </p>
                                <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-blue-500 uppercase">
                                    <ShieldCheck className="w-4 h-4" />
                                    Verified Neutral Source
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. Global HQ Section */}
            <section className="container mx-auto px-6 py-32 text-center">
                <div className="mx-auto max-w-2xl">
                    <div className="mb-8 inline-flex items-center gap-4 px-6 py-2 border border-slate-200 rounded-none bg-white shadow-sm">
                        <MapPin className="h-4 w-4 text-blue-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Global Research Node / 2026
                        </span>
                    </div>
                    <h3 className="mb-6 text-4xl font-[1000] uppercase tracking-tighter text-slate-950">
                        SleepChoice{" "}
                        <span className="text-blue-600 italic">Intel_Unit</span>
                    </h3>
                    <p className="text-sm font-bold leading-relaxed text-slate-500 uppercase tracking-widest max-w-lg mx-auto">
                        Consolidating physiological data from high-sensitivity
                        nodes to provide the industry's most granular index.
                    </p>
                </div>
            </section>
        </main>
    )
}
