import { getAutomatedRegistry } from "@/lib/registry"
import { passesDealFilter } from "@/lib/deals-utils"
import { DealsVault } from "@/app/deals/deals-vault"
import { Timer, ShieldCheck, Zap, Activity } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Savings Vault · Arbitrage Feed",
    description:
        "Real-time retail arbitrage surveillance on registry-indexed mattresses (scores from aggregated review + listing intelligence): deals & coupons tracked against our audit narrative.",
    alternates: { canonical: "/deals" }
}

export const dynamic = "force-dynamic"

/** Deals 页拉取更大上限供前端筛选（与列表默认 12 条区分） */
const DEALS_REGISTRY_LIMIT = 200

export default async function DealsPage() {
    const rawRegistry = await getAutomatedRegistry(DEALS_REGISTRY_LIMIT)
    const products = rawRegistry.filter(passesDealFilter)

    const poolForSync =
        products.length > 0 ? products : rawRegistry
    const syncTimes = poolForSync
        .map((p) => new Date(p.last_audited_at).getTime())
        .filter((t) => Number.isFinite(t))
    const latestMs =
        syncTimes.length > 0 ? Math.max(...syncTimes) : Date.now()

    const lastUpdated = new Date(latestMs).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    })

    return (
        <main className="relative min-h-screen bg-white pt-24 pb-20 overflow-x-hidden font-sans selection:bg-emerald-500 selection:text-white">
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
                    <p className="mb-8 max-w-3xl text-sm font-medium leading-relaxed text-slate-600 normal-case tracking-tight">
                        Real-time arbitrage surveillance on verified audit
                        listings: discounts, coupons, and tactical savings indexed
                        against the same forensic dossiers as the registry.
                    </p>

                    <div className="flex flex-wrap items-center gap-8 py-6 border-y border-slate-100 font-mono">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest tabular-nums">
                            <Timer className="w-3.5 h-3.5 text-blue-600" />
                            Sync_Time: {lastUpdated}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <Activity className="w-3.5 h-3.5 text-emerald-500" />
                            AUDIT_MODELS: {products.length}
                        </div>
                    </div>
                </header>

                <DealsVault products={products} />

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
                                SleepChoice utilizes affiliate tracking to
                                sustain computing pipelines. When you secure a
                                deal, a referral token is generated. This
                                incurs zero cost to the end-user while
                                maintaining our independence from
                                manufacturer-sponsored paywalls.
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
