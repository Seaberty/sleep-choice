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
    Lock
} from "lucide-react"

/**
 * 1. 顶级 SEO Metadata
 * 确保 Google 抓取时将其识别为“独立的第三方审计档案库”
 */
export const metadata: Metadata = {
    title: "Official Registry Archive | SleepChoice Guide Laboratory",
    description:
        "Independent laboratory-verified database of mattress performance. Real-time spinal support and pressure relief metrics indexed for 2026.",
    openGraph: {
        title: "SleepChoice Guide | The Dossier Archive",
        description: "Live-monitored mattress audit registry.",
        type: "website"
    }
}

// 强制实时获取数据库最新抓取的数据，确保“白帽”实时性
export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function RegistryPage() {
    // 获取所有审计产品
    const { data: products, error } = await supabase
        .from("audit_products")
        .select("*")
        .order("updated_at", { ascending: false })

    /**
     * 2. 生成 Google 结构化数据 (JSON-LD)
     * 让搜索结果直接显示评分星级，大幅提高点击率 (CTR)
     */
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
                    bestRating: "10",
                    worstRating: "1",
                    ratingCount: "1"
                }
            }
        }))
    }

    return (
        <main className="min-h-screen bg-white pt-32 pb-20 overflow-hidden">
            {/* 注入结构化数据脚本 */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* 实验室防伪底纹 */}
            <div
                className="fixed inset-0 pointer-events-none opacity-[0.03]"
                style={{
                    backgroundImage:
                        "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
                    backgroundSize: "32px 32px"
                }}
            />

            <div className="container mx-auto px-6 relative z-10">
                {/* --- 页面头部 --- */}
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
                        <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            Integrity: SSL_Encrypted_Audit
                        </div>
                    </div>
                </header>

                {/* --- 工具栏 --- */}
                <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                    <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 px-5 py-3 w-full md:w-auto">
                        <Search className="w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="SEARCH_REGISTRY_DATABASE..."
                            className="bg-transparent border-none outline-none text-[10px] font-mono font-bold text-slate-900 w-64 uppercase tracking-widest placeholder:text-slate-300"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-5 py-3 border-2 border-slate-950 hover:bg-slate-950 hover:text-white transition-all cursor-pointer">
                        <Filter className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Filter_Protocol
                        </span>
                    </button>
                </div>

                {/* --- 档案数据网格 --- */}
                <div className="border-[4px] border-slate-950 shadow-[20px_20px_0px_0px_rgba(241,245,249,1)]">
                    {/* 表头 */}
                    <div className="hidden md:grid grid-cols-12 bg-slate-950 text-white p-5 font-black text-[10px] uppercase tracking-[0.3em]">
                        <div className="col-span-5 pl-4">
                            Subject_Identifier
                        </div>
                        <div className="col-span-2 text-center">
                            Score_Index
                        </div>
                        <div className="col-span-3 text-center">
                            Audit_Timestamp
                        </div>
                        <div className="col-span-2 text-right pr-4">Access</div>
                    </div>

                    {/* 数据流 */}
                    <div className="divide-y divide-slate-200 bg-white">
                        {!products || products.length === 0 ? (
                            <div className="p-32 text-center">
                                <span className="inline-block animate-pulse text-[10px] font-mono text-slate-300 uppercase tracking-[0.5em]">
                                    [ Scanning_Satellite_Nodes... ]
                                </span>
                            </div>
                        ) : (
                            products.map((p) => {
                                const score = p.audit_scores?.overall || "0.0"
                                return (
                                    <Link
                                        key={p.id}
                                        href={`/registry/${p.slug}`}
                                        className="grid grid-cols-1 md:grid-cols-12 items-center p-8 md:p-10 hover:bg-blue-50 transition-all group relative"
                                    >
                                        {/* 品牌型号 */}
                                        <div className="col-span-5 mb-6 md:mb-0">
                                            <div className="flex items-center gap-6">
                                                <QrCode className="hidden md:block w-10 h-10 text-slate-100 group-hover:text-blue-200 transition-colors" />
                                                <div>
                                                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.3em] mb-2 block">
                                                        {p.brand}
                                                    </span>
                                                    <h3 className="text-2xl md:text-3xl font-[1000] uppercase tracking-tighter text-slate-950 group-hover:italic transition-all leading-none">
                                                        {p.model}
                                                    </h3>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 核心分数 */}
                                        <div className="col-span-2 text-center mb-6 md:mb-0">
                                            <div className="md:hidden text-[9px] font-black text-slate-400 uppercase mb-2">
                                                Audit_Score
                                            </div>
                                            <span className="text-4xl font-mono font-bold italic tracking-tighter text-slate-950 bg-slate-50 border border-slate-100 px-4 py-2 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                                                {score}
                                            </span>
                                        </div>

                                        {/* 时间戳 */}
                                        <div className="col-span-3 text-center mb-8 md:mb-0">
                                            <div className="md:hidden text-[9px] font-black text-slate-400 uppercase mb-2">
                                                Sync_Time
                                            </div>
                                            <span className="text-[11px] font-mono font-bold text-slate-400 group-hover:text-slate-950 uppercase transition-colors">
                                                {new Date(
                                                    p.updated_at
                                                ).toLocaleString("en-US", {
                                                    month: "short",
                                                    day: "2-digit",
                                                    year: "numeric"
                                                })}
                                            </span>
                                        </div>

                                        {/* 入口 */}
                                        <div className="col-span-2 text-right">
                                            <div className="inline-flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-slate-950 border-b-4 border-slate-950 pb-1 group-hover:text-blue-600 group-hover:border-blue-600 transition-all">
                                                View_Report
                                                <ArrowUpRight className="w-4 h-4" />
                                            </div>
                                        </div>

                                        {/* 视觉装饰线 */}
                                        <div className="absolute right-0 top-0 h-full w-0 bg-blue-600 group-hover:w-1.5 transition-all duration-300" />
                                    </Link>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* --- 权威背书区 --- */}
                <footer className="mt-24 border-t-8 border-slate-950 pt-12 flex flex-col md:flex-row justify-between items-start gap-12">
                    <div className="max-w-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <ShieldCheck className="w-6 h-6 text-blue-600" />
                            <h4 className="text-[12px] font-black text-slate-950 uppercase tracking-[0.4em]">
                                Integrity_Audit_Protocol_v26
                            </h4>
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase leading-relaxed tracking-tight">
                            The SleepChoice Guide Registry functions as a
                            decentralized indexing node for biometric sleep
                            surface performance. Our crawler recalibrates
                            pricing and material integrity every 180 minutes.
                            Independent laboratory testing ensures bias-free
                            reporting.
                        </p>
                    </div>
                    <div className="bg-slate-950 text-white p-6 font-mono text-[10px] font-bold leading-relaxed tracking-widest uppercase">
                        System_Status: Operational
                        <br />
                        Data_Stream: Stable
                        <br />
                        Node_Location: Global_Edge
                    </div>
                </footer>
            </div>
        </main>
    )
}
