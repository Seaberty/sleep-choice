import { getAutomatedRegistry } from "@/lib/registry"
import {
    Tag,
    Timer,
    AlertCircle,
    ExternalLink,
    ShieldCheck,
    Zap,
    ArrowUpRight,
    TrendingDown
} from "lucide-react"
import { cn } from "@/lib/utils"

export const metadata = {
    title: "Savings Vault | Live Mattress Price Tracker 2026",
    description:
        "Independent lab-verified price monitoring. Tactical data on current mattress discounts and liquidated stock."
}

export default async function DealsPage() {
    const registryData = await getAutomatedRegistry()
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
        <main className="relative min-h-screen bg-white pt-24 pb-20 overflow-hidden">
            {/* 实时监控背景网格 */}
            <div
                className="fixed inset-0 pointer-events-none opacity-[0.02]"
                style={{
                    backgroundImage:
                        "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
                    backgroundSize: "32px 32px"
                }}
            />

            <div className="container mx-auto px-6 relative z-10">
                {/* 1. Header: 强化实时审计感 */}
                <header className="max-w-5xl mb-16 border-l-4 border-emerald-500 pl-8">
                    <div className="flex items-center gap-3 text-emerald-600 font-black text-[10px] uppercase tracking-[0.3em] mb-4">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        System_Status: Monitoring_Live_Deals
                    </div>
                    <h1 className="text-5xl md:text-8xl font-[1000] tracking-tighter uppercase leading-[0.8] mb-8 italic">
                        The{" "}
                        <span className="text-blue-600 not-italic">
                            Savings_
                        </span>{" "}
                        <br />
                        Vault.
                    </h1>

                    <div className="flex flex-wrap items-center gap-6 py-4 border-y border-slate-100">
                        <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                            <Timer className="w-3.5 h-3.5 text-blue-600" />
                            Last_Sync: {lastUpdated}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            Verified_Offers: {products.length}
                        </div>
                    </div>
                </header>

                {/* 2. Deals Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.length === 0 ? (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100">
                            <p className="font-mono text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">
                                Scanning_All_Retailers...
                            </p>
                        </div>
                    ) : (
                        products.map((p) => {
                            const offer = p.offers[0]
                            const savings = offer.oldPrice
                                ? offer.oldPrice - offer.price
                                : null

                            return (
                                <div
                                    key={p.id}
                                    className="group relative bg-white border border-slate-200 p-0 transition-all duration-300 hover:border-blue-600 shadow-sm hover:shadow-xl"
                                >
                                    {/* 折扣百分比标签 */}
                                    <div className="absolute top-0 right-0 bg-blue-600 text-white font-mono font-black text-[11px] px-3 py-1.5 z-20">
                                        -
                                        {Math.round(
                                            (savings! / offer.oldPrice!) * 100
                                        )}
                                        %
                                    </div>

                                    <div className="p-8">
                                        <div className="mb-6">
                                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em]">
                                                {p.brand}
                                            </span>
                                            <h3 className="text-xl font-black uppercase tracking-tight text-slate-950 mt-1">
                                                {p.name}
                                            </h3>
                                        </div>

                                        {/* 价格分析 */}
                                        <div className="flex items-baseline gap-2 mb-6">
                                            <span className="text-4xl font-mono font-bold tracking-tighter text-slate-950">
                                                ${offer.price}
                                            </span>
                                            {offer.oldPrice && (
                                                <span className="text-sm font-bold text-slate-300 line-through">
                                                    ${offer.oldPrice}
                                                </span>
                                            )}
                                        </div>

                                        {/* 动态审计条 */}
                                        <div className="bg-slate-50 p-4 border-l-2 border-emerald-500 mb-8">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase mb-1">
                                                <TrendingDown className="w-3 h-3" />
                                                Instant_Savings: ${savings}
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed">
                                                {offer.promo_text ||
                                                    "Lowest price detected in 30 days."}
                                            </p>
                                        </div>

                                        {/* CTA: 外部链接 */}
                                        <a
                                            href={offer.url}
                                            target="_blank"
                                            rel="nofollow"
                                            className="flex items-center justify-between w-full p-4 bg-slate-950 text-white font-black uppercase tracking-widest text-[10px] group-hover:bg-blue-600 transition-all"
                                        >
                                            Claim_Offer
                                            <ArrowUpRight className="w-4 h-4" />
                                        </a>
                                    </div>

                                    {/* 卡片底部装饰线 */}
                                    <div className="h-1 w-0 bg-blue-600 group-hover:w-full transition-all duration-500" />
                                </div>
                            )
                        })
                    )}
                </div>

                {/* 3. Transparency Protocol */}
                <footer className="mt-32 max-w-4xl">
                    <div className="p-10 border-4 border-slate-950">
                        <div className="flex items-center gap-3 mb-6">
                            <Zap className="w-5 h-5 text-blue-600 fill-blue-600" />
                            <h4 className="text-[12px] font-black text-slate-950 uppercase tracking-[0.3em]">
                                Affiliate_Disclosure_Protocol
                            </h4>
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase leading-relaxed tracking-tight">
                            Prices are indexed every 180 minutes via our
                            proprietary crawler. SleepChoice Guide maintains
                            independent testing protocols. We may receive a
                            referral fee from retailers at zero cost to the
                            user. This model ensures the laboratory remains
                            bias-free and paywall-free.
                        </p>
                    </div>
                </footer>
            </div>
        </main>
    )
}
