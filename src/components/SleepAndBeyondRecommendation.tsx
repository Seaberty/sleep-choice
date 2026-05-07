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
            <div className="border-2 border-blue-600 bg-gradient-to-br from-blue-50 to-white p-8 shadow-lg">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Badge className="w-5 h-5 text-blue-600" />
                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em]">
                                VERIFIED_GATEWAY
                            </span>
                        </div>
                        <h3 className="text-2xl md:text-3xl font-[1000] uppercase italic tracking-tighter text-slate-950">
                            Sleep & Beyond <br />
                            <span className="text-blue-600 not-italic">
                                {recommendation.model}
                            </span>
                        </h3>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                            MATCH_SCORE
                        </div>
                        <div className="text-4xl font-mono font-bold text-blue-600 italic">
                            {recommendation.matchScore}%
                        </div>
                    </div>
                </div>

                {/* Characteristics */}
                <div className="grid grid-cols-2 gap-4 mb-6 py-4 border-y border-slate-200">
                    <div className="flex items-center gap-3">
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
                    <div className="flex items-center gap-3">
                        <Thermometer className="w-5 h-5 text-orange-600" />
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
                <div className="flex items-center gap-3">
                    <a
                        href={productGoLink(recommendation.slug)}
                        target="_blank"
                        rel="nofollow noopener"
                        className="flex-1"
                    >
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 font-black uppercase tracking-[0.1em] text-[10px] transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            VIEW_DETAILS
                            <ArrowRight className="w-4 h-4" />
                        </motion.button>
                    </a>
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="px-4 py-4 border-2 border-slate-300 hover:border-slate-400 text-slate-600 font-bold uppercase text-[10px] tracking-[0.1em] transition-all"
                        >
                            DISMISS
                        </button>
                    )}
                </div>

                {/* Verification Badge */}
                <div className="mt-6 pt-4 border-t border-slate-200">
                    <div className="text-[8px] font-mono text-slate-400 uppercase tracking-widest italic">
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
