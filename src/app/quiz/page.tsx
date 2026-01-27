"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import {
    Sparkles,
    ArrowRight,
    CheckCircle2,
    Zap,
    ArrowLeft,
    ShieldCheck,
    Cpu,
    Terminal,
    Fingerprint,
    Database,
    Activity
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

export default function QuizPage() {
    const [currentStep, setCurrentStep] = useState(0)
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [isAnalyzing, setIsAnalyzing] = useState(false)

    const questions = [
        {
            id: "sleep_position",
            question: "EXEC: SLEEP_AXIS_DETERMINATION",
            options: [
                {
                    value: "back",
                    label: "Dorsal (Back)",
                    desc: "Neutral spinal alignment priority"
                },
                {
                    value: "side",
                    label: "Lateral (Side)",
                    desc: "Requires zoned pressure relief"
                },
                {
                    value: "stomach",
                    label: "Prone (Stomach)",
                    desc: "High-density core required"
                },
                {
                    value: "combination",
                    label: "Variable",
                    desc: "Dynamic motion response needed"
                }
            ]
        },
        {
            id: "firmness",
            question: "SET: SURFACE_TENSION_INDEX",
            options: [
                {
                    value: "soft",
                    label: "Low Tension (3-4)",
                    desc: "Maximum contouring wrap"
                },
                {
                    value: "medium",
                    label: "Balanced (5-6)",
                    desc: "Universal support ratio"
                },
                {
                    value: "firm",
                    label: "High Tension (7-8)",
                    desc: "Reinforced surface integrity"
                },
                {
                    value: "unsure",
                    label: "Auto-Detect",
                    desc: "Allow system recommendation"
                }
            ]
        },
        {
            id: "body_type",
            question: "INPUT: MASS_LOAD_SPECIFICATION",
            options: [
                {
                    value: "light",
                    label: "Category A (< 130 lbs)",
                    desc: "Reduced compression force"
                },
                {
                    value: "average",
                    label: "Category B (130-230 lbs)",
                    desc: "Standard calibration"
                },
                {
                    value: "heavy",
                    label: "Category C (> 230 lbs)",
                    desc: "Enhanced structural durability"
                }
            ]
        },
        {
            id: "sleep_issues",
            question: "SCAN: BIO_FEEDBACK_CONSTRAINTS",
            options: [
                {
                    value: "back_pain",
                    label: "Lumbar Stress",
                    desc: "Targeted spinal support"
                },
                {
                    value: "hot",
                    label: "Thermal Retention",
                    desc: "Phase change cooling active"
                },
                {
                    value: "partner",
                    label: "Motion Transfer",
                    desc: "Independently pocketed isolation"
                },
                {
                    value: "none",
                    label: "Nominal",
                    desc: "Standard performance metrics"
                }
            ]
        }
    ]

    const handleAnswer = (questionId: string, value: string) => {
        setAnswers({ ...answers, [questionId]: value })
        if (currentStep < questions.length - 1) {
            setTimeout(() => setCurrentStep(currentStep + 1), 400)
        }
    }

    const isComplete = Object.keys(answers).length === questions.length

    return (
        <main className="relative min-h-screen bg-white pt-[120px] pb-24 overflow-hidden">
            {/* Background Intel Grid */}
            <div
                className="fixed inset-0 pointer-events-none opacity-[0.03]"
                style={{
                    backgroundImage:
                        "radial-gradient(#000 1px, transparent 1px)",
                    backgroundSize: "32px 32px"
                }}
            />

            <div className="container mx-auto px-6 relative z-10">
                {/* Header Unit */}
                <header className="max-w-2xl mx-auto mb-16">
                    <div className="flex items-center gap-3 text-blue-600 font-black text-[9px] uppercase tracking-[0.3em] mb-4">
                        <Cpu className="w-3.5 h-3.5" />
                        Match_Engine_v4.1.0
                    </div>
                    <h1 className="text-5xl md:text-7xl font-[1000] tracking-tighter uppercase leading-[0.85] mb-6">
                        System <br />
                        <span className="text-blue-600">Calibration</span>
                    </h1>
                    <div className="flex items-center gap-4 py-2 border-y border-slate-100">
                        <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
                        <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                            Status: Processing Biometric Inputs
                        </p>
                    </div>
                </header>

                {/* Progress Node */}
                <div className="max-w-xl mx-auto mb-16">
                    <div className="flex justify-between items-end mb-3">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Current_Step
                            </span>
                            <span className="text-xl font-mono font-bold">
                                0{currentStep + 1}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Progress
                            </span>
                            <span className="block text-xl font-mono font-bold">
                                {Math.round(
                                    ((currentStep + 1) / questions.length) * 100
                                )}
                                %
                            </span>
                        </div>
                    </div>
                    <div className="h-1 bg-slate-100 relative overflow-hidden">
                        <motion.div
                            className="absolute inset-y-0 left-0 bg-blue-600"
                            initial={{ width: 0 }}
                            animate={{
                                width: `${
                                    ((currentStep + 1) / questions.length) * 100
                                }%`
                            }}
                        />
                    </div>
                </div>

                {/* Engine Interface */}
                <div className="max-w-xl mx-auto min-h-[450px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-8"
                        >
                            <div className="flex items-center gap-3">
                                <Terminal className="w-5 h-5 text-blue-600" />
                                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">
                                    {questions[currentStep].question}
                                </h2>
                            </div>

                            <div className="grid gap-3">
                                {questions[currentStep].options.map(
                                    (option) => {
                                        const isSelected =
                                            answers[
                                                questions[currentStep].id
                                            ] === option.value
                                        return (
                                            <button
                                                key={option.value}
                                                onClick={() =>
                                                    handleAnswer(
                                                        questions[currentStep]
                                                            .id,
                                                        option.value
                                                    )
                                                }
                                                className={cn(
                                                    "group relative p-5 border transition-all text-left overflow-hidden",
                                                    isSelected
                                                        ? "border-blue-600 bg-blue-50/50"
                                                        : "border-slate-200 bg-white hover:border-slate-400"
                                                )}
                                            >
                                                {isSelected && (
                                                    <motion.div
                                                        layoutId="active-bg"
                                                        className="absolute inset-0 bg-blue-600/5 pointer-events-none"
                                                    />
                                                )}
                                                <div className="relative z-10 flex justify-between items-center">
                                                    <div>
                                                        <div className="text-[10px] font-black text-blue-600 mb-1 tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                                                            Select_Option
                                                        </div>
                                                        <h3 className="text-lg font-black text-slate-900 uppercase leading-none mb-2">
                                                            {option.label}
                                                        </h3>
                                                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tight">
                                                            {option.desc}
                                                        </p>
                                                    </div>
                                                    <div
                                                        className={cn(
                                                            "w-4 h-4 border-2 flex items-center justify-center transition-all",
                                                            isSelected
                                                                ? "border-blue-600 bg-blue-600"
                                                                : "border-slate-200"
                                                        )}
                                                    >
                                                        {isSelected && (
                                                            <div className="w-1.5 h-1.5 bg-white" />
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    }
                                )}
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation Node */}
                    <div className="flex items-center justify-between mt-12 pt-8 border-t border-slate-100">
                        <button
                            onClick={() =>
                                currentStep > 0 &&
                                setCurrentStep(currentStep - 1)
                            }
                            disabled={currentStep === 0}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 disabled:opacity-0 transition-all"
                        >
                            <ArrowLeft className="w-3 h-3" />
                            Prev_Step
                        </button>

                        {isComplete && (
                            <Link
                                href={`/best-picks?quiz=true&answers=${encodeURIComponent(
                                    JSON.stringify(answers)
                                )}`}
                                className="flex items-center gap-3 bg-slate-950 text-white px-8 py-4 font-black uppercase tracking-[0.2em] text-[10px] hover:bg-blue-600 transition-all shadow-xl shadow-blue-950/20 active:scale-95"
                            >
                                <Database className="w-3.5 h-3.5" />
                                Generate_Report
                            </Link>
                        )}
                    </div>
                </div>

                {/* Secure Protocol Footer */}
                <footer className="max-w-xl mx-auto mt-24">
                    <div className="p-6 bg-slate-50 border border-slate-100 flex items-start gap-4">
                        <ShieldCheck className="w-5 h-5 text-emerald-500 mt-0.5" />
                        <div className="space-y-1">
                            <span className="block text-[9px] font-black text-slate-900 uppercase tracking-widest">
                                Security_Protocol_Active
                            </span>
                            <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase">
                                Biometric data processed locally. Zero-retention
                                policy enforced. SHA-256 encrypted handshake for
                                result delivery.
                            </p>
                        </div>
                    </div>
                </footer>
            </div>
        </main>
    )
}
