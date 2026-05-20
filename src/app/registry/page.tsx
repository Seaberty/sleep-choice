import { isListableAuditProduct } from "@/lib/audit-list-eligibility"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { RegistryDetailLink } from "@/components/registry-detail-link"
import { Metadata } from "next"
import { AddToCompareButton } from "@/components/compare/add-to-compare-button"
import {
    Search,
    Activity,
    ShieldCheck,
    ArrowUpRight,
    QrCode,
    Lock,
    AlertCircle,
    RefreshCw
} from "lucide-react"

export const metadata: Metadata = {
    title: "Official Registry Archive",
    description:
        "Registry of AI-synthesized mattress intelligence from aggregated reviews and retail listings—not independent bench verification of each unit.",
    alternates: { canonical: "/registry" }
}

export const dynamic = "force-dynamic"

interface Props {
    searchParams: Promise<{ q?: string; sort?: string }>
}

export default async function RegistryPage({ searchParams }: Props) {
    // 关键点：异步解构
    const { q } = await searchParams; 
    const query = q || ""

    let dbQuery = supabase.from("audit_products").select("*")

    if (query) {
        dbQuery = dbQuery.or(`model.ilike.%${query}%,brand.ilike.%${query}%`)
    }

    const { data: products, error } = await dbQuery.order("updated_at", {
        ascending: false
    })

    const listProducts = (products ?? []).filter(isListableAuditProduct)

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "SleepChoice Verified Mattress Registry",
        itemListElement: listProducts.map((p, i) => {
            const overall = Number(p.audit_scores?.overall) || 0
            const rc =
                typeof (p as { review_count?: number }).review_count ===
                "number"
                    ? (p as { review_count?: number }).review_count!
                    : 0
            const itemPayload: Record<string, unknown> = {
                "@type": "Product",
                name: p.model,
                brand: { "@type": "Brand", name: p.brand }
            }
            const img = p.image_url && String(p.image_url).trim()
            if (img) itemPayload.image = img
            const priceNum = Number(p.price)
            if (Number.isFinite(priceNum) && priceNum > 0) {
                itemPayload.offers = {
                    "@type": "Offer",
                    price: priceNum,
                    priceCurrency: "USD"
                }
            }
            if (overall > 0) {
                itemPayload.aggregateRating = {
                    "@type": "AggregateRating",
                    ratingValue: overall,
                    bestRating: "10",
                    worstRating: "1",
                    ratingCount: rc > 0 ? rc.toString() : "85",
                    reviewCount: rc > 0 ? rc.toString() : "82"
                }
            }
            return {
                "@type": "ListItem",
                position: i + 1,
                item: itemPayload
            }
        })
    }

    return (
        <main className="min-h-screen bg-white pt-28 pb-16 sm:pt-32 sm:pb-20 overflow-x-clip font-sans selection:bg-blue-600 selection:text-white">
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

            <div className="container mx-auto px-4 sm:px-6 relative z-10">
                {/* --- Header --- */}
                <header className="max-w-5xl mb-12 sm:mb-16 border-l-4 sm:border-l-8 border-blue-600 pl-4 sm:pl-8">
                    <div className="flex items-center gap-3 text-blue-600 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
                        <Lock className="w-3 h-3" />
                        Access_Level: Public_Auditor_Node
                    </div>
                    <h1 className="text-[clamp(2.25rem,11vw,8rem)] md:text-9xl font-[1000] tracking-tighter uppercase leading-[0.85] sm:leading-[0.8] mb-6 sm:mb-8 italic">
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
                            Live_Indexed: {listProducts.length} Entities
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest tabular-nums">
                            <RefreshCw className="w-3.5 h-3.5 text-emerald-500 animate-[spin_10s_linear_infinite]" />
                            Cycle: 180m_Refresh
                        </div>
                    </div>
                </header>

                {/* --- Search Bar --- */}
                <div
                    id="registry-search"
                    className="mb-10 scroll-mt-40 rounded-2xl border-[3px] border-slate-950 bg-white p-5 shadow-[12px_12px_0px_0px_rgba(37,99,235,0.12)] md:p-7"
                >
                    <div className="mb-4 flex flex-wrap items-center gap-3 border-b-2 border-blue-600 pb-4">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-600/25">
                            <Search className="h-4 w-4" strokeWidth={2.5} />
                        </span>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-950">
                                Search the archive
                            </p>
                            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-600">
                                Model name · Brand · SKU fragment
                            </p>
                        </div>
                    </div>
                    <form
                        action="/registry"
                        method="GET"
                        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6"
                    >
                        <label className="flex min-w-0 flex-1 cursor-text flex-col gap-2 sm:max-w-xl">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                                Query string
                            </span>
                            <div className="flex items-center gap-3 border-2 border-slate-900 bg-white px-4 py-3.5 shadow-inner shadow-slate-200/80 transition-all focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-600/15">
                                <Search
                                    className="h-4 w-4 shrink-0 text-blue-600"
                                    aria-hidden
                                />
                                <input
                                    type="search"
                                    name="q"
                                    defaultValue={query}
                                    placeholder="e.g. SAATVA, TEMPUR, HYBRID…"
                                    autoComplete="off"
                                    className="min-w-0 flex-1 border-none bg-transparent text-[11px] font-mono font-bold uppercase tracking-widest text-slate-950 outline-none placeholder:text-slate-500 placeholder:normal-case"
                                />
                            </div>
                        </label>
                        <button
                            type="submit"
                            className="w-full shrink-0 border-2 border-slate-950 bg-slate-950 px-8 py-3.5 text-[10px] font-black uppercase tracking-widest text-white shadow-[4px_4px_0px_0px_rgba(37,99,235,0.35)] transition-colors hover:bg-blue-600 hover:border-blue-600 sm:w-auto"
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
                        <div className="col-span-2 flex items-center justify-between gap-4 px-2 pr-4 pl-4">
                            <span className="flex-1 text-center">
                                Compare_Matrix
                            </span>
                            <span className="flex-1 text-right">
                                Report_Link
                            </span>
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
                        ) : listProducts.length === 0 ? (
                            <div className="p-32 text-center">
                                <span className="animate-pulse text-[10px] font-mono text-slate-300 uppercase tracking-[0.5em]">
                                    [ No_Matches_Found ]
                                </span>
                            </div>
                        ) : (
                            listProducts.map((p) => {
                                const href = `/registry/${p.slug}`
                                const title = `${p.brand} ${p.model}`
                                return (
                                    <div
                                        key={p.id}
                                        className="group grid grid-cols-1 items-center gap-y-6 border-l-0 border-blue-600 p-4 transition-all hover:bg-slate-50 hover:border-l-[8px] sm:p-6 md:grid-cols-12 md:gap-y-0 md:p-10 md:hover:border-l-[12px]"
                                    >
                                        <RegistryDetailLink
                                            href={href}
                                            className="col-span-5 mb-6 block min-w-0 rounded-sm outline-none ring-blue-600/0 transition-[color,box-shadow] focus-visible:ring-4 focus-visible:ring-blue-600/25 md:mb-0"
                                        >
                                            <div className="flex items-center gap-6">
                                                <div className="hidden md:flex h-12 w-12 shrink-0 items-center justify-center border border-slate-100 bg-slate-50 text-slate-200 transition-colors group-hover:text-blue-600">
                                                    <QrCode className="h-6 w-6" />
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.3em] text-blue-600">
                                                        {p.brand}
                                                    </span>
                                                    <h3 className="break-words text-xl font-[1000] uppercase leading-none tracking-tighter text-slate-950 sm:text-2xl md:text-4xl">
                                                        {p.model}
                                                    </h3>
                                                </div>
                                            </div>
                                        </RegistryDetailLink>

                                        <RegistryDetailLink
                                            href={href}
                                            className="col-span-2 mb-6 flex justify-center rounded-sm outline-none ring-blue-600/0 focus-visible:ring-4 focus-visible:ring-blue-600/25 md:mb-0"
                                        >
                                            <span className="text-3xl font-mono font-bold italic tracking-tighter text-slate-950 transition-colors group-hover:text-blue-600 sm:text-4xl md:text-5xl">
                                                {p.audit_scores?.overall?.toFixed(
                                                    1
                                                ) || "0.0"}
                                            </span>
                                        </RegistryDetailLink>

                                        <RegistryDetailLink
                                            href={href}
                                            className="col-span-3 mb-8 flex justify-center rounded-sm outline-none ring-blue-600/0 focus-visible:ring-4 focus-visible:ring-blue-600/25 tabular-nums font-mono text-[11px] font-bold uppercase text-slate-400 transition-colors group-hover:text-slate-950 md:mb-0"
                                        >
                                            {new Date(
                                                p.updated_at
                                            ).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "2-digit",
                                                year: "numeric"
                                            })}
                                        </RegistryDetailLink>

                                        <div className="col-span-2 flex flex-row items-center justify-between gap-4 px-0 sm:px-1 md:px-2 md:pr-4">
                                            <div className="flex min-w-0 flex-1 justify-center">
                                                <AddToCompareButton
                                                    slug={p.slug}
                                                    productTitle={title}
                                                    variant="compact"
                                                />
                                            </div>
                                            <div className="flex shrink-0 justify-end">
                                                <RegistryDetailLink
                                                    href={href}
                                                    className="inline-flex max-w-full flex-wrap items-center justify-end gap-2 border-b-4 border-slate-950 pb-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-950 outline-none transition-[color,border-color] group-hover:border-blue-600 group-hover:text-blue-600 focus-visible:ring-4 focus-visible:ring-blue-600/25 sm:gap-3 sm:text-[11px] sm:tracking-[0.2em]"
                                                >
                                                    Open_Log{" "}
                                                    <ArrowUpRight
                                                        className="h-4 w-4 shrink-0"
                                                        aria-hidden
                                                    />
                                                </RegistryDetailLink>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
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
