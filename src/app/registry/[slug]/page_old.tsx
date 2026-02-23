import { supabase } from "@/lib/supabase"
import { notFound } from "next/navigation"
import AuditRadarChart from "@/components/AuditRadarChart"
import Image from "next/image"
import {
    ShieldCheck,
    ExternalLink,
    Microscope,
    RefreshCcw,
    Fingerprint,
    ShieldAlert,
    Box,
    Layers,
    Plus,
    Minus,
    AlertCircle,
    ChevronRight
} from "lucide-react"

// --- 类型定义 (根据 Supabase 表结构) ---
interface AuditScores {
    overall: number;
    support: number;
    cooling: number;
    pressure: number;
    durability: number;
}

interface Offer {
    merchant: string;
    price: string | number;
    link: string;
}

interface Product {
    id: string;
    slug: string;
    brand: string;
    model: string;
    audit_scores: AuditScores | string;
    technical_specs: Record<string, string> | string;
    audit_data: { specs_matrix: Record<string, string> } | string;
    pros: string[];
    cons: string[];
    is_verified: boolean;
    image_url: string;
    updated_at: string;
    protocol_version: string;
    summary_log: string;
    audit_note: string;
    price: number;
    offers: Offer[] | string;
}

// --- 辅助解析函数 ---
const safeParse = <T,>(data: any, fallback: T): T => {
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch { return fallback; }
    }
    return data || fallback;
};

