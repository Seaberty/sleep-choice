import { getAutomatedRegistry } from "@/lib/registry"
import { previewTextForJournalCard } from "@/lib/journal-card-blurb"
import Link from "next/link"
import {
    FlaskConical,
    ChevronRight,
    FileText,
    Activity
} from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Sleep Journal · Review-Synthesized Observations",
    description:
        "Chronological intelligence logs from our registry—narratives derived from aggregated marketplace reviews and listing data, not physical product tests.",
    alternates: { canonical: "/journal" }
}

export const dynamic = "force-dynamic"

export default async function JournalIndexPage() {
    const registryData = await getAutomatedRegistry()
    const products = Object.values(registryData || {})

    const currentAuditDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short"
    })

    return (
        <main className="relative min-h-screen bg-white pt-24 pb-20 overflow-x-hidden font-sans selection:bg-blue-600 selection:text-white">
            <div className="fixed inset-0 pointer-events-none z-0">
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage:
                            "radial-gradient(#000 1px, transparent 1px)",
                        backgroundSize: "24px 24px"
                    }}
                />
                <div className="absolute top-0 left-0 w-full h-[1px] bg-blue-600/30 animate-[scan_10s_linear_infinite]" />
            </div>

            <div className="container mx-auto px-4 sm:px-6 relative z-10 max-w-6xl">
                <header className="max-w-4xl mb-24 border-l-4 border-slate-950 pl-8">
                    <div className="flex items-center gap-3 text-blue-600 font-black text-[10px] uppercase tracking-[0.4em] mb-6">
                        <Activity className="w-4 h-4 animate-pulse" />
                        Live_Feed: Observation_Stream
                    </div>
                    <h1 className="text-6xl md:text-8xl font-[1000] tracking-tighter uppercase leading-[0.85] mb-8 italic">
                        The Sleep <br />
                        <span className="text-blue-600 not-italic">
                            Journal_
                        </span>
                    </h1>

                    <div className="flex flex-wrap items-center gap-6 py-4 border-t border-slate-100">
                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                            <FileText className="w-3 h-3" />
                            Volume_2026_Q1
                        </div>
                        <div className="px-3 py-1 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest border border-blue-100">
                            Last_Entry_Sync: {currentAuditDate}
                        </div>
                    </div>
                </header>

                <div className="grid lg:grid-cols-2 gap-x-20 gap-y-24">
                    {products.length === 0 ? (
                        <div className="col-span-full py-40 border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
                            <span className="animate-pulse font-mono text-[10px] uppercase tracking-[0.5em] text-slate-300">
                                [ PENDING_DATA_UPLINK... ]
                            </span>
                        </div>
                    ) : (
                        products.map((p, idx) => {
                            const journalSegment = encodeURIComponent(
                                (p.slug && String(p.slug).trim()) ||
                                    String(p.id)
                            )
                            return (
                                <Link
                                    href={`/journal/${journalSegment}`}
                                    key={p.id}
                                    className="group relative flex flex-col items-start"
                                >
                                    <div className="absolute -inset-8 bg-slate-50/0 group-hover:bg-slate-50/80 -z-10 transition-all duration-500 rounded-sm" />

                                    <div className="absolute -left-12 top-0 hidden xl:flex flex-col items-center gap-4">
                                        <span className="text-[10px] font-black text-slate-200 group-hover:text-blue-200 transition-colors uppercase vertical-text tracking-widest">
                                            ENTRY_{idx + 1}
                                        </span>
                                        <div className="w-[1px] h-12 bg-slate-100 group-hover:bg-blue-100" />
                                    </div>

                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="flex -space-x-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                        </div>
                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.3em]">
                                            Peer_Reviewed_Protocol
                                        </span>
                                    </div>

                                    <h2 className="text-3xl md:text-4xl font-[1000] uppercase tracking-tighter leading-[0.95] mb-5 group-hover:italic transition-all">
                                        {p.brand} <br />
                                        <span className="text-slate-400 group-hover:text-blue-600">
                                            {p.name}
                                        </span>
                                    </h2>

                                    <p className="text-sm font-medium leading-relaxed text-slate-600 mb-8 line-clamp-4 normal-case tracking-tight">
                                        {previewTextForJournalCard(p)}
                                    </p>

                                    <div className="flex items-center justify-between w-full pr-4 border-b border-slate-100 pb-4 group-hover:border-blue-200 transition-colors">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-950">
                                            Read_Full_Observation
                                        </span>
                                        <ChevronRight className="w-4 h-4 translate-x-0 group-hover:translate-x-2 transition-transform text-blue-600" />
                                    </div>
                                </Link>
                            )
                        })
                    )}
                </div>

                <footer className="mt-40 pt-20 border-t-8 border-slate-950 flex flex-col md:flex-row justify-between items-start gap-12">
                    <div className="max-w-md">
                        <div className="flex items-center gap-3 mb-6">
                            <FlaskConical className="w-6 h-6 text-blue-600" />
                            <h3 className="text-xl font-black uppercase italic tracking-tighter">
                                Scientific_Integrity
                            </h3>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed tracking-widest">
                            The Sleep Journal is an editorially independent
                            observation archive. Logs aggregate verified retail
                            and audit signals so no single manufacturer controls
                            the narrative shown here.
                        </p>
                    </div>

                    <Link
                        href="/registry"
                        className="group flex flex-col items-end text-right"
                    >
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Global_Registry
                        </span>
                        <div className="text-3xl font-black uppercase italic leading-none group-hover:text-blue-600 transition-colors">
                            Access_Archive <br />
                            <span className="text-sm not-italic font-bold text-slate-950 underline underline-offset-8 decoration-4">
                                View_All_Records_→
                            </span>
                        </div>
                    </Link>
                </footer>
            </div>

            <style
                dangerouslySetInnerHTML={{
                    __html: `
                .vertical-text { writing-mode: vertical-rl; text-orientation: mixed; }
            `
                }}
            />
        </main>
    )
}
