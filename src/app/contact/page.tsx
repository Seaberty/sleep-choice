"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import {
    Mail,
    MessageSquare,
    ShieldCheck,
    Globe,
    Clock,
    Send,
    CheckCircle,
    Terminal,
    Hash,
    Command,
    Activity,
    Lock,
    Cpu,
    Fingerprint
} from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_PROTOCOL } from "@/lib/constants"

const CONTACT_CONFIG = {
    domain: "sleepchoiceguide.com",
    responseTime: "24-48 Business Hours",
    methods: [
        {
            icon: MessageSquare,
            title: "NEURAL_FEEDBACK",
            tag: "ALGORITHM_AUDIT",
            description:
                "Found an anomaly in our Scored-Matrix™ or have data suggestions?",
            email: "editorial",
            color: "text-blue-500 bg-blue-500/5 border-blue-500/20"
        },
        {
            icon: Globe,
            title: "PARTNERSHIP_NODE",
            tag: "COLLABORATION",
            description:
                "For affiliate inquiries, data licensing, and strategic alliances.",
            email: "partners",
            color: "text-indigo-500 bg-indigo-500/5 border-indigo-500/20"
        },
        {
            icon: ShieldCheck,
            title: "LEGAL_ENDPOINT",
            tag: "DATA_PRIVACY",
            description:
                "Data extraction requests (GDPR/CCPA) and protocol notices.",
            email: "legal",
            color: "text-emerald-500 bg-emerald-500/5 border-emerald-500/20"
        }
    ]
}

