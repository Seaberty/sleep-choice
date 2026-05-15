"use client"

import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    ResponsiveContainer,
    Tooltip
} from "recharts"

export type AuditRadarDatum = {
    subject: string
    A: number
    /** Short methodology blurb for tooltips (listing + corpus → LLM forensic rubric). */
    hint?: string
}

function RadarTooltip({
    active,
    payload
}: {
    active?: boolean
    payload?: { payload: AuditRadarDatum }[]
}) {
    if (!active || !payload?.length) return null
    const row = payload[0].payload
    const v = row.A
    const score =
        typeof v === "number" && Number.isFinite(v)
            ? `${v.toFixed(1)}`
            : String(v)
    const isPending =
        typeof v === "number" ? v === 0 : String(v).toUpperCase() === "PENDING"

    return (
        <div className="pointer-events-none max-w-[min(19rem,calc(100vw-2rem))] animate-in fade-in zoom-in-95 duration-200">
            <div
                className="relative overflow-hidden rounded-2xl border border-white/10 text-left"
                style={{
                    background:
                        "linear-gradient(145deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 45%, rgba(15,23,42,0.99) 100%)",
                    boxShadow:
                        "0 22px 60px -12px rgba(15,23,42,0.88), 0 0 0 1px rgba(59,130,246,0.14), inset 0 1px 0 rgba(255,255,255,0.07)"
                }}
            >
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent"
                    aria-hidden
                />
                <div className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-gradient-to-b from-sky-400 via-blue-500 to-indigo-600 opacity-90" />

                <div className="relative pl-4 pr-4 pb-4 pt-3.5 sm:pl-5 sm:pr-4 sm:pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 gap-y-1">
                        <span className="inline-flex items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.22em] text-sky-300">
                            {row.subject}
                        </span>
                        <span className="text-[8px] font-bold uppercase tracking-[0.28em] text-slate-500">
                            Forensic index
                        </span>
                    </div>

                    <div className="mt-3 flex items-baseline gap-1.5">
                        <span
                            className={`font-mono text-3xl font-black tabular-nums tracking-tight sm:text-[2rem] ${isPending ? "text-rose-400" : "text-white"}`}
                        >
                            {isPending ? "—" : score}
                        </span>
                        {!isPending ? (
                            <span className="text-sm font-bold uppercase tracking-widest text-slate-500">
                                / 10
                            </span>
                        ) : (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400/80">
                                Pending
                            </span>
                        )}
                    </div>

                    <div className="my-3 h-px w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

                    {row.hint ? (
                        <p className="text-[11px] font-medium leading-relaxed text-slate-400 [text-wrap:pretty]">
                            {row.hint}
                        </p>
                    ) : (
                        <p className="text-[11px] leading-relaxed text-slate-500 [text-wrap:pretty]">
                            Forensic 0–10 estimate from captured listing text and
                            social corpus snippets; not independent lab testing.
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function AuditRadarChart({ data }: { data: AuditRadarDatum[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                <PolarGrid stroke="#334155" strokeDasharray="3 3" />
                <PolarAngleAxis
                    dataKey="subject"
                    tick={{
                        fill: "#94a3b8",
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: "0.1em"
                    }}
                />
                <Tooltip
                    cursor={{
                        stroke: "rgba(56, 189, 248, 0.45)",
                        strokeWidth: 1,
                        strokeDasharray: "5 5"
                    }}
                    wrapperStyle={{ outline: "none", zIndex: 60 }}
                    content={<RadarTooltip />}
                />
                <Radar
                    name="Forensic score"
                    dataKey="A"
                    stroke="#60a5fa"
                    strokeWidth={3}
                    fill="#3b82f6"
                    fillOpacity={0.2}
                />
            </RadarChart>
        </ResponsiveContainer>
    )
}
