"use client"

import React, { useState, useTransition, useRef } from "react"
import Link from "next/link"
import {
    Mail,
    ShieldCheck,
    Globe,
    ArrowRight,
    Lock,
    Loader2,
    CheckCircle2,
    FlaskConical,
    Fingerprint,
    Cpu,
    AlertCircle,
    Command
} from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_PROTOCOL } from "@/lib/constants"
import { subscribeAction } from "@/app/actions/subscribe"

export function SiteFooter() {
    const currentYear = new Date().getFullYear()
    const [isPending, startTransition] = useTransition()
    // 明确状态流：idle -> loading -> success/error
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
    const formRef = useRef<HTMLFormElement>(null)

    async function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault() // 阻止默认提交
        if (isPending || status === "success") return

        const formData = new FormData(event.currentTarget)
        const email = formData.get("email") as string
        if (!email || !email.includes("@")) return

        startTransition(async () => {
            try {
                const result = await subscribeAction(formData)
                if (result.success) {
                    setStatus("success")
                    formRef.current?.reset()
                    // 5秒后恢复，允许再次订阅（或保持成功状态）
                    setTimeout(() => setStatus("idle"), 5000)
                } else {
                    setStatus("error")
                    setTimeout(() => setStatus("idle"), 3000)
                }
            } catch {
                setStatus("error")
                setTimeout(() => setStatus("idle"), 3000)
            }
        })
    }

    return (
        <footer className="border-t border-slate-200 bg-[#fdfdfd] pt-20 md:pt-32 pb-12 font-sans overflow-hidden">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 mb-24">
                    {/* 1. Laboratory & Data Sync Area */}
                    <div className="lg:col-span-5 space-y-10">
                        <Link
                            href="/"
                            className="flex items-center space-x-3 group w-fit"
                        >
                            <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center group-hover:bg-blue-600 transition-all duration-500 shadow-2xl">
                                <span className="text-white font-black text-xl italic font-serif">
                                    S
                                </span>
                            </div>
                            <div className="flex flex-col -space-y-1">
                                <span className="text-xl font-[1000] tracking-tighter text-slate-950 uppercase">
                                    SleepChoice
                                    <span className="text-blue-600">Guide</span>
                                </span>
                                <span className="text-[8px] font-bold text-slate-400 tracking-[0.3em] uppercase pl-0.5">
                                    Intelligence Unit
                                </span>
                            </div>
                        </Link>

                        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group/card">
                            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover/card:opacity-10 transition-opacity pointer-events-none">
                                <Cpu className="w-24 h-24 text-blue-600" />
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                    </div>
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">
                                        Live Data Sync
                                    </h4>
                                </div>

                                <p className="text-sm text-slate-500 leading-relaxed mb-8 font-medium">
                                    Authorize connection to receive raw{" "}
                                    <span className="text-slate-900 font-bold">
                                        biometric audit logs
                                    </span>{" "}
                                    and real-time market arbitrage alerts.
                                </p>

                                <form
                                    ref={formRef}
                                    onSubmit={handleFormSubmit}
                                    className="flex flex-col sm:flex-row gap-3"
                                >
                                    <div className="relative flex-grow">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                                            {status === "success" ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            ) : status === "error" ? (
                                                <AlertCircle className="w-4 h-4 text-red-500" />
                                            ) : (
                                                <Mail className="w-4 h-4 text-slate-400" />
                                            )}
                                        </div>
                                        <input
                                            name="email"
                                            type="email"
                                            required
                                            disabled={
                                                isPending ||
                                                status === "success"
                                            }
                                            placeholder={
                                                status === "success"
                                                    ? "Protocol Synced"
                                                    : "Identifier (Email)"
                                            }
                                            className={cn(
                                                "w-full bg-slate-50 border rounded-xl pl-11 pr-4 py-3.5 text-xs font-bold outline-none transition-all duration-300",
                                                status === "success"
                                                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                                    : status === "error"
                                                      ? "border-red-500 bg-red-50"
                                                      : "border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/5"
                                            )}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={
                                            isPending || status === "success"
                                        }
                                        className={cn(
                                            "min-w-[140px] px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2",
                                            status === "success"
                                                ? "bg-emerald-500 text-white"
                                                : "bg-slate-950 hover:bg-blue-600 text-white"
                                        )}
                                    >
                                        {isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : status === "success" ? (
                                            "Synced"
                                        ) : (
                                            "Authorize"
                                        )}
                                    </button>
                                </form>

                                <div className="mt-4 flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                                    <Fingerprint className="w-3 h-3 text-blue-500" />
                                    SHA-256 Encrypted / System {APP_PROTOCOL}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Navigation Matrix */}
                    <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-12">
                        {/* 保持之前的导航结构 */}
                        <div className="space-y-8">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
                                Research Base
                            </h4>
                            <nav className="flex flex-col gap-4 text-xs font-bold text-slate-600">
                                <Link
                                    href="/registry#registry-search"
                                    className="hover:text-blue-600 flex items-center justify-between group"
                                >
                                    Verified Registry{" "}
                                    <ArrowRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                </Link>
                                <Link
                                    href="/best-picks"
                                    className="hover:text-blue-600 flex items-center justify-between group"
                                >
                                    Performance Index{" "}
                                    <ArrowRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                </Link>
                                <Link
                                    href="/lab"
                                    className="hover:text-blue-600"
                                >
                                    Testing Protocols
                                </Link>
                                <Link
                                    href="/deals"
                                    className="text-emerald-600 hover:text-emerald-700 flex items-center gap-2"
                                >
                                    Arbitrage Alerts{" "}
                                    <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                </Link>
                                <Link
                                    href="/docs"
                                    className="hover:text-blue-600"
                                >
                                    Technical Docs
                                </Link>
                            </nav>
                        </div>

                        <div className="space-y-8">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
                                Resources
                            </h4>
                            <nav className="flex flex-col gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                <Link
                                    href="/calculator"
                                    className="hover:text-blue-600 transition-colors flex items-center gap-2"
                                >
                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                    Dimension_Matrix
                                </Link>
                                <Link
                                    href="/quiz"
                                    className="hover:text-blue-600 transition-colors flex items-center gap-2"
                                >
                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                    Neural_Match_AI
                                </Link>
                                <Link
                                    href="/compare"
                                    className="hover:text-blue-600 transition-colors flex items-center gap-2"
                                >
                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                    Audit_Comparison
                                </Link>
                                <Link
                                    href="/methodology"
                                    className="hover:text-blue-600 transition-colors flex items-center gap-2"
                                >
                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                    Audit_Methodology
                                </Link>
                                {/* 新增：Disclosure 披露入口 */}
                                <Link
                                    href="/disclosure"
                                    className="hover:text-blue-600 transition-colors flex items-center gap-2 text-slate-950"
                                >
                                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                                    Full_Disclosure
                                </Link>
                            </nav>
                        </div>

                        <div className="col-span-2 md:col-span-1">
                            <div className="h-full p-8 bg-slate-950 rounded-[2.5rem] space-y-5 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none" />
                                <div className="flex items-center gap-2 text-white font-black text-[9px] uppercase tracking-widest relative z-10">
                                    <FlaskConical className="w-4 h-4 text-blue-400" />{" "}
                                    Integrity Shield
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed font-bold italic relative z-10">
                                    "0% Brand Sponsorship. We purchase every
                                    unit at full retail to ensure unbiased audit
                                    logs."
                                </p>
                                <div className="pt-2 border-t border-white/10 relative z-10">
                                    <div className="text-[8px] text-slate-500 font-mono tracking-tighter">
                                        STATUS: FULLY_INDEPENDENT
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Disclosure Area - 高稳定性版本 */}
                <div className="border-t border-slate-200 pt-12">
                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 mb-12 relative overflow-hidden">
                        <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] pointer-events-none select-none">
                            <Cpu className="w-40 h-40 text-slate-900" />
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                            <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">
                                Data_Integrity_Manifesto
                            </h5>
                        </div>

                        <p className="text-[11px] leading-relaxed text-slate-500 font-medium max-w-5xl relative z-10">
                            <span className="text-blue-600 font-bold mr-1">
                                [PROTOCOL_{APP_PROTOCOL}]
                            </span>
                            <strong>
                                SleepChoiceGuide (Intelligence Unit)
                            </strong>{" "}
                            operates via the{" "}
                            <span className="text-slate-900 font-bold">
                                Scored-Matrix™
                            </span>{" "}
                            neural engine. Our system bypasses editorial
                            subjectivity by utilizing{" "}
                            <span className="text-slate-900 font-bold">
                                high-dimensional NLP audits
                            </span>{" "}
                            and multi-node sentiment triangulation from verified
                            user datasets. To maintain zero-bias integrity, 100%
                            of insights are extracted through{" "}
                            <span className="text-slate-900 font-bold">
                                algorithmic scraping of retail channels
                            </span>
                            . Operational costs are sustained by referral
                            yields, ensuring our audit logs remain strictly
                            independent and brand-agnostic.
                        </p>
                    </div>

                    <div className="flex flex-col lg:flex-row justify-between items-center gap-8 px-4">
                        <div className="flex flex-wrap justify-center lg:justify-start gap-x-8 gap-y-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            <Link
                                href="/about"
                                className="hover:text-blue-600 transition-colors flex items-center gap-1.5"
                            >
                                <Command className="w-3 h-3 text-blue-500" />{" "}
                                Agency_Intelligence
                            </Link>
                            <Link
                                href="/privacy"
                                className="hover:text-blue-600 transition-colors flex items-center gap-1.5"
                            >
                                <Lock className="w-3 h-3" /> Privacy_Vault
                            </Link>
                            <Link
                                href="/terms"
                                className="hover:text-blue-600 transition-colors"
                            >
                                Service_Protocols
                            </Link>
                            <Link
                                href="/contact"
                                className="hover:text-blue-600 transition-colors flex items-center gap-1.5"
                            >
                                <Globe className="w-3 h-3" /> Endpoint_Contact
                            </Link>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* 增加一个纯文本的校验码，增加硬核感 */}
                            <div className="text-[9px] font-mono text-slate-300">
                                CRC: 0xEB041F21
                            </div>
                            <p className="text-[10px] font-black text-slate-950 uppercase tracking-tighter">
                                © {currentYear} SleepChoice Intelligence Unit.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    )
}
