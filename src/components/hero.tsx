"use client"
import { motion } from "framer-motion"
import Link from "next/link"
import { RegistryDetailLink } from "@/components/registry-detail-link"
import Image from "next/image"
import { ChevronRight, Microscope, ShieldCheck } from "lucide-react"

export function Hero() {
    // 更新为 Saatva Classic 的 Slug
    const featuredProductSlug = "saatva-hd"

    return (
        <section className="bg-slate-50 py-16 sm:py-20 text-center lg:text-left lg:py-32 overflow-hidden">
            <div className="container mx-auto grid lg:grid-cols-2 gap-10 lg:gap-12 items-center px-4 sm:px-6">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* 顶部标签 */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 border border-blue-200 mb-6">
                        <Microscope className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
                            Review_Aggregate_Audit_Index
                        </span>
                    </div>

                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-7xl mb-6 leading-[1.1]">
                        Find Your{" "}
                        <span className="text-blue-600">Perfect Night.</span>
                    </h1>
                    <p className="text-base text-slate-600 sm:text-xl mb-8 leading-relaxed max-w-xl">
                        Forensic intelligence built from owner reviews, retailer
                        specs, and channel narratives—aggregated and scored by AI.
                        We stress-test the evidence trail, not mattresses on our
                        bench.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                        <Link href="/quiz">
                            <button className="w-full sm:w-auto bg-blue-600 text-white px-8 py-4 rounded-full font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group">
                                Start Sleep Quiz
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </Link>

                        <Link href="/registry#registry-search">
                            <button className="w-full sm:w-auto bg-white border border-slate-200 px-8 py-4 rounded-full font-bold hover:bg-slate-50 transition-all text-slate-700">
                                Browse All Audits
                            </button>
                        </Link>
                    </div>
                </motion.div>

                {/* --- 右侧：Saatva Classic 视觉分析 --- */}
                <motion.div
                    className="hidden lg:block relative group"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <div className="absolute -inset-4 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-50" />

                    <RegistryDetailLink
                        href={`/registry/${featuredProductSlug}`}
                        className="block relative h-[520px] w-full bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl transition-all hover:shadow-blue-500/10 hover:border-blue-200"
                    >
                        {/* 扫描线动画 */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/40 shadow-[0_0_20px_rgba(37,99,235,0.8)] animate-scan z-20 pointer-events-none" />

                        {/* Saatva Classic 解构图 */}
                        <div className="relative w-full h-full p-6 flex items-center justify-center">
                            <Image
                                src="https://saatva.imgix.net/products/saatva-hd/room-angle/saatva-hd-room-angle-16-9.jpg?w=1200&fit=crop&auto=format"
                                alt="Saatva Classic Construction Deconstruction"
                                fill // 填充父容器
                                sizes="(max-width: 768px) 100vw, 80vw" // 优化加载尺寸
                                priority // 因为是 Hero 区域图片，建议加上 priority 提升 LCP 加载速度
                                className="object-contain p-6 transition-transform duration-1000 ease-in-out group-hover:scale-110"
                            />

                            {/* 工业感坐标点装饰 - 保持不变 */}
                            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-600 rounded-full animate-ping opacity-75" />
                            <div className="absolute bottom-1/3 right-1/4 w-2 h-2 bg-blue-600 rounded-full animate-ping opacity-75 [animation-delay:1s]" />
                        </div>
                        

                        {/* 浮动审计标签 */}
                        <div className="absolute bottom-8 right-8 bg-slate-900 text-white p-5 rounded-2xl shadow-2xl flex items-center gap-4 transform transition-transform group-hover:-translate-y-2 group-hover:bg-slate-800">
                            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shrink-0 shadow-inner">
                                <ShieldCheck className="w-7 h-7" />
                            </div>
                            <div>
                                <div className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-0.5">
                                    Final_Score
                                </div>
                                <div className="text-2xl font-black italic tracking-tight">
                                    9.2 / 10
                                </div>
                            </div>
                        </div>

                        {/* 悬停时的“查看详情”提示 */}
                        <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/[0.03] transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 bg-white border-2 border-slate-900 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest text-slate-900 shadow-xl">
                                Execute_Full_Dossier
                            </div>
                        </div>
                    </RegistryDetailLink>
                </motion.div>
            </div>

            <style jsx>{`
                @keyframes scan {
                    0% {
                        top: 0%;
                    }
                    100% {
                        top: 100%;
                    }
                }
                .animate-scan {
                    animation: scan 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }
            `}</style>
        </section>
    )
}
