import type { Metadata } from "next"
import { APP_PROTOCOL } from "@/lib/constants"
import {
    ShieldCheck,
    Cpu,
    CheckCircle2,
    Binary,
    Scale,
    Activity,
    Database
} from "lucide-react"

/** FAQ 文案与首屏/§02 段落一致，便于富摘要与答案引擎引用 */
const DISCLOSURE_FAQ_JSONLD = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
        {
            "@type": "Question",
            name: "Does SleepChoice Guide operate a physical mattress laboratory?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "We do not operate a physical test laboratory. Audits aggregate and model third-party owner reviews, retailer listings, and published certifications—no in-house bench measurements on inventory we own."
            }
        },
        {
            "@type": "Question",
            name: 'What does "lab" or "lab-verified" mean on this site?',
            acceptedAnswer: {
                "@type": "Answer",
                text: 'When we say "lab" or "lab-verified," we mean structured forensic scoring against certifications, listing specs, and aggregated owner-review corpora—not bench testing of units on our premises. Indices are computed by our registry pipeline from AI-synthesized third-party intelligence.'
            }
        },
        {
            "@type": "Question",
            name: "How is SleepChoice Guide funded?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "Operational costs are sustained in part by referral yields (affiliate commissions). These yields fund computational overhead while keeping listed prices unchanged for users at checkout."
            }
        },
        {
            "@type": "Question",
            name: "Does the scoring system use affiliate commission data?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "Our AI does not know which brands pay higher commissions. The scoring engine only sees specifications and consumer feedback logs."
            }
        }
    ]
} as const

export const metadata: Metadata = {
    title: "Algorithmic Transparency & Disclosure",
    description:
        "Transparency regarding our AI-driven testing methodology, data aggregation protocols, and affiliate relationships.",
    alternates: { canonical: "/disclosure" }
}

