"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
    ShieldCheck,
    Lock,
    EyeOff,
    Cookie,
    Scale,
    Globe,
    FileCode,
    Activity,
    Database,
    Binary,
    Copy,
    CheckCheck,
    Cpu,
    Fingerprint
} from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_PROTOCOL } from "@/lib/constants"

export default function PrivacyPage() {
    // 动态日期：显示为当前月份的审计修订
    const lastUpdated = `REVISION_${new Date().toLocaleString("en-US", { month: "long", year: "numeric" }).toUpperCase()}`
    const [copied, setCopied] = useState(false)

    const copyEmail = () => {
        navigator.clipboard.writeText("privacy@sleepchoiceguide.com")
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const coreValues = [
        {
            icon: <EyeOff className="w-5 h-5" />,
            title: "ZERO_DATA_SALES",
            content:
                "We never trade or rent your personal metrics. Your interaction data is processed locally and never sold to third-party brokers."
        },
        {
            icon: <Binary className="w-5 h-5" />,
            title: "NEURAL_ANONYMITY",
            content:
                "Our Scored-Matrix™ engine processes sentiment metadata, not identities. We audit opinions, not the people behind them."
        },
        {
            icon: <Lock className="w-5 h-5" />,
            title: "ENCRYPTED_VAULT",
            content:
                "All intelligence logs are secured with enterprise-grade encryption to prevent unauthorized endpoint access to our database clusters."
        }
    ]

    return (
        <main className="min-h-screen bg-[#fdfdfd] pt-32 pb-24 overflow-x-hidden font-sans">
            {/* 背景水印 - 增强情报感 */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.02] select-none flex flex-col justify-between p-10 font-mono text-xs">
                {[...Array(10)].map((_, i) => (
                    <div
                        key={i}
                        className="flex justify-between uppercase tracking-[1em]"
                    >
                        <span>CONFIDENTIAL_PROTOCOL</span>
                        <span>NODE_ID: SC-INTEL-041</span>
                    </div>
                ))}
            </div>

            <div className="container mx-auto px-4 sm:px-6 relative z-10">
                {/* 1. Header Area: 审计状态 */}
                <div className="max-w-5xl mb-24">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-6 mb-12"
                    >
                        <div className="flex -space-x-3">
                            {[ShieldCheck, Fingerprint, Cpu].map((Icon, i) => (
                                <div
                                    key={i}
                                    className="w-12 h-12 rounded-xl border-2 border-white bg-slate-950 flex items-center justify-center shadow-xl"
                                >
                                    <Icon className="w-6 h-6 text-blue-500" />
                                </div>
                            ))}
                        </div>
                        <div className="h-px w-16 bg-blue-500/30" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">
                                COMPLIANCE_STATUS: ACTIVE
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 font-mono uppercase">
                                Scored-Matrix™ {APP_PROTOCOL} Security
                            </span>
                        </div>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-7xl md:text-[10rem] font-[1000] tracking-[calc(-0.05em)] uppercase mb-12 leading-[0.8] text-slate-950"
                    >
                        Data
                        <br />
                        <span className="text-blue-600">Integrity.</span>
                    </motion.h1>

                    <p className="text-xl md:text-2xl text-slate-500 font-bold max-w-2xl leading-tight border-l-4 border-slate-100 pl-8">
                        Transparent data handling is the core protocol of the{" "}
                        <span className="text-slate-950 italic">
                            Intelligence Unit
                        </span>
                        .
                    </p>
                </div>

                {/* 2. Key Pillars Card Grid */}
                <div className="grid lg:grid-cols-3 gap-6 mb-32">
                    {coreValues.map((item, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="p-10 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-500 transition-colors"
                        >
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                                <Binary className="w-20 h-20 text-blue-600" />
                            </div>
                            <div className="w-12 h-12 bg-slate-50 text-slate-900 rounded-xl flex items-center justify-center mb-8 border border-slate-100">
                                {item.icon}
                            </div>
                            <h3 className="text-xl font-black uppercase mb-4 tracking-wider text-slate-900">
                                {item.title}
                            </h3>
                            <p className="text-slate-500 font-bold leading-relaxed text-sm">
                                {item.content}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* 3. The Content Body: 协议详情 */}
                <div className="grid lg:grid-cols-12 gap-20">
                    <div className="lg:col-span-8">
                        <div
                            className="prose prose-slate max-w-none 
                            prose-headings:uppercase prose-headings:tracking-widest prose-headings:font-black prose-headings:text-slate-950
                            prose-p:text-slate-500 prose-p:font-bold prose-p:leading-relaxed
                            prose-strong:text-slate-950 prose-strong:font-[1000]"
                        >
                            <div className="inline-flex items-center gap-2 font-black text-blue-600 px-4 py-1.5 bg-blue-50 rounded-lg text-[10px] mb-12 border border-blue-100 uppercase tracking-widest">
                                <Activity className="w-3 h-3" />
                                {lastUpdated}
                            </div>

                            <section className="mb-16">
                                <div className="flex items-center gap-3 mb-4">
                                    <Database className="w-5 h-5 text-blue-600" />
                                    <h2 className="m-0 text-2xl">
                                        01. NLP_Audit_Sourcing
                                    </h2>
                                </div>
                                <p>
                                    SleepChoice Intelligence Unit utilizes
                                    high-dimensional
                                    <strong>
                                        {" "}
                                        Natural Language Processing (NLP)
                                    </strong>{" "}
                                    to audit public datasets. We do not collect
                                    or ingest biometric data or physical
                                    identifiers. Our Scored-Matrix™ system
                                    exclusively isolates anonymized sentiment
                                    metadata from verified retail channels to
                                    calibrate product reliability scores.
                                </p>
                            </section>

                            <section className="mb-16">
                                <div className="flex items-center gap-3 mb-4">
                                    <Cookie className="w-5 h-5 text-blue-600" />
                                    <h2 className="m-0 text-2xl">
                                        02. Operational_Pixels
                                    </h2>
                                </div>
                                <p>
                                    To sustain operational infrastructure, we
                                    utilize encrypted referral tokens. These{" "}
                                    <strong>session-isolated pixels</strong>{" "}
                                    recognize referral source validation only.
                                    They do not cross-reference your browsing
                                    history or off-node behaviors with your
                                    Scored-Matrix™ interaction profile.
                                </p>
                            </section>

                            <section>
                                <div className="flex items-center gap-3 mb-4">
                                    <Scale className="w-5 h-5 text-blue-600" />
                                    <h2 className="m-0 text-2xl">
                                        03. Universal_Compliance
                                    </h2>
                                </div>
                                <p>
                                    Whether operating under GDPR, CCPA, or VCDPA
                                    frameworks, we apply the
                                    <strong> Global Privacy Baseline</strong>.
                                    Users maintain the terminal right to execute
                                    a data erasure request. All compliance pings
                                    are processed within 72 business hours via
                                    our secure endpoint.
                                </p>
                            </section>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <aside className="lg:col-span-4">
                        <div className="sticky top-32 space-y-4">
                            <div className="p-8 md:p-10 bg-slate-950 rounded-[2.5rem] md:rounded-[3rem] text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                                <ShieldCheck className="w-10 h-10 text-blue-500 mb-8" />
                                <h4 className="text-xl font-black uppercase mb-6 tracking-tighter">
                                    Legal_Endpoint
                                </h4>
                                <p className="text-slate-400 text-[10px] font-bold leading-relaxed mb-8 uppercase tracking-wide">
                                    Direct all compliance inquiries and data
                                    extraction requests to the secure relay
                                    below.
                                </p>

                                <button
                                    onClick={copyEmail}
                                    className={cn(
                                        "w-full group relative flex flex-col items-center justify-center p-5 border rounded-2xl transition-all duration-300",
                                        copied
                                            ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                                            : "border-white/10 bg-white/5 hover:border-blue-500 hover:bg-blue-600/10"
                                    )}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        {copied ? (
                                            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                                        ) : (
                                            <Copy className="w-3.5 h-3.5 text-blue-500 opacity-40 group-hover:opacity-100 transition-opacity" />
                                        )}
                                        <span
                                            className={cn(
                                                "text-[9px] font-black tracking-[0.2em] uppercase",
                                                copied
                                                    ? "text-emerald-500"
                                                    : "text-slate-500"
                                            )}
                                        >
                                            {copied
                                                ? "LINK_COPIED"
                                                : "ENCRYPTED_RELAY"}
                                        </span>
                                    </div>
                                    <span className="text-[11px] md:text-xs font-black tracking-widest uppercase break-all leading-relaxed text-center">
                                        privacy@sleepchoiceguide.com
                                    </span>
                                </button>
                            </div>

                            <div className="p-8 border border-slate-200 rounded-[2.5rem] bg-slate-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">
                                        Server: US-EAST-1 (SECURE)
                                    </span>
                                </div>
                                <Lock className="w-3 h-3 text-slate-300" />
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    )
}
