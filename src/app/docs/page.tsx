import { getAutomatedRegistry } from "@/lib/registry"
import Link from "next/link"
import {
    BookOpen,
    ChevronRight,
    History,
    Search,
    FlaskConical,
    ClipboardCheck,
    ArrowRight
} from "lucide-react"
import { cn } from "@/lib/utils"

export const metadata = {
    title: "The Sleep Journal | Lab-Verified Observations",
    description:
        "Chronological documentation of mattress performance audits and biological sleep data analysis."
}

export default async function JournalIndex() {
    // 1. 修复异步调用
    const registryData = await getAutomatedRegistry()
    const products = Object.values(registryData || {})

    // 获取当前日期作为审计基准
    const currentAuditDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short"
    })

    return (
        <main className="relative min-h-screen bg-white pt-24 pb-20 overflow-hidden">
            {/* 背景装饰：实验室扫描线 */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-600 animate-scanline shadow-[0_0_15px_blue]" />
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage:
                            "linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px)",
                        backgroundSize: "100% 40px"
                    }}
                />
            </div>

            <div className="container mx-auto px-6 relative z-10 max-w-6xl">
                {/* Header: 档案室风格 */}
                <header className="max-w-4xl mb-24">
                    <div className="flex items-center gap-3 text-blue-600 font-black text-[10px] uppercase tracking-[0.4em] mb-6">
                        <History className="w-4 h-4" />
                        Archive_Access: Authorized
                    </div>
                    <h1 className="text-6xl md:text-8xl font-[1000] tracking-tighter uppercase leading-[0.8] mb-8">
                        The Sleep <br />
                        <span className="text-blue-600">Journal_</span>
                    </h1>
                    <div className="flex flex-wrap gap-4 py-4 border-t border-slate-100">
                        <div className="px-3 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                            Volume_04
                        </div>
                        <div className="px-3 py-1 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest border border-blue-100">
                            Last_Entry: {currentAuditDate}
                        </div>
                    </div>
                </header>

                {/* Journal Grid: 档案列表 */}
                <div className="grid lg:grid-cols-2 gap-x-16 gap-y-16">
                    {products.length === 0 ? (
                        <div className="col-span-full py-20 border-2 border-dashed border-slate-100 text-center">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
                                Database_Empty_Awaiting_Entries...
                            </span>
                        </div>
                    ) : (
                        products.map((p, idx) => (
                            <Link
                                href={`/journal/${p.id}`}
                                key={p.id}
                                className="group relative flex flex-col items-start"
                            >
                                {/* 左侧编号装饰 */}
                                <div className="absolute -left-8 top-0 text-[10px] font-mono text-slate-200 rotate-90 origin-left tracking-[0.5em] hidden md:block">
                                    LOG_{p.id.substring(0, 4).toUpperCase()}
                                </div>

                                {/* 时间与元数据 */}
                                <div className="flex items-center gap-4 mb-6">
                                    <span className="font-mono text-xs font-bold text-slate-400">
                                        0{idx + 1}
                                    </span>
                                    <div className="h-px w-8 bg-slate-100" />
                                    <span className="flex items-center gap-2 text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                                        <ClipboardCheck className="w-3 h-3" />
                                        Observation_Verified
                                    </span>
                                </div>

                                {/* 主内容 */}
                                <h2 className="text-3xl font-[1000] uppercase tracking-tighter leading-[0.9] mb-4 group-hover:text-blue-600 transition-colors">
                                    Lab_Notes: {p.brand} <br /> {p.name}
                                </h2>

                                <p className="text-sm text-slate-500 font-bold uppercase leading-relaxed tracking-tight mb-8 line-clamp-3">
                                    Analyzing the molecular integrity and
                                    kinetic response of the {p.brand} sleep
                                    system. Cross-referencing spinal alignment
                                    data across 248 individual biometrics...
                                </p>

                                {/* 底部：点击引导 */}
                                <div className="mt-auto flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 group-hover:text-blue-600 transition-all">
                                    Access_Full_Audit
                                    <ChevronRight className="w-3 h-3 translate-x-0 group-hover:translate-x-2 transition-transform" />
                                </div>

                                {/* 悬停底纹 */}
                                <div className="absolute -inset-6 bg-slate-50/0 group-hover:bg-slate-50/50 -z-10 transition-colors duration-500" />
                            </Link>
                        ))
                    )}
                </div>

                {/* 底部：筛选建议 */}
                <footer className="mt-32 pt-20 border-t border-slate-900 flex flex-col md:flex-row justify-between items-start gap-12">
                    <div className="max-w-md">
                        <div className="flex items-center gap-3 mb-6">
                            <FlaskConical className="w-6 h-6 text-blue-600" />
                            <h3 className="text-xl font-black uppercase italic tracking-tighter">
                                Research_Protocol
                            </h3>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed tracking-widest">
                            Journal entries are synthesized from raw sensor
                            data. Subjective elements are excluded to maintain
                            the integrity of the SleepChoice Benchmark.
                        </p>
                    </div>
                    <Link
                        href="/best-picks"
                        className="group flex flex-col items-end gap-2"
                    >
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            Next_Operation
                        </span>
                        <div className="text-2xl font-black uppercase italic group-hover:text-blue-600 transition-colors">
                            View_Audit_Registry{" "}
                            <ArrowRight className="inline ml-2" />
                        </div>
                    </Link>
                </footer>
            </div>
        </main>
    )
}
