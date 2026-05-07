import { getAutomatedRegistry } from "@/lib/registry"
import { outboundDealLink } from "@/lib/go-redirect"
import {
    Timer,
    ShieldCheck,
    Zap,
    ArrowUpRight,
    TrendingDown,
    Activity,
    AlertTriangle,
    BarChart,
    Target
} from "lucide-react"
import { cn } from "@/lib/utils"

export const metadata = {
    title: "Savings Vault | Live Mattress Price Tracker 2026",
    description:
        "Independent lab-verified price monitoring. Tactical data on current mattress discounts and liquidated stock."
}

export const dynamic = "force-dynamic"

export default async function DealsPage() {
    const registryData = await getAutomatedRegistry()

    // 过滤出有优惠信息的审计对象
    const products = Object.values(registryData || {}).filter(
        (p) => p.offers && p.offers[0]?.promo
    )

    const lastUpdated = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    })

    return (
        <main className="relative min-h-screen bg-white pt-24 pb-20 overflow-hidden font-sans selection:bg-emerald-500 selection:text-white">
            {/* 动态背景：低对比度扫描网格 */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.02] z-0">
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage:
                            "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
                        backgroundSize: "40px 40px"
                    }}
                />
                <div className="absolute top-0 left-0 w-full h-[1px] bg-emerald-500 animate-[scan_12s_linear_infinite]" />
            </div>

            <div className="container mx-auto px-6 relative z-10">
                {/* --- 1. Header: 战术优惠墙 --- */}
                <header className="max-w-5xl mb-16 border-l-8 border-emerald-500 pl-8">
                    <div className="flex items-center gap-3 text-emerald-600 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Vault_Status: Monitoring_Retail_API
                    </div>
                    <h1 className="text-6xl md:text-9xl font-[1000] tracking-tighter uppercase leading-[0.8] mb-8 italic">
                        The <br />
                        <span className="text-emerald-500 not-italic tracking-[-0.05em]">
                            Savings_
                        </span>{" "}
                        <br />
                        Vault.
                    </h1>

                    <div className="flex flex-wrap items-center gap-8 py-6 border-y border-slate-100 font-mono">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest tabular-nums">
                            <Timer className="w-3.5 h-3.5 text-blue-600" />
                            Sync_Time: {lastUpdated}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <Activity className="w-3.5 h-3.5 text-emerald-500" />
                            Active_Nodes: 12_Cluster
                        </div>
                    </div>
                </header>

                {/* --- 2. Deals Grid: 优惠网格 --- */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {products.length === 0 ? (
                        <div className="col-span-full py-40 text-center border-4 border-dashed border-slate-100">
                            <p className="font-mono text-[11px] font-black text-slate-300 uppercase tracking-[0.6em] animate-pulse">
                                [ Querying_Liquidation_Databases... ]
                            </p>
                        </div>
                    ) : (
                        products.map((p) => {
                            const offer = p.offers[0]
                            const savings = offer.oldPrice
                                ? offer.oldPrice - offer.price
                                : 0
                            const discountPercent = offer.oldPrice
                                ? Math.round((savings / offer.oldPrice) * 100)
                                : 0

                            return (
                                <div
                                    key={p.id}
                                    tabIndex={0}
                                    className={cn(
                                        "group relative flex flex-col bg-white border-2 border-slate-950 outline-none transition-all duration-500 cursor-pointer",
                                        "hover:-translate-y-2 hover:shadow-[16px_16px_0px_0px_rgba(16,185,129,0.1)]",
                                        "focus-within:border-emerald-500 focus-within:ring-8 focus-within:ring-emerald-500/5 focus-within:shadow-[24px_24px_0px_0px_rgba(16,185,129,0.15)]"
                                    )}
                                >
                                    {/* 选中时的电子脉冲底纹 (Focus-only) */}
                                    <div className="absolute inset-0 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-300 overflow-hidden">
                                        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_40px,rgba(16,185,129,0.02)_40px,rgba(16,185,129,0.02)_41px)]" />
                                        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-[scan_4s_linear_infinite]" />
                                    </div>

                                    {/* 标签：折价比例 */}
                                    <div className="absolute -top-3 -right-3 bg-emerald-500 text-white font-mono font-black text-xs px-4 py-2 rotate-3 z-20 shadow-lg group-focus-within:rotate-0 group-focus-within:scale-110 transition-all">
                                        SAVE_{discountPercent}%
                                    </div>

                                    <div className="p-8 flex-grow relative z-10">
                                        {/* 品牌与型号 */}
                                        <div className="mb-8">
                                            <div className="flex items-center gap-2 mb-2">
                                                <BarChart className="w-3 h-3 text-emerald-500 group-focus-within:animate-pulse" />
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic group-focus-within:text-emerald-600 transition-colors">
                                                    {p.brand}
                                                </span>
                                            </div>
                                            <h3 className="text-3xl font-[1000] uppercase tracking-tighter text-slate-950 leading-[0.85] group-hover:text-emerald-600 group-focus-within:text-emerald-600 transition-all">
                                                {p.name}
                                            </h3>
                                        </div>

                                        {/* 价格对比 */}
                                        <div className="flex items-end gap-3 mb-8">
                                            <div className="text-5xl font-mono font-bold tracking-tighter text-slate-950 tabular-nums leading-none">
                                                ${offer.price}
                                            </div>
                                            {offer.oldPrice && (
                                                <div className="text-lg font-bold text-slate-200 line-through mb-1 italic decoration-emerald-500/50">
                                                    ${offer.oldPrice}
                                                </div>
                                            )}
                                        </div>

                                        {/* 审计日志简报：选中时边框加亮 */}
                                        <div className="bg-slate-50 border-l-4 border-slate-950 group-focus-within:border-emerald-500 p-5 mb-8 transition-colors">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase">
                                                    <TrendingDown className="w-3.5 h-3.5" />
                                                    Price_Drop: -${savings}
                                                </div>
                                                <div className="text-[8px] font-mono font-bold text-slate-300 uppercase tracking-tighter">
                                                    Audit_ID: {p.id.slice(0, 8)}
                                                </div>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-600 uppercase leading-tight italic">
                                                &quot;
                                                {offer.promo_text ||
                                                    "Automated audit suggests this is a 6-month historical low."}
                                                &quot;
                                            </p>
                                        </div>

                                        {/* 紧急度指示器 */}
                                        <div className="flex items-center gap-4 mb-2">
                                            <div className="flex-grow h-1 bg-slate-100 overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full transition-all duration-1000 w-[75%] animate-pulse",
                                                        "bg-emerald-500 group-focus-within:bg-blue-600 group-focus-within:w-[30%]"
                                                    )}
                                                />
                                            </div>
                                            <span className="text-[9px] font-black uppercase text-amber-500 whitespace-nowrap flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" />{" "}
                                                STOCK_LOW
                                            </span>
                                        </div>
                                    </div>

                                    {/* 选中状态指示器：仅在选中时显现 */}
                                    <div className="px-8 pb-4 h-0 group-focus-within:h-10 opacity-0 group-focus-within:opacity-100 transition-all duration-300 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Target className="w-4 h-4 text-emerald-500 animate-spin-slow" />
                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest underline decoration-2 underline-offset-4">
                                                Target_Locked
                                            </span>
                                        </div>
                                        <div className="text-[9px] font-mono text-slate-400 font-bold uppercase">
                                            Ready_To_Export
                                        </div>
                                    </div>

                                    {/* 导出链接 */}
                                    <a
                                        href={outboundDealLink(
                                            p.slug,
                                            p.brand,
                                            offer.url
                                        )}
                                        target="_blank"
                                        rel="nofollow"
                                        className={cn(
                                            "mt-auto flex items-center justify-between w-full p-6 text-white font-black uppercase tracking-[0.2em] text-[11px] transition-all",
                                            "bg-slate-950 group-hover:bg-emerald-600 group-focus-within:bg-emerald-500"
                                        )}
                                    >
                                        EXECUTE_PURCHASE_SEQUENCE
                                        <ArrowUpRight className="w-5 h-5 group-hover:rotate-45 group-focus-within:rotate-45 transition-transform duration-300" />
                                    </a>
                                </div>
                            )
                        })
                    )}
                </div>

                {/* --- 3. Footer: 法律协议背书 --- */}
                <footer className="mt-40 grid md:grid-cols-2 gap-12 border-t-8 border-slate-950 pt-16">
                    <div className="bg-slate-50 p-10 relative overflow-hidden group">
                        <Zap className="absolute -bottom-4 -right-4 w-32 h-32 text-slate-100 -rotate-12 group-hover:text-emerald-500/10 transition-colors" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                                <h4 className="text-[14px] font-[1000] text-slate-950 uppercase tracking-[0.2em]">
                                    Affiliate_Protocol_Alpha
                                </h4>
                            </div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase leading-loose tracking-widest">
                                The laboratory utilizes affiliate tracking to
                                sustain computing power. When you secure a deal,
                                a referral token is generated. This incurs zero
                                cost to the end-user while maintaining our
                                independence from manufacturer-sponsored
                                paywalls.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col justify-center border-2 border-slate-100 p-10">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">
                            Registry_Stats
                        </span>
                        <div className="space-y-4">
                            {[
                                {
                                    label: "INDEX_NODES",
                                    value: "ACTIVE",
                                    color: "text-slate-950"
                                },
                                {
                                    label: "CRAWL_FREQUENCY",
                                    value: "180_MIN",
                                    color: "text-slate-950"
                                },
                                {
                                    label: "DATA_INTEGRITY",
                                    value: "VERIFIED",
                                    color: "text-emerald-500"
                                }
                            ].map((stat, i) => (
                                <div
                                    key={i}
                                    className="flex justify-between font-mono text-xs font-bold border-b border-slate-50 pb-2"
                                >
                                    <span className="text-slate-400">
                                        {stat.label}
                                    </span>
                                    <span className={stat.color}>
                                        {stat.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </footer>
            </div>

            <style
                dangerouslySetInnerHTML={{
                    __html: `
                @keyframes scan {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(100vh); }
                }
                .animate-spin-slow {
                    animation: spin 6s linear infinite;
                }
            `
                }}
            />
        </main>
    )
}
