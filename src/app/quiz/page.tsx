"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import {
    ArrowRight,
    ArrowLeft,
    ShieldCheck,
    Cpu,
    Terminal,
    Fingerprint,
    Database,
    Activity,
    Loader2,
    Lock,
    Binary
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { APP_PROTOCOL } from "@/lib/constants"

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
            setTimeout(() => setCurrentStep(currentStep + 1), 300)
        }
    }

    const startAnalysis = () => {
        setIsAnalyzing(true)
        // 模拟精密计算耗时
        setTimeout(() => {
            window.location.href = `/best-picks?quiz=true&answers=${encodeURIComponent(JSON.stringify(answers))}`
        }, 2800)
    }

    const isComplete = Object.keys(answers).length === questions.length

    return (
        <main className="relative min-h-screen bg-white pt-[120px] pb-24 overflow-hidden font-sans text-slate-900">
            {/* 1. 背景工业网格与动态扫描线 */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage:
                            "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
                        backgroundSize: "40px 40px"
                    }}
                />
                <motion.div
                    animate={{ y: ["0%", "100%", "0%"] }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                    className="absolute top-0 left-0 w-full h-[1px] bg-blue-600/10 z-10"
                />
            </div>

            <div className="container mx-auto px-6 relative z-10 max-w-7xl">
                {isAnalyzing ? (
                    /* --- 2. 分析加载状态：极具视觉冲击力的审计中动画 --- */
                    <div className="max-w-xl mx-auto py-20 text-center space-y-12">
                        <div className="relative inline-block">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{
                                    duration: 4,
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                                className="w-32 h-32 border-t-2 border-b-2 border-blue-600 rounded-full"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Cpu className="w-10 h-10 text-blue-600 animate-pulse" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-3xl font-[1000] uppercase italic tracking-tighter">
                                Analyzing_Dossier
                            </h2>
                            <div className="font-mono text-[10px] text-slate-400 space-y-1 uppercase tracking-widest">
                                <p className="animate-pulse">
                                    {"//"} Accessing Material Registry...
                                </p>
                                <p className="delay-75 animate-pulse">
                                    {"//"} Cross-referencing Biometric Nodes...
                                </p>
                                <p className="delay-150 animate-pulse">
                                    {"//"} Simulating Structural Integrity...
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* --- 3. Header Unit --- */}
                        <header className="max-w-4xl mx-auto mb-16 border-l-4 border-blue-600 pl-8">
                            <div className="flex items-center gap-3 text-blue-600 font-black text-[9px] uppercase tracking-[0.4em] mb-4">
                                <Activity className="w-4 h-4" />
                                {`MATCH_ENGINE_${APP_PROTOCOL} // ACTIVE_SESSION`}
                            </div>
                            <h1 className="text-5xl md:text-8xl font-[1000] tracking-tighter uppercase leading-[0.8] mb-6 italic">
                                System <br />
                                <span className="text-blue-600 not-italic">
                                    Calibration
                                </span>
                            </h1>
                            <div className="flex items-center gap-4 py-3 border-y border-slate-100">
                                <Fingerprint className="w-4 h-4 text-slate-400" />
                                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                                    Secure_Session_ID:{" "}
                                    {Math.random()
                                        .toString(16)
                                        .substring(2, 10)
                                        .toUpperCase()}
                                </p>
                            </div>
                        </header>

                        {/* --- 4. Progress Tracking --- */}
                        <div className="max-w-xl mx-auto mb-20">
                            <div className="flex justify-between items-end mb-4">
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        Node_Index
                                    </span>
                                    <div className="text-2xl font-mono font-bold">
                                        0{currentStep + 1} / 0{questions.length}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        Completion
                                    </span>
                                    <div className="text-2xl font-mono font-bold text-blue-600">
                                        {Math.round(
                                            ((currentStep + 1) /
                                                questions.length) *
                                                100
                                        )}
                                        %
                                    </div>
                                </div>
                            </div>
                            <div className="h-1.5 bg-slate-100 relative overflow-hidden">
                                <motion.div
                                    className="absolute inset-y-0 left-0 bg-blue-600"
                                    initial={{ width: 0 }}
                                    animate={{
                                        width: `${((currentStep + 1) / questions.length) * 100}%`
                                    }}
                                />
                            </div>
                        </div>

                        {/* --- 5. Question Node --- */}
                        <div className="max-w-xl mx-auto min-h-[500px]">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentStep}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="space-y-10"
                                >
                                    <div className="flex items-start gap-4">
                                        <Terminal className="w-6 h-6 text-blue-600 shrink-0 mt-1" />
                                        <h2 className="text-2xl md:text-3xl font-[1000] uppercase tracking-tighter leading-none italic">
                                            {questions[currentStep].question}
                                        </h2>
                                    </div>

                                    <div className="grid gap-4">
                                        {questions[currentStep].options.map(
                                            (option) => {
                                                const isSelected =
                                                    answers[
                                                        questions[currentStep]
                                                            .id
                                                    ] === option.value
                                                return (
                                                    <button
                                                        key={option.value}
                                                        onClick={() =>
                                                            handleAnswer(
                                                                questions[
                                                                    currentStep
                                                                ].id,
                                                                option.value
                                                            )
                                                        }
                                                        className={cn(
                                                            "group relative p-6 border-2 transition-all text-left overflow-hidden",
                                                            isSelected
                                                                ? "border-blue-600 bg-blue-50/30"
                                                                : "border-slate-100 bg-white hover:border-slate-900 shadow-sm"
                                                        )}
                                                    >
                                                        <div className="relative z-10 flex justify-between items-center">
                                                            <div className="space-y-1">
                                                                <div className="text-[8px] font-black text-blue-600 tracking-[0.2em] uppercase opacity-60">
                                                                    Parameter_Value
                                                                </div>
                                                                <h3 className="text-xl font-black text-slate-950 uppercase italic leading-none">
                                                                    {
                                                                        option.label
                                                                    }
                                                                </h3>
                                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight pt-1">
                                                                    {
                                                                        option.desc
                                                                    }
                                                                </p>
                                                            </div>
                                                            <div
                                                                className={cn(
                                                                    "w-6 h-6 border-2 flex items-center justify-center transition-all",
                                                                    isSelected
                                                                        ? "border-blue-600 bg-blue-600 scale-110"
                                                                        : "border-slate-200 group-hover:border-slate-400"
                                                                )}
                                                            >
                                                                {isSelected && (
                                                                    <div className="w-2 h-2 bg-white rotate-45" />
                                                                )}
                                                            </div>
                                                        </div>
                                                        {/* 悬停时的底层装饰 */}
                                                        <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                                            <Binary className="w-16 h-16 -mb-4 -mr-4" />
                                                        </div>
                                                    </button>
                                                )
                                            }
                                        )}
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            {/* --- 6. Navigation Node --- */}
                            <div className="flex items-center justify-between mt-16 pt-10 border-t-2 border-slate-950">
                                <button
                                    onClick={() =>
                                        currentStep > 0 &&
                                        setCurrentStep(currentStep - 1)
                                    }
                                    disabled={currentStep === 0}
                                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-950 disabled:opacity-0 transition-all"
                                >
                                    <ArrowLeft className="w-4 h-4" />[ Step_Back
                                    ]
                                </button>

                                {isComplete ? (
                                    <button
                                        onClick={startAnalysis}
                                        className="flex items-center gap-4 bg-blue-600 text-white px-10 py-5 font-[1000] uppercase tracking-[0.2em] text-xs hover:bg-slate-950 transition-all shadow-[8px_8px_0px_0px_rgba(30,58,138,0.2)] active:translate-x-1 active:translate-y-1 active:shadow-none"
                                    >
                                        <Database className="w-4 h-4" />
                                        Generate_Audit_Report
                                    </button>
                                ) : (
                                    <div className="text-[9px] font-mono font-bold text-slate-300 uppercase tracking-widest">
                                        Waiting_For_Inputs...
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* --- 7. Security Protocol Footer --- */}
                        <footer className="max-w-xl mx-auto mt-32">
                            <div className="p-8 bg-slate-950 text-white relative overflow-hidden group">
                                <div className="relative z-10 flex items-start gap-5">
                                    <div className="p-2 bg-blue-600 rounded-none">
                                        <Lock className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <span className="block text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">
                                            End-to-End_Encryption_Active
                                        </span>
                                        <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-tight">
                                            User biometric hashing enabled.
                                            Result vectors are ephemeral and
                                            will be purged upon session
                                            termination. Compliant with
                                            SleepChoice Privacy Protocol 7.1.
                                        </p>
                                    </div>
                                </div>
                                <ShieldCheck className="absolute -right-6 -bottom-6 w-24 h-24 text-white/5 group-hover:text-blue-600/10 transition-colors" />
                            </div>
                        </footer>
                    </>
                )}
            </div>
        </main>
    )
}
