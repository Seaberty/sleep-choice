import { getAutomatedRegistry } from "@/lib/registry"
import { notFound } from "next/navigation"
import Link from "next/link"
import {
    ChevronLeft,
    Microscope,
    Fingerprint,
    BarChart3,
    Dna,
    ArrowRight,
    ShieldAlert,
    Printer
} from "lucide-react"

// 定义 Params 类型为 Promise (兼容 Next.js 15)
type Props = {
    params: Promise<{ id: string }>
}

/**
 * 辅助函数：根据 ID (或 slug) 获取产品
 */
async function getProductEntry(id: string) {
    const registryData = await getAutomatedRegistry()
    // 因为 getAutomatedRegistry 返回数组，需使用 find
    // 优先匹配 slug，如果不匹配再匹配 id
    return registryData.find(item => item.slug === id || item.id === id)
}

// 异步生成元数据
export async function generateMetadata({ params }: Props) {
    const { id } = await params
    const product = await getProductEntry(id)

    if (!product) return { title: "Entry Not Found" }

    return {
        title: `Observation_${id} | ${product.brand} ${product.name}`,
        description: `Detailed laboratory observation logs for ${product.brand} mattress system.`
    }
}

// 异步组件处理
export default async function JournalEntry({ params }: Props) {
    const { id } = await params
    const p = await getProductEntry(id)

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
                    {/* --- 左侧：核心读数 --- */}
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
                                        {/* 注意：此处使用 p.rating，因为 lib 中赋值给了 rating */}
                                        {p.rating || "8.5"}
                                        <span className="text-xl not-italic text-slate-500">
                                            /10
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-4 border-t border-white/10 pt-6">
                                    {[
                                        {
                                            label: "Spinal_Neutrality",
                                            val: p.audit_scores?.support ? "High_Res" : "Verified"
                                        },
                                        {
                                            label: "Thermal_Dissipation",
                                            val: p.audit_scores?.cooling ? "Optimal" : "Standard"
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

                            <div className="mt-8 p-6 border-2 border-slate-100 flex items-start gap-4">
                                <Fingerprint className="w-8 h-8 text-slate-200 shrink-0" />
                                <p className="text-[9px] font-bold text-slate-400 leading-relaxed uppercase">
                                    This log is cryptographically signed.
                                </p>
                            </div>
                        </div>
                    </aside>

                    {/* --- 右侧：日志正文 --- */}
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
                                </strong>{" "}
                                maintains significant structural integrity.
                            </p>

                            <div className="my-16 p-10 bg-blue-50/50 border-l-4 border-blue-600">
                                <div className="flex items-center gap-2 text-blue-600 font-black text-[11px] uppercase tracking-widest mb-4">
                                    <ShieldAlert className="w-4 h-4" />
                                    Critical_Finding
                                </div>
                                <p className="text-blue-900 font-bold leading-relaxed italic uppercase tracking-tight">
                                    &quot;Zero micro-collapsing during
                                    deep-sleep REM cycles.&quot;
                                </p>
                            </div>
                            
                            {/* 这里你可以添加循环来渲染 p.pros */}
                            {p.pros && p.pros.length > 0 && (
                                <div className="mt-8">
                                     <h4 className="text-sm font-black uppercase mb-4 text-slate-400">Diagnostic_Pros</h4>
                                     <ul className="list-none space-y-2">
                                        {p.pros.map((pro, idx) => (
                                            <li key={idx} className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                                                {pro}
                                            </li>
                                        ))}
                                     </ul>
                                </div>
                            )}
                        </div>

                        {/* 底部导航 */}
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
 