import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { Metadata } from "next"
import {
    Database,
    Search,
    Filter,
    Activity,
    ShieldCheck,
    ArrowUpRight,
    QrCode,
    Lock,
    AlertCircle,
    RefreshCw
} from "lucide-react"

export const metadata: Metadata = {
    title: "Official Registry Archive | SleepChoice Guide Laboratory",
    description:
        "Independent laboratory-verified database of mattress performance indexed for 2026."
}

export const dynamic = "force-dynamic"

interface Props {
    searchParams: { q?: string; sort?: string }
}

export default async function RegistryPage({ searchParams }: Props) {
    const query = searchParams.q || ""

    let dbQuery = supabase.from("audit_products").select("*")

    if (query) {
        dbQuery = dbQuery.or(`model.ilike.%${query}%,brand.ilike.%${query}%`)
    }

    const { data: products, error } = await dbQuery.order("updated_at", {
        ascending: false
    })

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "SleepChoice Verified Mattress Registry",
        itemListElement: products?.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
                "@type": "Product",
                name: p.model,
                brand: { "@type": "Brand", name: p.brand },
                aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: p.audit_scores?.overall || 0,
                    bestRating: "10"
                }
            }
        }))
    }

    return (
        <main className="min-h-screen bg-white pt-32 pb-20 overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* 背景美化：使用标准 Tailwind 动画代替 styled-jsx */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage:
                            "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
                        backgroundSize: "32px 32px"
                    }}
                />
                {/* 扫描线动画：改用 CSS 变量和 Tailwind 实现 */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-600/20 animate-[scan_8s_linear_infinite]" />
            </div>

            <div className="container mx-auto px-6 relative z-10">
                {/* --- Header --- */}
                <header className="max-w-5xl mb-16 border-l-8 border-blue-600 pl-8">
                    <div className="flex items-center gap-3 text-blue-600 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
                        <Lock className="w-3 h-3" />
                        Access_Level: Public_Auditor_Node
                    </div>
                    <h1 className="text-7xl md:text-9xl font-[1000] tracking-tighter uppercase leading-[0.8] mb-8 italic">
                        The <br />
                        <span className="text-blue-600 not-italic">
                            Dossier_
                        </span>{" "}
                        <br />
                        Archive.
                    </h1>

                    <div className="flex flex-wrap items-center gap-8 py-6 border-y border-slate-100">
                        <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                            <Activity className="w-3.5 h-3.5 text-blue-600" />
                            Live_Indexed: {products?.length || 0} Entities
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest tabular-nums">
                            <RefreshCw className="w-3.5 h-3.5 text-emerald-500 animate-[spin_10s_linear_infinite]" />
                            Cycle: 180m_Refresh
                        </div>
                    </div>
                </header>

                {/* --- Search Bar --- */}
                <div className="mb-8">
                    <form
                        action="/registry"
                        method="GET"
                        className="flex flex-wrap justify-between items-center gap-4"
                    >
                        <div className="flex items-center gap-4 bg-slate-50 border-2 border-slate-100 focus-within:border-blue-600 transition-all px-5 py-3 w-full md:w-auto group">
                            <Search className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600" />
                            <input
                                type="text"
                                name="q"
                                defaultValue={query}
                                placeholder="SEARCH_BY_MODEL_OR_BRAND..."
                                className="bg-transparent border-none outline-none text-[10px] font-mono font-bold text-slate-900 w-64 uppercase tracking-widest placeholder:text-slate-300"
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-slate-950 text-white px-8 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-colors"
                        >
                            Execute_Query
                        </button>
                    </form>
                </div>

                {/* --- Grid --- */}
                <div className="border-[4px] border-slate-950 shadow-[20px_20px_0px_0px_rgba(241,245,249,1)] bg-white overflow-hidden">
                    <div className="hidden md:grid grid-cols-12 bg-slate-950 text-white p-5 font-black text-[10px] uppercase tracking-[0.3em]">
                        <div className="col-span-5 pl-4">
                            Subject_Identifier
                        </div>
                        <div className="col-span-2 text-center">
                            Score_Index
                        </div>
                        <div className="col-span-3 text-center">
                            Sync_Timestamp
                        </div>
                        <div className="col-span-2 text-right pr-4">
                            Report_Link
                        </div>
                    </div>

                    <div className="divide-y divide-slate-100 bg-white">
                        {error ? (
                            <div className="p-24 text-center">
                                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                <span className="text-[10px] font-mono text-red-500 uppercase tracking-widest font-bold">
                                    Database_Error: [503_CONNECTION_TIMEOUT]
                                </span>
                            </div>
                        ) : !products || products.length === 0 ? (
                            <div className="p-32 text-center">
                                <span className="animate-pulse text-[10px] font-mono text-slate-300 uppercase tracking-[0.5em]">
                                    [ No_Matches_Found ]
                                </span>
                            </div>
                        ) : (
                            products.map((p) => (
                                <Link
                                    key={p.id}
                                    href={`/registry/${p.slug}`}
                                    className="grid grid-cols-1 md:grid-cols-12 items-center p-8 md:p-10 hover:bg-slate-50 transition-all group border-l-0 hover:border-l-[12px] border-blue-600"
                                >
                                    <div className="col-span-5 mb-6 md:mb-0">
                                        <div className="flex items-center gap-6">
                                            <div className="hidden md:flex w-12 h-12 items-center justify-center bg-slate-50 border border-slate-100 text-slate-200 group-hover:text-blue-600 transition-all">
                                                <QrCode className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.3em] mb-2 block">
                                                    {p.brand}
                                                </span>
                                                <h3 className="text-2xl md:text-4xl font-[1000] uppercase tracking-tighter text-slate-950 leading-none">
                                                    {p.model}
                                                </h3>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-2 text-center mb-6 md:mb-0">
                                        <div className="relative inline-block">
                                            <span className="text-4xl md:text-5xl font-mono font-bold italic tracking-tighter text-slate-950 group-hover:text-blue-600 transition-colors">
                                                {p.audit_scores?.overall?.toFixed(
                                                    1
                                                ) || "0.0"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="col-span-3 text-center mb-8 md:mb-0 tabular-nums font-mono text-[11px] font-bold text-slate-400 group-hover:text-slate-950 uppercase transition-colors">
                                        {new Date(
                                            p.updated_at
                                        ).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "2-digit",
                                            year: "numeric"
                                        })}
                                    </div>

                                    <div className="col-span-2 text-right">
                                        <span className="inline-flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-950 border-b-4 border-slate-950 pb-1 group-hover:text-blue-600 group-hover:border-blue-600 transition-all">
                                            Open_Log{" "}
                                            <ArrowUpRight className="w-4 h-4" />
                                        </span>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>

                {/* --- Footer --- */}
                <footer className="mt-24 border-t-8 border-slate-950 pt-12 flex flex-col md:flex-row justify-between items-start gap-12">
                    <div className="max-w-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <ShieldCheck className="w-6 h-6 text-blue-600" />
                            <h4 className="text-[12px] font-black text-slate-950 uppercase tracking-[0.4em]">
                                Integrity_Audit_Protocol_v26.4
                            </h4>
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase leading-relaxed tracking-tight">
                            Independent performance auditing. Parity sync:
                            2026_02_25.
                        </p>
                    </div>
                    <div className="bg-slate-950 text-white p-8 font-mono text-[10px] font-bold leading-loose tracking-widest uppercase">
                        System_Status: Operational
                        <br /> Auditing_Active: True
                    </div>
                </footer>
            </div>
        </main>
    )
}
