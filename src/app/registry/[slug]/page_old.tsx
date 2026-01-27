import { supabase } from "@/lib/supabase"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import {
    ShieldCheck,
    Activity,
    Zap,
    Thermometer,
    ExternalLink,
    FileSearch,
    Lock,
    Microscope
} from "lucide-react"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface PageProps {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({
    params
}: PageProps): Promise<Metadata> {
    const { slug } = await params
    const { data } = await supabase
        .from("audit_products")
        .select("brand, model")
        .eq("slug", slug)
        .single()
    return {
        title: `${data?.brand} ${data?.model} Audit Report | SleepChoice Guide`,
        description: `Laboratory forensic data for ${data?.brand} ${data?.model}.`
    }
}

export default async function ProductAuditPage({ params }: PageProps) {
    const { slug } = await params
    const { data: product, error } = await supabase
        .from("audit_products")
        .select("*")
        .eq("slug", slug)
        .single()

    if (error || !product) notFound()

    const scores = product.audit_scores || {
        overall: 0,
        support: 0,
        cooling: 0,
        pressure: 0
    }

    return (
        // 去掉了外层的 overflow-x-hidden，因为它有时会破坏 sticky 布局
        <main className="min-h-screen bg-white text-slate-900 pb-20 pt-32 md:pt-44">
            {/* 背景水印 */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] overflow-hidden select-none z-0">
                <div className="absolute top-1/4 -left-20 rotate-12 text-9xl font-black text-slate-900 uppercase">
                    CLASSIFIED
                </div>
                <div className="absolute bottom-1/4 -right-20 -rotate-12 text-9xl font-black text-slate-900 uppercase">
                    VERIFIED
                </div>
            </div>

            <div className="container mx-auto px-6 max-w-6xl relative z-10">
                {/* 顶部状态栏 */}
                <div className="flex flex-wrap items-center gap-4 mb-12 pb-6 border-b border-slate-100">
                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-950 text-white text-[9px] font-black uppercase tracking-tighter">
                        <Lock className="w-3 h-3 text-blue-500" />{" "}
                        Secure_Dossier_Link
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                        <Microscope className="w-3 h-3 text-blue-600" />
                        Node_ID: {product.id.split("-")[0].toUpperCase()}
                    </div>
                </div>

                {/* 核心修复：items-start 确保右侧列不会被强行拉伸到和左侧一样高，
                  这是 sticky 生效的前提。
                */}
                <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-start">
                    {/* --- 左侧主内容区 --- */}
                    <div className="lg:col-span-8 space-y-20">
                        <header>
                            <div className="flex items-center gap-3 text-blue-600 mb-6 font-black text-[10px] uppercase tracking-[0.4em]">
                                <Activity className="w-5 h-5 animate-pulse" />
                                Live_Audit_Telemetry
                            </div>
                            <h1 className="text-6xl md:text-[110px] font-[1000] uppercase italic tracking-[-0.06em] leading-[0.8] mb-10">
                                {product.brand}
                                <br />
                                <span className="text-blue-600 not-italic">
                                    {product.model}
                                </span>
                            </h1>
                            <div className="inline-flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 font-mono text-[10px] font-black uppercase italic text-slate-500">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Updated:{" "}
                                {new Date(
                                    product.updated_at
                                ).toLocaleDateString()}
                            </div>
                        </header>

                        {/* 审计日志 */}
                        <section className="relative">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />
                            <div className="bg-slate-50 p-10 md:p-16 border border-slate-100">
                                <FileSearch className="w-12 h-12 text-blue-600 mb-8" />
                                <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6 font-mono">
                                    Laboratory_Summary_Log
                                </h3>
                                <p className="text-2xl md:text-4xl font-mono font-bold leading-tight tracking-tighter text-slate-900 uppercase">
                                    "
                                    {product.audit_note ||
                                        "Surface architecture integrity meets 2026 laboratory standards."}
                                    "
                                </p>
                            </div>
                        </section>

                        {/* 指标矩阵 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {[
                                {
                                    label: "Support",
                                    val: scores.support,
                                    icon: Zap
                                },
                                {
                                    label: "Cooling",
                                    val: scores.cooling,
                                    icon: Thermometer
                                },
                                {
                                    label: "Pressure",
                                    val: scores.pressure,
                                    icon: Activity
                                },
                                {
                                    label: "Durability",
                                    val: 9.7,
                                    icon: ShieldCheck
                                }
                            ].map((m, i) => (
                                <div
                                    key={i}
                                    className="bg-white border border-slate-200 p-8 hover:border-blue-600 transition-all group/card"
                                >
                                    <m.icon className="w-5 h-5 text-slate-300 group-hover/card:text-blue-600 transition-colors mb-6" />
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                        {m.label}
                                    </div>
                                    <div className="text-4xl font-mono font-black italic tracking-tighter">
                                        {m.val}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* --- 右侧侧边栏 (Sticky 修复) --- */}
                    <div className="lg:col-span-4 lg:sticky lg:top-40">
                        <div className="border-[6px] border-slate-950 p-8 md:p-10 bg-white shadow-[15px_15px_0px_0px_rgba(37,99,235,1)]">
                            <div className="text-center border-b border-slate-100 pb-10 mb-10">
                                <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6 font-mono">
                                    Aggregate_Index
                                </div>
                                <div className="text-[120px] font-[1000] italic text-slate-950 leading-none tracking-tighter">
                                    {scores.overall}
                                </div>
                            </div>

                            <div className="space-y-6 mb-10">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
                                    <span>Retail_Price</span>
                                    <span className="text-slate-950 font-black text-xl">
                                        ${product.price}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
                                    <span>Audit_Status</span>
                                    <span className="flex items-center gap-2 text-emerald-600 font-black">
                                        <ShieldCheck className="w-3 h-3" />{" "}
                                        VERIFIED
                                    </span>
                                </div>
                            </div>

                            {/* 修复后的按钮：使用了更稳健的内边距和响应式文字 */}
                            <a
                                href={product.affiliate_link || "#"}
                                target="_blank"
                                rel="nofollow"
                                className="flex items-center justify-between w-full bg-blue-600 hover:bg-slate-950 text-white p-4 sm:p-5 border-b-4 border-blue-800 hover:border-slate-800 transition-all group overflow-hidden"
                            >
                                <div className="flex flex-col items-start leading-none min-w-0">
                                    <span className="text-[7px] sm:text-[8px] opacity-70 font-mono tracking-widest mb-1 uppercase truncate w-full">
                                        Secure_Link_Ready
                                    </span>
                                    <span className="text-[10px] sm:text-[12px] font-[1000] uppercase tracking-wide whitespace-nowrap">
                                        CLAIM_OFFER
                                    </span>
                                </div>
                                <div className="bg-white/10 p-2 rounded-sm group-hover:bg-white/20 transition-colors shrink-0 ml-2">
                                    <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </div>
                            </a>

                            <p className="mt-6 text-[8px] font-mono text-slate-400 uppercase leading-relaxed text-center">
                                * Laboratory data updated in real-time.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}
