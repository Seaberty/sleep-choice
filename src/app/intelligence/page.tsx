import type { Metadata } from "next"
import Link from "next/link"
import { listRecentBrandIntelligence } from "@/lib/brand-intelligence"
import { Radio, ExternalLink, Hash } from "lucide-react"

export const metadata: Metadata = {
    title: "Intelligence Center",
    description:
        "Cross-platform review signals (Reddit, Amazon, Trustpilot, SleepLine) distilled into structured sentiment, issue tags, and short verdicts.",
    alternates: { canonical: "/intelligence" }
}

function sentimentLabel(score: number): string {
    if (score >= 0.65) return "Leans positive"
    if (score <= 0.35) return "Leans negative"
    return "Mixed / thin signal"
}

export default async function IntelligenceCenterPage() {
    const rows = await listRecentBrandIntelligence(64)

    return (
        <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
            <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-16 md:py-24">
                <div className="mb-12 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
                        Intelligence Center
                    </p>
                    <h1 className="text-3xl font-[1000] tracking-tight text-slate-950 md:text-4xl">
                        Multi-platform signals
                    </h1>
                    <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
                        Each row is one platform batch for a registry product: Serper
                        organic harvest, then a single structured LLM pass for
                        sentiment, issue tags, and a short verdict. Higher{" "}
                        <span className="font-mono text-xs">signal_density</span>{" "}
                        increases <span className="font-mono text-xs">confidence_score</span>
                        . This does not replace the on-site forensic{" "}
                        <code className="rounded bg-slate-200/80 px-1.5 py-0.5 text-xs">
                            audit_note
                        </code>
                        ; it adds community context.
                    </p>
                </div>

                {rows.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-12 text-center text-sm text-slate-500">
                        No brand intelligence rows yet. Run a forensic sync with
                        Serper + Gemini to populate{" "}
                        <span className="font-mono text-xs">brand_intelligence</span>.
                    </div>
                ) : (
                    <ul className="space-y-6">
                        {rows.map((r) => (
                            <li
                                key={r.id}
                                className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
                            >
                                <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4 md:flex-row md:items-center md:justify-between">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-md bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                                            {r.source_platform}
                                        </span>
                                        <Link
                                            href={`/registry/${encodeURIComponent(r.product_slug)}`}
                                            className="text-sm font-bold text-blue-600 hover:underline"
                                        >
                                            {r.brand_slug.replace(/-/g, " ")} ·{" "}
                                            {r.product_slug}
                                        </Link>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-slate-500">
                                        <span>
                                            sentiment{" "}
                                            <strong className="text-slate-800">
                                                {r.sentiment_score.toFixed(2)}
                                            </strong>
                                        </span>
                                        <span>
                                            n={r.signal_density}{" "}
                                            <span className="text-slate-400">
                                                conf {r.confidence_score.toFixed(2)}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-4 px-5 py-5">
                                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        <Radio className="h-3.5 w-3.5" />
                                        {sentimentLabel(r.sentiment_score)}
                                    </div>
                                    <p className="text-sm leading-relaxed text-slate-700">
                                        {r.verdict_summary ||
                                            "No verdict generated for this batch."}
                                    </p>
                                    {r.key_issue_tags?.length ? (
                                        <div className="flex flex-wrap gap-2">
                                            {r.key_issue_tags.map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight text-slate-600"
                                                >
                                                    <Hash className="h-3 w-3 opacity-50" />
                                                    {tag.replace(/_/g, " ")}
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                    <Link
                                        href={`/registry/${encodeURIComponent(r.product_slug)}`}
                                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800"
                                    >
                                        Registry dossier
                                        <ExternalLink className="h-3 w-3" />
                                    </Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </main>
    )
}