export default function DisclosurePage() {
    return (
        <main className="min-h-screen bg-white pt-32 pb-20 font-sans selection:bg-blue-600 selection:text-white">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(DISCLOSURE_FAQ_JSONLD)
                }}
            />
            <div className="container mx-auto px-4 sm:px-6 relative z-10 max-w-5xl">
                {/* --- Header: 算法审计页头 --- */}
                <header className="mb-24 border-b-8 border-slate-950 pb-12">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
                        <div className="flex items-center gap-3 text-blue-600 font-black text-[10px] uppercase tracking-[0.4em]">
                            <ShieldCheck className="w-4 h-4" />
                            Protocol:{" "}
                            {`Algorithmic_Audit_${APP_PROTOCOL}`}
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1">
                            <Activity className="w-3 h-3 text-blue-600" />
                            Status: Live_Data_Processing
                        </div>
                    </div>

                    <h1 className="text-5xl md:text-8xl font-[1000] tracking-tighter uppercase leading-[0.8] mb-8 italic">
                        The <br />
                        <span className="text-blue-600 not-italic">
                            Logic_
                        </span>{" "}
                        <br />
                        Dossier.
                    </h1>

                    <p className="max-w-2xl text-[11px] font-bold text-slate-400 uppercase leading-relaxed tracking-widest">
                        We do not operate a physical laboratory. Instead, we
                        deploy high-density computational auditing to synthesize
                        thousands of consumer data points into unbiased
                        performance metrics.
                    </p>
                    <p className="mt-6 max-w-2xl text-[11px] font-bold uppercase leading-relaxed tracking-wide text-slate-500">
                        When we say{" "}
                        <span className="text-slate-950">&quot;lab&quot;</span>{" "}
                        or{" "}
                        <span className="text-slate-950">
                            &quot;lab-verified&quot;
                        </span>{" "}
                        elsewhere on this site, we mean{" "}
                        <strong className="text-slate-950">
                            structured forensic scoring against documented
                            certifications, retailer listings, and aggregated
                            owner-review text from major platforms
                        </strong>
                        — not bench measurements performed on inventory we hold.
                        SleepChoice does not operate a physical QA lab or claim
                        unit-by-unit testing; numerical indices are produced by
                        our registry pipeline from third-party-sourced signals.
                    </p>
                </header>

                <div className="grid lg:grid-cols-12 gap-16">
                    <div className="lg:col-span-12 space-y-24">
                        {/* 01. AI-Driven Methodology: 承认AI身份 */}
                        <section id="Methodology" className="scroll-mt-40">
                            <div className="flex items-center gap-3 mb-8">
                                <span className="text-4xl font-black text-slate-100 tracking-tighter italic">
                                    01.
                                </span>
                                <h2 className="text-3xl font-[1000] uppercase tracking-tighter text-slate-950">
                                    How_We_Analyze
                                </h2>
                            </div>
                            <div className="prose-slate space-y-6">
                                <p className="text-sm font-bold text-slate-600 uppercase leading-relaxed">
                                    Our rankings are derived from the{" "}
                                    <span className="text-slate-950 underline decoration-4 decoration-blue-600 underline-offset-4">
                                        Automated Intelligence Registry (A.I.R)
                                    </span>
                                    . This system replaces subjective human bias
                                    with large-scale data synthesis:
                                </p>
                                <div className="grid md:grid-cols-3 gap-4">
                                    <div className="p-6 bg-slate-50 border border-slate-100">
                                        <Database className="w-5 h-5 mb-4 text-blue-600" />
                                        <h4 className="text-[10px] font-black uppercase mb-2">
                                            Massive_Aggregation
                                        </h4>
                                        <p className="text-[9px] text-slate-500 font-bold leading-relaxed uppercase">
                                            Scraping 10,000+ verified owner logs
                                            to identify recurring structural
                                            failure patterns.
                                        </p>
                                    </div>
                                    <div className="p-6 bg-slate-50 border border-slate-100">
                                        <Binary className="w-5 h-5 mb-4 text-blue-600" />
                                        <h4 className="text-[10px] font-black uppercase mb-2">
                                            Material_Sim
                                        </h4>
                                        <p className="text-[9px] text-slate-500 font-bold leading-relaxed uppercase">
                                            Simulating ILD (Indentation Load
                                            Deflection) based on reported foam
                                            densities.
                                        </p>
                                    </div>
                                    <div className="p-6 bg-slate-50 border border-slate-100">
                                        <Cpu className="w-5 h-5 mb-4 text-blue-600" />
                                        <h4 className="text-[10px] font-black uppercase mb-2">
                                            Sentiment_Audit
                                        </h4>
                                        <p className="text-[9px] text-slate-500 font-bold leading-relaxed uppercase">
                                            Filtering out incentivized/fake
                                            reviews through linguistic pattern
                                            recognition.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 02. Affiliate Truth: 真实的财务逻辑 */}
                        <section id="Affiliate_Logic" className="scroll-mt-40">
                            <div className="flex items-center gap-3 mb-8">
                                <span className="text-4xl font-black text-slate-100 tracking-tighter italic">
                                    02.
                                </span>
                                <h2 className="text-3xl font-[1000] uppercase tracking-tighter text-slate-950">
                                    Financial_Transparency
                                </h2>
                            </div>
                            <div className="bg-slate-950 text-white p-10 font-mono text-[11px] leading-loose tracking-widest uppercase relative overflow-hidden">
                                <div className="relative z-10">
                                    [FUNDING_SOURCE]: Affiliate_Commissions{" "}
                                    <br />
                                    [COMMISSION_EFFECT]:
                                    Zero_Price_Increase_For_User <br />
                                    [DATA_INTEGRITY]:
                                    Algorithm_Blocked_From_Revenue_Data <br />
                                    <br />
                                    <span className="text-blue-400">
                                        NOTE:
                                    </span>{" "}
                                    Our AI does not know which brands pay higher
                                    commissions. The scoring engine only
                                    &quot;sees&quot; specifications and consumer
                                    feedback logs.
                                </div>
                                <div className="absolute top-0 right-0 p-4 opacity-20">
                                    <Scale className="w-20 h-20" />
                                </div>
                            </div>
                        </section>

                        {/* 03. Final Commitment */}
                        <section
                            id="Final_Oath"
                            className="scroll-mt-40 bg-blue-600 p-10 text-white"
                        >
                            <div className="flex items-center gap-3 mb-6">
                                <CheckCircle2 className="w-6 h-6" />
                                <h2 className="text-2xl font-[1000] uppercase tracking-tighter">
                                    The_Logic_Oath
                                </h2>
                            </div>
                            <p className="text-[11px] font-black uppercase leading-relaxed tracking-widest mb-8 italic">
                                &quot;We believe math is more reliable than a
                                15-minute test in a showroom. By aggregating the
                                experiences of thousands, we provide a more
                                accurate durability forecast than any single
                                human reviewer could.&quot;
                            </p>
                        </section>
                    </div>
                </div>

                <footer className="mt-40 pt-10 border-t border-slate-100 opacity-40">
                    <div className="font-mono text-[9px] font-black uppercase">
                        AI_Review_Synthesizer_Active <br />
                        Data_Points_Processed: 1.2M+ <br />
                        Version: 2026.Q1
                    </div>
                </footer>
            </div>
        </main>
    )
}
