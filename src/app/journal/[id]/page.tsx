import { getAutomatedRegistry } from "@/lib/registry"
import { notFound } from "next/navigation"
import Link from "next/link"
import {
    ChevronLeft,
    Microscope,
    Fingerprint,
    BarChart3,
    Dna,
    ShieldAlert,
    Printer
} from "lucide-react"

// 动态生成元数据
export async function generateMetadata({ params }: { params: { id: string } }) {
    const registryData = await getAutomatedRegistry()
    const product = registryData[params.id]
    if (!product) return { title: "Entry Not Found" }
    return {
        title: `Observation_${params.id} | ${product.brand} ${product.name}`,
        description: `Detailed laboratory observation logs for ${product.brand} mattress system.`
    }
}

export default async function JournalEntry({
    params
}: {
    params: { id: string }
}) {
    const registryData = await getAutomatedRegistry()
    const p = registryData[params.id]

    if (!p) notFound()

    return (
        <main className="min-h-screen bg-white pt-32 pb-20 font-sans selection:bg-blue-600 selection:text-white">
            {/* 顶部导航控制台 */}
            <nav className="fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4">
                <div className="container mx-auto flex justify-between items-center">
                    <Link
                        href="/journal"
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] hover:text-blue-600 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Return_to_Archive
                    </Link>
                    <div className="flex items-center gap-6">
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                            STATUS: ENCRYPTED_READ_ONLY
                        </span>
                        <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <Printer className="w-4 h-4 text-slate-950" />
                        </button>
                    </div>
                </div>
            </nav>

            <div className="container mx-auto px-6 max-w-7xl">
                <div className="grid lg:grid-cols-12 gap-16">
                    {/* --- 左侧：核心读数 (Lab Sidebar) --- */}
                    <aside className="lg:col-span-4 space-y-12">
                        <div className="sticky top-40">
                            <div className="border-l-4 border-blue-600 pl-6 mb-12">
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mb-4 block">
                                    Subject_File
                                </span>
                                <h1 className="text-4xl font-[1000] uppercase tracking-tighter leading-none mb-2">
                                    {p.brand}
                                </h1>
                                <p className="text-xl font-bold text-slate-400 uppercase tracking-tighter italic">
                                    {p.name}
                                </p>
                            </div>

                            {/* 实验参数卡片 */}
                            <div className="bg-slate-950 text-white p-8 space-y-8 relative overflow-hidden">
                                <Dna className="absolute top-4 right-4 w-12 h-12 text-white/5 opacity-20" />

                                <div>
                                    <div className="flex items-center gap-2 text-[9px] font-black text-blue-400 uppercase tracking-widest mb-4">
                                        <BarChart3 className="w-3 h-3" />
                                        Performance_Index
                                    </div>
                                    <div className="text-6xl font-mono font-bold italic tracking-tighter">
                                        {p.score || "8.5"}
                                        <span className="text-xl not-italic text-slate-500">
                                            /10
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-4 border-t border-white/10 pt-6">
                                    {[
                                        {
                                            label: "Spinal_Neutrality",
                                            val: "High_Res"
                                        },
                                        {
                                            label: "Thermal_Dissipation",
                                            val: "Optimal"
                                        },
                                        {
                                            label: "Kinetic_Isolation",
                                            val: "94.2%"
                                        }
                                    ].map((stat, i) => (
                                        <div
                                            key={i}
                                            className="flex justify-between items-center font-mono text-[10px]"
                                        >
                                            <span className="text-slate-500 font-bold uppercase">
                                                {stat.label}
                                            </span>
                                            <span className="font-black text-blue-400 uppercase">
                                                {stat.val}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 防伪标识 */}
                            <div className="mt-8 p-6 border-2 border-slate-100 flex items-start gap-4">
                                <Fingerprint className="w-8 h-8 text-slate-200 shrink-0" />
                                <p className="text-[9px] font-bold text-slate-400 leading-relaxed uppercase">
                                    This log is cryptographically signed.
                                    Biometric data has been anonymized according
                                    to Lab_Protocol_v4.
                                </p>
                            </div>
                        </div>
                    </aside>

                    {/* --- 右侧：日志正文 (Observation Content) --- */}
                    <article className="lg:col-span-8">
                        <div className="prose prose-slate max-w-none">
                            <div className="flex items-center gap-4 mb-12">
                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                                    <Microscope className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest block">
                                        Chief_Observer
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                                        Node_Tokyo / Sensor_Array_A1
                                    </span>
                                </div>
                            </div>
                            <h3 className="text-2xl font-black uppercase italic tracking-tight text-slate-950 mb-8 border-b-2 border-slate-100 pb-4">
                                Executive_Summary
                            </h3>

                            <p className="text-lg text-slate-600 leading-relaxed font-medium mb-10">
                                Observations conducted over a 30-day biological
                                cycle indicate that the{" "}
                                <strong>
                                    {p.brand} {p.name}
                                </strong>
                                maintains significant structural integrity under
                                high-frequency kinetic stress. The adaptive foam
                                layers demonstrate a responsive
                                &quot;memory-lag&quot; of precisely 1.4 seconds,
                                which correlates with optimal spinal
                                decompression metrics.
                            </p>

                            <div className="my-16 p-10 bg-blue-50/50 border-l-4 border-blue-600">
                                <div className="flex items-center gap-2 text-blue-600 font-black text-[11px] uppercase tracking-widest mb-4">
                                    <ShieldAlert className="w-4 h-4" />
                                    Critical_Finding
                                </div>
                                <p className="text-blue-900 font-bold leading-relaxed italic uppercase tracking-tight">
                                    &quot;The transition layer between the core
                                    support and comfort zones exhibited zero
                                    micro-collapsing during deep-sleep REM
                                    cycles, ensuring consistent neutrality for
                                    back-sleepers in the 70kg-95kg
                                    demographic.&quot;
                                </p>
                            </div>

                            <h3 className="text-2xl font-black uppercase italic tracking-tight text-slate-950 mb-8">
                                Detailed_Metrics
                            </h3>
                            <p className="text-slate-600 leading-relaxed mb-6">
                                Kinetic energy dispersal tests (using 15kg
                                load-drops) resulted in a dampening coefficient
                                of 0.88. This suggests that partner disturbance
                                is effectively nullified within a 12-inch radius
                                of the primary compression point.
                            </p>

                            {/* 此处可根据数据动态生成更多段落 */}
                            <div className="grid grid-cols-2 gap-8 my-12 font-mono">
                                <div className="p-6 border border-slate-100">
                                    <span className="block text-[10px] text-slate-400 mb-2 uppercase">
                                        Heat_Map_Index
                                    </span>
                                    <span className="text-xl font-black text-slate-900 tracking-tighter uppercase">
                                        Alpha_Optimal
                                    </span>
                                </div>
                                <div className="p-6 border border-slate-100">
                                    <span className="block text-[10px] text-slate-400 mb-2 uppercase">
                                        Edge_Support_Psi
                                    </span>
                                    <span className="text-xl font-black text-slate-900 tracking-tighter uppercase">
                                        4.2_Consistent
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 底部：结论导向 */}
                        <div className="mt-20 pt-10 border-t-2 border-slate-950 flex justify-between items-end">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] block mb-4">
                                    Final_Verdict
                                </span>
                                <Link
                                    href="/best-picks"
                                    className="group text-4xl font-[1000] uppercase tracking-tighter hover:text-blue-600 transition-colors"
                                >
                                    Top_Tier_Recommended{" "}
                                    <ArrowRight className="inline-block ml-2 w-8 h-8" />
                                </Link>
                            </div>
                        </div>
                    </article>
                </div>
            </div>
        </main>
    )
}

function ArrowRight(props: any) {
    return (
        <svg
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={3}
            stroke="currentColor"
            {...props}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
            />
        </svg>
    )
}