// --- 子组件：物理层级解剖 ---
const LayerStack = ({ specs }: { specs: any }) => {
    // 建议将来将此数据存入数据库，目前保持为 UI 展示
    const layers = [
        { name: "Euro Top Layer", height: "15%", color: "bg-slate-50", detail: "High-density foam" },
        { name: "Support Coil System", height: "35%", color: "bg-blue-100", detail: "884 Pocketed coils" },
        { name: "Base Steel Coil", height: "40%", color: "bg-slate-200", detail: "Tempered steel base" },
        { name: "Reinforced Edge", height: "10%", color: "bg-slate-950", detail: "High-density perimeter" }
    ];

    return (
        <div className="relative w-full py-10 px-6 bg-slate-50 border border-slate-200 overflow-hidden font-mono shadow-inner">
            <div className="absolute top-4 left-4 flex items-center gap-2">
                <Layers className="w-3 h-3 text-blue-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Structural_Decomposition</span>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-12 mt-8">
                {/* 3D 可视化堆栈 */}
                <div className="relative w-48 h-64 [perspective:1000px] transform-gpu -rotate-x-12 -rotate-y-12 shrink-0">
                    {layers.map((layer, idx) => (
                        <div
                            key={idx}
                            className={`${layer.color} border border-slate-950/20 absolute w-full transition-all duration-500 hover:translate-x-4 cursor-crosshair group/layer shadow-sm`}
                            style={{
                                height: layer.height,
                                bottom: `${layers.slice(0, idx).reduce((acc, l) => acc + parseInt(l.height), 0)}%`,
                                transform: `translateZ(${idx * 20}px)`,
                                zIndex: idx
                            }}
                        >
                            <div className="absolute inset-0 opacity-0 group-hover/layer:opacity-100 bg-blue-500/10 flex items-center justify-center">
                                <span className="text-[8px] font-black uppercase text-blue-600 tracking-tighter italic">Scan_Layer_{idx + 1}</span>
                            </div>
                        </div>
                    ))}
                </div>
                {/* 详情列表 */}
                <div className="flex-1 w-full space-y-3">
                    {[...layers].reverse().map((layer, idx) => (
                        <div key={idx} className="flex items-center gap-4 group">
                            <div className={`w-3 h-3 shrink-0 ${layer.color} border border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]`} />
                            <div className="flex-1 border-b border-slate-200 pb-1 flex justify-between items-baseline gap-4">
                                <span className="text-[10px] font-black uppercase group-hover:text-blue-600 transition-colors">{layer.name}</span>
                                <span className="text-[9px] text-slate-400 italic shrink-0">{layer.detail}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default async function ProductAuditPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    
    const { data: rawProduct, error } = await supabase
        .from("audit_products")
        .select("*")
        .eq("slug", slug)
        .single();

    if (error || !rawProduct) notFound();

    const product = rawProduct as Product;

    // --- 数据解析 ---
    const scores = safeParse<AuditScores>(product.audit_scores, { overall: 0, support: 0, cooling: 0, pressure: 0, durability: 0 });
    const technicalSpecs = safeParse<Record<string, string>>(product.technical_specs, {});
    const auditData = safeParse<any>(product.audit_data, {});
    const offers = safeParse<Offer[]>(product.offers, []);
    const specsMatrix = auditData?.specs_matrix || {};

    // --- 计算低价索引 ---
    const minPriceIndex = offers.length > 0
        ? offers.reduce((minIdx, curr, idx, arr) => 
            parseFloat(String(curr.price)) < parseFloat(String(arr[minIdx].price)) ? idx : minIdx, 0)
        : -1;

    const radarData = [
        { subject: "SUPPORT", A: scores.support },
        { subject: "COOLING", A: scores.cooling },
        { subject: "PRESSURE", A: scores.pressure },
        { subject: "DURABILITY", A: scores.durability },
        { subject: "INTEGRITY", A: scores.overall }
    ];

    return (
        <main className="min-h-screen bg-white text-slate-900 pb-20 pt-32 md:pt-44 font-sans selection:bg-blue-600 selection:text-white">
            {/*  */}
            
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org/",
                        "@type": "Product",
                        name: `${product.brand} ${product.model}`,
                        image: product.image_url,
                        description: product.summary_log,
                        brand: { "@type": "Brand", name: product.brand },
                        aggregateRating: {
                            "@type": "AggregateRating",
                            ratingValue: scores.overall,
                            bestRating: "10",
                            worstRating: "1",
                            ratingCount: "1"
                        },
                        offers: {
                            "@type": "AggregateOffer",
                            lowPrice: offers.length > 0 ? offers[minPriceIndex].price : product.price,
                            priceCurrency: "USD",
                            offerCount: offers.length
                        }
                    })
                }}
            />

            <div className="container mx-auto px-6 max-w-6xl relative z-10">
                {/* [ Header ] */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-16 pb-6 border-b border-slate-950 font-mono">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1 bg-slate-950 text-white text-[9px] font-black uppercase tracking-tighter">
                            <Fingerprint className="w-3 h-3 text-blue-500" />
                            LOG_ID: {product.id.split("-")[0]}
                        </div>
                        <div className="flex items-center bg-slate-50 border border-slate-200">
                            <div className={`text-[9px] font-bold px-2 py-1 uppercase tracking-widest flex items-center gap-2 ${product.is_verified ? "text-emerald-600 bg-emerald-50" : "text-slate-400"}`}>
                                {product.is_verified ? <ShieldCheck className="w-3 h-3" /> : <RefreshCcw className="w-3 h-3" />}
                                STATUS: {product.is_verified ? "VERIFIED_EVIDENCE" : "PRELIMINARY_SCAN"}
                            </div>
                            <div className="text-[9px] font-black px-2 py-1 bg-slate-200 text-slate-600 border-l border-slate-200 uppercase">
                                Last_Sync: {new Date(product.updated_at).toISOString().split("T")[0]}
                            </div>
                        </div>
                    </div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest group">
                        Protocol:{" "}
                        <a href="/methodology" className="text-blue-600 hover:bg-blue-600 hover:text-white px-1 transition-colors border-b border-blue-600/30">
                            {product.protocol_version || "v1.5-forensic"}
                            <ExternalLink className="w-2 h-2 inline-block ml-1 mb-0.5" />
                        </a>
                    </div>
                </header>

                <div className="grid lg:grid-cols-12 gap-16 items-start">
                    <div className="lg:col-span-8 space-y-20">
                        {/* 1. Main Image - 优化响应式与优先级 */}
                        <section className="relative group bg-slate-50 border border-slate-200 overflow-hidden">
                            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_49%,rgba(37,99,235,0.05)_50%,transparent_51%)] bg-[length:100%_4px] animate-pulse z-20 pointer-events-none opacity-50" />
                            <div className="relative aspect-video flex items-center justify-center p-12">
                                <Image
                                    src={product.image_url}
                                    alt={`${product.brand} ${product.model}`}
                                    width={1200}
                                    height={675}
                                    priority
                                    className="w-full h-full object-contain mix-blend-multiply contrast-110 saturate-50 group-hover:scale-105 transition-transform duration-1000"
                                />
                            </div>
                        </section>

                        {/* 2. Dashboard */}
                        <div>
                            <h1 className="text-5xl md:text-7xl lg:text-[90px] font-[1000] uppercase italic tracking-[-0.06em] leading-[0.85] mb-10 text-slate-950">
                                {product.brand} <span className="text-blue-600 not-italic">{product.model}</span>
                            </h1>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-slate-100 pt-8">
                                {radarData.slice(0, 4).map((m, i) => (
                                    <div key={i} className="space-y-1">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{m.subject}</div>
                                        <div className={`text-3xl font-black italic ${m.A === 0 ? "text-rose-500 font-mono text-xl not-italic" : "text-slate-950"}`}>
                                            {m.A === 0 ? "PENDING" : m.A}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3. Radar Chart */}
                        <section className="bg-slate-950 p-6 md:p-10 border border-slate-800 shadow-2xl">
                            <div className="h-[300px] md:h-[350px] w-full">
                                <AuditRadarChart data={radarData} />
                            </div>
                        </section>

                        <LayerStack specs={technicalSpecs} />

                        {/* 4. Pros & Cons */}
                        <section className="grid md:grid-cols-2 gap-px bg-slate-200 border border-slate-200 font-mono">
                            <div className="bg-white p-8 space-y-6">
                                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-600 tracking-[0.2em]">
                                    <Plus className="w-3 h-3" /> Performance_Gains
                                </h4>
                                <ul className="space-y-4">
                                    {product.pros?.map((pro, i) => (
                                        <li key={i} className="flex items-start gap-3 group">
                                            <ChevronRight className="w-3 h-3 mt-0.5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                                            <span className="text-[11px] font-bold text-slate-700 leading-tight uppercase">{pro}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="bg-white p-8 space-y-6">
                                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase text-rose-500 tracking-[0.2em]">
                                    <Minus className="w-3 h-3" /> System_Constraints
                                </h4>
                                <ul className="space-y-4">
                                    {product.cons?.map((con, i) => (
                                        <li key={i} className="flex items-start gap-3 group">
                                            <AlertCircle className="w-3 h-3 mt-0.5 text-slate-300 group-hover:text-rose-500 transition-colors" />
                                            <span className="text-[11px] font-bold text-slate-400 leading-tight uppercase">{con}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </section>

                        {/* 5. Forensic Analysis */}
                        <section className="space-y-10 font-mono">
                            <div className="flex items-center gap-4 text-slate-400">
                                <Microscope className="w-5 h-5 text-blue-600" />
                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] whitespace-nowrap">Forensic_Analysis_Notes</h4>
                                <div className="flex-1 h-px bg-slate-100" />
                            </div>
                            <div className="grid md:grid-cols-2 gap-x-12 gap-y-8 text-[11px] leading-relaxed text-slate-600">
                                {Object.entries(specsMatrix).map(([key, text]) => (
                                    <div key={key} className="space-y-3">
                                        <span className="text-blue-600 font-bold uppercase tracking-widest text-[9px] block">[{key}_Evaluation]</span>
                                        <p className="border-l border-slate-200 pl-4 italic">{text as string}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-slate-950 p-8 border-l-[12px] border-blue-600 text-white font-bold text-xl uppercase tracking-tight shadow-xl">
                                <div className="text-[9px] opacity-40 mb-2 tracking-[0.4em]">Final_Auditor_Verdict</div>
                                "{product.audit_note}"
                            </div>
                        </section>

                        {/* 6. Technical Raw Dataset */}
                        <section className="pt-10 border-t border-slate-100 font-mono text-[10px]">
                            <h4 className="font-black uppercase tracking-[0.3em] text-slate-400 mb-8 flex items-center gap-2">
                                <Box className="w-4 h-4" /> Technical_Dataset_Raw
                            </h4>
                            <div className="grid md:grid-cols-2 gap-x-16">
                                {Object.entries(technicalSpecs).map(([key, value]) => (
                                    <div key={key} className="flex justify-between border-b border-slate-50 py-3 items-center hover:bg-slate-50 transition-colors px-2">
                                        <span className="text-slate-400 uppercase tracking-tighter font-medium">{key}</span>
                                        <span className="text-slate-950 font-black">{value as string}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* [ RIGHT SIDEBAR ] */}
                    <aside className="lg:col-span-4 lg:sticky lg:top-40">
                        <div className="border-[6px] border-slate-950 p-8 bg-white shadow-[20px_20px_0px_0px_rgba(37,99,235,1)]">
                            <div className="mb-8 pb-4 border-b border-slate-100">
                                <p className="text-[9px] leading-relaxed text-slate-400 font-mono uppercase tracking-tighter italic">
                                    <span className="text-blue-600 font-bold not-italic">AFFILIATE_DISCLOSURE:</span> As an associate, we may earn from qualifying purchases through the gateways below.
                                </p>
                            </div>

                            <div className="text-center border-b border-slate-100 pb-10 mb-8 font-mono">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Efficiency_Rating</div>
                                <div className="text-[110px] font-[1000] italic text-slate-950 leading-none tracking-tighter">{scores.overall}</div>
                            </div>

                            <div className="bg-blue-600 text-white p-5 mb-10 font-mono shadow-lg">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase mb-2">
                                    <ShieldAlert className="w-4 h-4" /> System_Signal
                                </div>
                                <div className="text-[12px] font-bold uppercase leading-tight">
                                    {product.summary_log || "Asset acquisition portals stabilized."}
                                </div>
                            </div>

                            <div className="space-y-3 font-mono">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Verified_Gateways</span>
                                    <span className="text-[9px] text-slate-400">COUNT: {offers.length}</span>
                                </div>

                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 scroll-smooth no-scrollbar">
                                    {offers.length > 0 ? (
                                        offers.map((offer, idx) => {
                                            const isBest = idx === minPriceIndex;
                                            return (
                                                <a
                                                    key={idx}
                                                    href={offer.link || "#"}
                                                    target="_blank"
                                                    rel="nofollow noopener noreferrer"
                                                    className={`flex items-center justify-between w-full p-4 transition-all duration-300 group border-2 
                                                    ${isBest ? "border-blue-600 bg-blue-50/30" : "border-slate-950 hover:bg-slate-950"}`}
                                                >
                                                    <div className="flex flex-col items-start leading-none">
                                                        <span className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isBest ? "text-blue-600" : "text-slate-400 group-hover:text-slate-500"}`}>
                                                            {offer.merchant || "External_Source"}
                                                        </span>
                                                        <span className={`text-lg font-[1000] tracking-tighter ${isBest ? "text-slate-950" : "text-slate-950 group-hover:text-white"}`}>
                                                            ${offer.price}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {isBest && <span className="text-[7px] bg-blue-600 text-white px-1 py-0.5 animate-pulse">BEST_VALUE</span>}
                                                        <ExternalLink className={`w-5 h-5 ${isBest ? "text-blue-600" : "group-hover:text-white"}`} />
                                                    </div>
                                                </a>
                                            )
                                        })
                                    ) : (
                                        <div className="text-center py-6 border-2 border-dashed border-slate-200 text-slate-400 text-[10px] uppercase font-bold">No active gateways found.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    )
}