export default function ContactPage() {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [message, setMessage] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSent, setIsSent] = useState(false)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = email.trim().toLowerCase()
        if (!trimmed || !trimmed.includes("@")) return

        setIsSubmitting(true)
        const subject = encodeURIComponent(
            `SleepChoice inquiry · ${name.trim() || "visitor"}`
        )
        const body = encodeURIComponent(
            `Name: ${name.trim() || "—"}\nReply-To: ${trimmed}\n\n${message.trim()}`
        )
        window.location.href = `mailto:editorial@${CONTACT_CONFIG.domain}?subject=${subject}&body=${body}`
        window.setTimeout(() => {
            setIsSubmitting(false)
            setIsSent(true)
        }, 400)
    }

    return (
        <main className="bg-white min-h-screen pb-24 pt-20 font-sans">
            {/* Header: 工业风大标题 */}
            <section className="relative overflow-hidden py-24 border-b border-slate-100">
                <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-30" />
                <div className="container mx-auto px-6 relative z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 text-white text-[10px] font-black uppercase tracking-[0.2em] mb-8"
                    >
                        <Activity className="w-3 h-3 text-blue-400 animate-pulse" />
                        COMM_LINK_ESTABLISHED
                    </motion.div>
                    <h1 className="text-5xl md:text-8xl font-[1000] tracking-tighter text-slate-950 uppercase leading-[0.9] mb-8">
                        Get In <span className="text-blue-600">Touch</span>_
                    </h1>
                    <p className="text-slate-500 font-bold max-w-2xl mx-auto uppercase tracking-wider text-xs md:text-sm leading-relaxed">
                        Direct access to our data audit desk and algorithm
                        engineers. <br />
                        All inquiries are processed through our secure relay
                        node.
                    </p>
                </div>
            </section>

            <section className="container mx-auto px-6 -mt-10 relative z-20">
                {/* Contact Methods Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
                    {CONTACT_CONFIG.methods.map((method, i) => {
                        const Icon = method.icon
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="group bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all"
                            >
                                <div
                                    className={cn(
                                        method.color,
                                        "w-12 h-12 rounded-xl border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
                                    )}
                                >
                                    <Icon className="w-6 h-6" />
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Hash className="w-3 h-3 text-blue-500" />
                                    <h3 className="text-sm font-black text-slate-950 uppercase tracking-widest">
                                        {method.title}
                                    </h3>
                                </div>
                                <p className="text-slate-500 text-[11px] font-bold uppercase tracking-tight mb-8 leading-relaxed h-12">
                                    {method.description}
                                </p>
                                <a
                                    href={`mailto:${method.email}@${CONTACT_CONFIG.domain}`}
                                    className="flex items-center justify-between group/link text-[10px] font-black text-slate-950 bg-slate-50 px-4 py-3 rounded-lg hover:bg-blue-600 hover:text-white transition-all overflow-hidden"
                                >
                                    <span className="truncate mr-2">
                                        {method.email.toUpperCase()}@
                                        {CONTACT_CONFIG.domain.toUpperCase()}
                                    </span>
                                    <Command className="w-3 h-3 opacity-30 group-hover/link:opacity-100 shrink-0" />
                                </a>
                            </motion.div>
                        )
                    })}
                </div>

                <div className="max-w-6xl mx-auto grid lg:grid-cols-5 gap-12 items-start">
                    {/* Left: Metadata & Commitments */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-slate-950 text-white p-8 rounded-3xl border border-white/5 relative overflow-hidden shadow-2xl">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Cpu className="w-24 h-24 text-blue-500" />
                            </div>
                            <h2 className="text-xl font-black uppercase tracking-tighter mb-6 flex items-center gap-2 relative z-10">
                                <Lock className="w-5 h-5 text-blue-500" />
                                {`PROTOCOL_${APP_PROTOCOL}`}
                            </h2>
                            <div className="space-y-6 relative z-10">
                                <div className="space-y-2">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        Efficiency_Index
                                    </span>
                                    <div className="flex items-center gap-3 text-sm font-bold">
                                        <Clock className="w-4 h-4 text-blue-500" />
                                        <span>
                                            REPLY_ETA:{" "}
                                            {CONTACT_CONFIG.responseTime}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        Data_Safety
                                    </span>
                                    <div className="flex items-center gap-3 text-sm font-bold">
                                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                        <span>ENCRYPTED_UPLINK_ACTIVE</span>
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-white/10 flex items-center gap-3">
                                    <Fingerprint className="w-4 h-4 text-slate-600" />
                                    <span className="text-[9px] font-mono text-slate-500 tracking-tighter uppercase">
                                        ID: NODE_USA_EAST_01
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-blue-50 rounded-3xl border border-blue-100">
                            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Activity className="w-3 h-3" /> System_Note
                            </h4>
                            <p className="text-xs font-bold italic leading-relaxed text-blue-900/70">
                                Quick message opens your default mail client to{" "}
                                <strong className="not-italic text-blue-900">
                                    editorial@
                                    {CONTACT_CONFIG.domain}
                                </strong>
                                . For routing-specific topics, use the
                                departmental mailto cards above.
                            </p>
                        </div>
                    </div>

                    {/* Right: The Terminal Form */}
                    <div className="lg:col-span-3">
                        <div className="bg-white rounded-3xl border-2 border-slate-950 p-8 md:p-10 shadow-[8px_8px_0px_0px_rgba(2,6,23,1)]">
                            {isSent ? (
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="py-20 text-center space-y-6"
                                >
                                    <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle className="w-10 h-10" />
                                    </div>
                                    <h3 className="text-3xl font-black uppercase tracking-tighter">
                                        Transmission_Success
                                    </h3>
                                    <p className="text-slate-500 font-bold uppercase text-xs">
                                        If your mail client opened, send the
                                        draft from there. No copy is stored on
                                        this page.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsSent(false)
                                            setMessage("")
                                        }}
                                        className="text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline"
                                    >
                                        Initiate New Session
                                    </button>
                                </motion.div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-10">
                                        <h3 className="text-2xl font-[1000] uppercase tracking-tighter">
                                            Quick_Message
                                        </h3>
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 rounded-full bg-slate-100" />
                                            <div className="w-2 h-2 rounded-full bg-slate-200" />
                                            <div className="w-2 h-2 rounded-full bg-blue-600" />
                                        </div>
                                    </div>
                                    <form
                                        onSubmit={handleSubmit}
                                        className="space-y-6"
                                    >
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                                                    USER_ID / NAME
                                                </label>
                                                <input
                                                    required
                                                    type="text"
                                                    value={name}
                                                    onChange={(e) =>
                                                        setName(e.target.value)
                                                    }
                                                    autoComplete="name"
                                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-5 py-4 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-bold text-sm"
                                                    placeholder="IDENTIFIER"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                                                    RETURN_PATH / EMAIL
                                                </label>
                                                <input
                                                    required
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) =>
                                                        setEmail(e.target.value)
                                                    }
                                                    autoComplete="email"
                                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-5 py-4 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-bold text-sm"
                                                    placeholder="EMAIL@DOMAIN.COM"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                                                QUERY_DATA / MESSAGE
                                            </label>
                                            <textarea
                                                required
                                                rows={5}
                                                value={message}
                                                onChange={(e) =>
                                                    setMessage(e.target.value)
                                                }
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-5 py-4 focus:outline-none focus:border-blue-600 focus:bg-white transition-all font-bold text-sm resize-none"
                                                placeholder="DESCRIBE_YOUR_QUERY..."
                                            />
                                        </div>
                                        <button
                                            disabled={isSubmitting}
                                            type="submit"
                                            className="w-full bg-slate-950 hover:bg-blue-600 disabled:bg-slate-400 text-white py-5 rounded-xl font-black text-xs uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 group"
                                        >
                                            {isSubmitting
                                                ? "PROCESSING_UPLINK..."
                                                : "Execute_Transmission"}
                                            {!isSubmitting && (
                                                <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                            )}
                                        </button>
                                    </form>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </main>
    )
}
