"use client"

import Link from "next/link"
import { Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
    email: string
    onEmailChange: (value: string) => void
    status: "idle" | "saving" | "success" | "error"
    disabled?: boolean
}

export function QuizEmailCapture({
    email,
    onEmailChange,
    status,
    disabled
}: Props) {
    return (
        <section
            className="mt-10 border-2 border-slate-950 bg-slate-50/80 p-5 sm:p-6"
            aria-labelledby="quiz-email-capture-heading"
        >
            <div className="flex items-start gap-3 mb-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-blue-600 text-white">
                    <Mail className="h-4 w-4" aria-hidden />
                </span>
                <div>
                    <h3
                        id="quiz-email-capture-heading"
                        className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-950"
                    >
                        Archive_Your_Match_Vector
                    </h3>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-tight text-slate-500">
                        Optional — email your top picks & deal alerts (no spam
                        cluster).
                    </p>
                </div>
            </div>

            <label className="block">
                <span className="sr-only">Email</span>
                <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => onEmailChange(e.target.value)}
                    disabled={disabled || status === "saving"}
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={cn(
                        "w-full border-2 border-slate-900 bg-white px-4 py-3.5 font-mono text-sm text-slate-950 outline-none placeholder:text-slate-400",
                        "focus:border-blue-600 focus:ring-4 focus:ring-blue-600/15",
                        disabled && "opacity-60"
                    )}
                />
            </label>

            <p className="mt-3 text-[9px] font-bold uppercase tracking-tight text-slate-400 leading-relaxed">
                By continuing you agree to our{" "}
                <Link
                    href="/privacy"
                    className="text-blue-600 underline-offset-2 hover:underline"
                >
                    Privacy Protocol
                </Link>
                . Unsubscribe anytime.
            </p>

            {status === "success" ? (
                <p className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Identifier logged — generating report
                </p>
            ) : null}
            {status === "error" ? (
                <p className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-600">
                    <AlertCircle className="h-4 w-4" aria-hidden />
                    Save failed — you can still view results
                </p>
            ) : null}
            {status === "saving" ? (
                <p className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Syncing lead node…
                </p>
            ) : null}
        </section>
    )
}
