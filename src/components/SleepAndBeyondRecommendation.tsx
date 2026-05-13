"use client"

/**
 * Sleep & Beyond Recommendation Card Component
 * 在 Quiz 完成后或用户离开非批准品牌时显示
 */

import React from "react"
import Link from "next/link"
import { productGoLink } from "@/lib/go-redirect"
import { motion } from "framer-motion"
import { ArrowRight, Badge, Leaf, Thermometer } from "lucide-react"

interface SleepAndBeyondRecommendationProps {
    recommendation: {
        model: string
        slug: string
        matchScore: number
        reasoningSummary: string
    }
    onDismiss?: () => void
}

export default function SleepAndBeyondRecommendation({
    recommendation,
    onDismiss
}: SleepAndBeyondRecommendationProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden"
        >
            <div className="border-2 border-blue-600 bg-gradient-to-br from-blue-50 to-white p-5 shadow-lg sm:p-8">
                {/* Header */}
                <div className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge className="w-5 h-5 text-blue-600" />
                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em]">
                                VERIFIED_GATEWAY
                            </span>
                        </div>
                        <h3 className="text-xl font-[1000] uppercase italic tracking-tighter text-slate-950 sm:text-2xl md:text-3xl">
                            Sleep & Beyond <br />
                            <span className="text-blue-600 not-italic break-words">
                                {recommendation.model}
                            </span>
                        </h3>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                            MATCH_SCORE
                        </div>
                        <div className="text-3xl font-mono font-bold italic text-blue-600 sm:text-4xl">
                            {recommendation.matchScore}%
                        </div>
                    </div>
                </div>

                {/* Characteristics */}
                <div className="mb-6 grid grid-cols-1 gap-4 border-y border-slate-200 py-4 sm:grid-cols-2">
                    <div className="flex min-w-0 items-start gap-3">
                        <Leaf className="w-5 h-5 text-emerald-600" />
                        <div className="text-[10px] uppercase font-bold text-slate-600 tracking-tight">
                            <span className="block font-black">
                                ORGANIC INTEGRITY
                            </span>
                            <span className="text-slate-400">
                                100% Natural Latex
                            </span>
                        </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3">
                        <Thermometer className="w-5 h-5 shrink-0 text-orange-600" />
                        <div className="text-[10px] uppercase font-bold text-slate-600 tracking-tight">
                            <span className="block font-black">
                                THERMOREGULATION
                            </span>
                            <span className="text-slate-400">
                                ±1.2°C Variance
                            </span>
                        </div>
                    </div>
                </div>

                {/* Reasoning */}
                <div className="mb-6">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                        AUDIT_REASONING
                    </div>
                    <p className="text-[11px] font-medium text-slate-700 leading-relaxed italic">
                        {recommendation.reasoningSummary}
                    </p>
                </div>

                {/* Call to Action */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <a
                        href={productGoLink(recommendation.slug)}
                        target="_blank"
                        rel="nofollow noopener"
                        className="min-w-0 flex-1"
                    >
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="flex w-full items-center justify-center gap-2 bg-blue-600 px-4 py-3.5 text-[10px] font-black uppercase tracking-[0.1em] text-white transition-all duration-200 hover:bg-blue-700 sm:px-6 sm:py-4"
                        >
                            VIEW_DETAILS
                            <ArrowRight className="h-4 w-4 shrink-0" />
                        </motion.button>
                    </a>
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="shrink-0 border-2 border-slate-300 px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600 transition-all hover:border-slate-400 sm:py-4"
                        >
                            DISMISS
                        </button>
                    )}
                </div>

                {/* Verification Badge */}
                <div className="mt-6 pt-4 border-t border-slate-200">
                    <div className="break-words text-[8px] font-mono italic uppercase tracking-widest text-slate-400">
                        [Forensic_Analysis_Complete] [Status: Verified_Gateway]
                        [CJ_Affiliate_Active]
                    </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
                    <Leaf className="w-32 h-32 text-blue-600" />
                </div>
            </div>
        </motion.div>
    )
}
