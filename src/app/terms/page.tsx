"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
    Scale,
    ShieldAlert,
    FileText,
    CheckCircle2,
    AlertTriangle,
    Copy,
    CheckCheck,
    LayoutList,
    Cpu,
    Activity,
    BookOpen,
    Ban,
    Mail
} from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_PROTOCOL } from "@/lib/constants"

type TermSection = {
    id: string
    icon: React.ReactNode
    title: string
    /** Short label for sidebar (after "01. ") */
    short: string
    paragraphs: string[]
}

export default function TermsPage() {
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

    const sections: TermSection[] = React.useMemo(
        () => [
            {
                id: "acceptance",
                icon: <BookOpen className="w-5 h-5" />,
                title: "01. Acceptance & Service Scope",
                short: "Acceptance & Service Scope",
                paragraphs: [
                    'By accessing SleepChoice Guide ("we," "us," the "Site") at sleepchoiceguide.com or related properties, you agree to these Terms of Service and our Privacy Policy. If you do not agree, discontinue use of the Site.',
                    "The Site publishes sleep-product intelligence for general informational purposes. Nothing here is medical advice, a diagnosis, or a substitute for consultation with a qualified professional regarding sleep disorders or health conditions.",
                    "We may update these Terms; the revision date appears at the top of this page. Continued use after changes constitutes acceptance of the revised Terms."
                ]
            },
            {
                id: "intelligence-disclaimer",
                icon: <Cpu className="w-5 h-5" />,
                title: "02. Intelligence Outputs & Methodology",
                short: "Intelligence Outputs",
                paragraphs: [
                    "Registry scores, rankings, narratives, and \"audit\" language reflect computational models applied to third-party data—including aggregated owner reviews, retailer listings, manufacturer-published specifications, and similar public or licensed sources. SleepChoice Guide does not operate a physical product-testing laboratory and does not claim independent bench measurement of each SKU in our inventory.",
                    "Outputs may be incomplete, delayed, or incorrect relative to any given unit or retailer at checkout. Brand marketing, pricing, promotions, and availability change without notice. You should verify material facts (dimensions, certifications, trial periods, return policies) on the merchant's site before purchasing.",
                    "Scored-Matrix™ and related names denote proprietary weighting and NLP workflows; they are analytical tools, not certifications endorsed by governments or standards bodies unless explicitly stated for a specific claim."
                ]
            },
            {
                id: "affiliate",
                icon: <ShieldAlert className="w-5 h-5" />,
                title: "03. Affiliate & Commercial Relationships",
                short: "Affiliate & Commercial",
                paragraphs: [
                    "We participate in affiliate programs. When you use outbound links (including via /go routes or merchant gateways), we may earn a commission on qualifying purchases at no additional cost to you, consistent with FTC guidance (16 CFR Part 255).",
                    "Affiliate compensation helps fund hosting, data processing, and editorial operations. Our scoring and ranking pipelines are architected so that affiliate commission rates are not supplied as direct inputs to the published score formulas; see our Disclosure page for how independence is described.",
                    "You are never required to click our links; alternatives include navigating directly to retailers."
                ]
            },
            {
                id: "ip",
                icon: <FileText className="w-5 h-5" />,
                title: "04. Intellectual Property",
                short: "Intellectual Property",
                paragraphs: [
                    "Site design, copy (except quoted third-party material), graphics, Scored-Matrix™ branding, and compiled datasets presented as our original work are owned by SleepChoice Guide or licensors and protected by copyright and trademark law where applicable.",
                    "You may link to public URLs of the Site in good faith. Framing, mirroring, or systematic reproduction of substantial portions of the Site without written permission is prohibited.",
                    "Trademarks of third parties (retailer names, mattress brands, certification marks) belong to their respective owners and are used nominatively for identification."
                ]
            },
            {
                id: "acceptable-use",
                icon: <Ban className="w-5 h-5" />,
                title: "05. Acceptable Use",
                short: "Acceptable Use",
                paragraphs: [
                    "You agree not to misuse the Site: no unlawful activity, harassment, interference with security, distribution of malware, or attempts to gain unauthorized access to systems or data.",
                    "Unless we give express written consent, you may not deploy high-volume scrapers, crawlers, or automated harvesting tools against the Site or APIs to extract registry data for republication, resale, or machine-learning training datasets.",
                    "We may suspend access, throttle requests, or block IPs that degrade service for other users."
                ]
            },
            {
                id: "liability",
                icon: <AlertTriangle className="w-5 h-5" />,
                title: "06. Disclaimer of Warranties & Limitation of Liability",
                short: "Liability Limit",
                paragraphs: [
                    'THE SITE AND ALL CONTENT ARE PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, OR NON-INFRINGEMENT, TO THE MAXIMUM EXTENT PERMITTED BY LAW.',
                    "To the maximum extent permitted by law, SleepChoice Guide and its operators, contractors, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or loss of profits, data, or goodwill, arising from your use of the Site or reliance on any intelligence output.",
                    "If liability is found despite the foregoing, our aggregate liability shall not exceed the greater of (a) USD $100 or (b) the amounts you paid us directly for premium services in the twelve (12) months preceding the claim—currently the Site is offered without charge; thus (a) typically applies. Some jurisdictions do not allow certain limitations; in those jurisdictions our liability is limited to the minimum permitted."
                ]
            },
            {
                id: "general",
                icon: <Mail className="w-5 h-5" />,
                title: "07. General",
                short: "General",
                paragraphs: [
                    "These Terms constitute the entire agreement regarding the subject matter here and supersede prior oral or written understandings on the same topic.",
                    "If any provision is held invalid, the remainder remains enforceable. Failure to enforce a provision is not a waiver.",
                    "For notices related to these Terms, contact legal@sleepchoiceguide.com. For privacy-specific requests, see our Privacy Policy.",
                    "You agree that the laws of the United States govern these Terms, without regard to conflict-of-law rules. Venue for disputes shall be in courts located in the United States; you consent to personal jurisdiction there. (If you are a consumer in a jurisdiction that mandates local mandatory protections, those protections remain available to you.)"
                ]
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
            { rootMargin: "-18% 0px -65% 0px", threshold: 0 }
        )
        sections.forEach((s) => {
            const el = document.getElementById(s.id)
            if (el) observer.observe(el)
        })
        return () => observer.disconnect()
    }, [sections])

    return (
        <main className="min-h-screen bg-[#fdfdfd] pt-20 md:pt-32 pb-24 relative w-full font-sans">
            {/* overflow-x only on decorative layer — overflow:hidden on main breaks sticky aside */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.01] select-none z-0 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] h-full">
                    {[...Array(8)].map((_, i) => (
                        <div
                            key={i}
                            className="flex justify-around mb-40 uppercase tracking-[1em] rotate-12 font-mono text-[9px] whitespace-nowrap"
                        >
                            <span>{`LEGAL_PROTOCOL_${APP_PROTOCOL}`}</span>
                            <span>INTEL_UNIT_ENCRYPTED</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm">
                <div className="bg-slate-950/95 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl flex items-center justify-between text-white">
                    <div className="flex items-center gap-2 pl-2 overflow-hidden">
                        <LayoutList className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="text-[9px] font-black uppercase tracking-tight truncate">
                            {activeSection
                                ? activeSection.toUpperCase().replace(/-/g, "_")
                                : "INDEX"}
                        </span>
                    </div>
                    <div className="flex gap-1 shrink-0 overflow-x-auto max-w-[55%] pb-0.5">
                        {sections.map((s, idx) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() =>
                                    document
                                        .getElementById(s.id)
                                        ?.scrollIntoView({ behavior: "smooth" })
                                }
                                className={cn(
                                    "w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-all text-[10px] font-bold",
                                    activeSection === s.id
                                        ? "bg-blue-600"
                                        : "bg-white/5"
                                )}
                                aria-label={`Jump to section ${idx + 1}`}
                            >
                                {idx + 1}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-5 md:px-6 max-w-7xl relative z-10">
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
                        <div className="tracking-tighter">REV_{lastUpdated}</div>
                    </div>
                    <p className="mt-8 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
                        These Terms govern use of SleepChoice Guide&apos;s public
                        website and intelligence surfaces. They complement our{" "}
                        <a
                            href="/privacy"
                            className="text-blue-700 underline underline-offset-4 hover:text-blue-900"
                        >
                            Privacy Policy
                        </a>{" "}
                        and{" "}
                        <a
                            href="/disclosure"
                            className="text-blue-700 underline underline-offset-4 hover:text-blue-900"
                        >
                            Disclosure
                        </a>
                        . Protocol stack: {APP_PROTOCOL}.
                    </p>
                </header>

                <div className="grid lg:grid-cols-12 gap-10 items-start">
                    {/* sticky：顶距 = 全局 --header-height（globals.css）+ 1.5rem 呼吸间距 */}
                    <aside className="lg:col-span-4 hidden lg:block lg:self-start lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:max-h-[calc(100vh-var(--header-height)-3.5rem)] lg:overflow-y-auto">
                        <div className="p-8 border border-slate-200 bg-white/90 backdrop-blur-md rounded-[2.5rem] shadow-sm">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">
                                Protocol_Index
                            </h4>
                            <nav className="space-y-1.5" aria-label="Terms sections">
                                {sections.map((s, i) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() =>
                                            document
                                                .getElementById(s.id)
                                                ?.scrollIntoView({
                                                    behavior: "smooth",
                                                    block: "start"
                                                })
                                        }
                                        className={cn(
                                            "w-full flex items-center gap-4 p-4 rounded-xl transition-all border text-left",
                                            activeSection === s.id
                                                ? "bg-slate-950 text-white border-slate-950 shadow-xl"
                                                : "border-transparent text-slate-500 hover:bg-slate-50"
                                        )}
                                    >
                                        <span className="font-mono text-[10px] opacity-40 shrink-0">
                                            {String(i + 1).padStart(2, "0")}
                                        </span>
                                        <span className="text-[11px] font-black uppercase tracking-wide leading-snug">
                                            {s.short}
                                        </span>
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </aside>

                    <div className="lg:col-span-8 space-y-20 md:space-y-28 pb-20">
                        {sections.map((section, i) => (
                            <section
                                id={section.id}
                                key={section.id}
                                className="scroll-mt-28 md:scroll-mt-36 group"
                            >
                                <div className="flex items-start gap-4 md:gap-6 mb-6">
                                    <div className="shrink-0 w-10 h-10 md:w-14 md:h-14 bg-white border border-slate-200 text-blue-600 rounded-lg md:rounded-2xl flex items-center justify-center group-hover:bg-slate-950 group-hover:text-white transition-colors duration-300 shadow-sm">
                                        {section.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-xl md:text-3xl font-[1000] uppercase tracking-tighter text-slate-950 leading-tight">
                                            {section.title}
                                        </h2>
                                        <div className="h-1 w-8 bg-blue-600 mt-2 rounded-full group-hover:w-16 transition-all duration-500" />
                                    </div>
                                </div>
                                <div className="space-y-5 max-w-3xl">
                                    {section.paragraphs.map((p, j) => (
                                        <p
                                            key={j}
                                            className="text-slate-600 text-[15px] md:text-lg leading-relaxed font-medium tracking-tight"
                                        >
                                            {p}
                                        </p>
                                    ))}
                                </div>
                            </section>
                        ))}

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
                                    type="button"
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
