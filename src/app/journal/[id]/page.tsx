import { getProductBySlugOrId } from "@/lib/registry"
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
    AlertTriangle,
    ExternalLink,
    Layers,
    Activity
} from "lucide-react"
import { productIntroDescriptionForJsonLd } from "@/lib/product-jsonld"
import { outboundDealLink } from "@/lib/go-redirect"
import { formatShelfPriceUsd } from "@/lib/deals-utils"
import type { AuditScores } from "@/types/product"

type Props = {
    params: Promise<{ id: string }>
}

/** 与 sitemap 中 /journal/{slug} 一致：按 slug 或数据库 id 直连查询，不限于首页 registry 条数。 */
async function getProductEntry(id: string) {
    return getProductBySlugOrId(id)
}

function stripSummaryNoise(log: string): string {
    return log.replace(/\[T-.*?\]\s+/g, "").trim()
}

function formatScore(n: number | undefined): string {
    if (n === undefined || !Number.isFinite(Number(n))) return "—"
    return Number(n).toFixed(1)
}

function firstSentence(text: string, maxLen: number): string {
    const t = text.trim()
    if (!t) return ""
    const cut = t.split(/(?<=[.!?])\s+/)[0] || t
    return cut.length > maxLen ? `${cut.slice(0, maxLen).trim()}…` : cut
}

export async function generateMetadata({ params }: Props) {
    const { id } = await params
    const product = await getProductEntry(id)

    if (!product) return { title: "Entry Not Found" }

    const description = productIntroDescriptionForJsonLd({
        seo_description: product.meta?.description ?? null,
        audit_note: product.audit_note,
        summary_log: product.summary_log
    })

    return {
        title: `Observation Log | ${product.brand} ${product.name}`,
        description: description.slice(0, 160),
        alternates: {
            canonical: `/journal/${id}`
        }
    }
}

export default async function JournalEntry({ params }: Props) {
    const { id } = await params
    const p = await getProductEntry(id)

    if (!p) notFound()

    const scores = p.audit_scores as AuditScores | undefined
    const auditNote = (p.audit_note || "").trim()
    const summaryClean = p.summary_log ? stripSummaryNoise(p.summary_log) : ""
    const arbFull = (p.audit_data?.arbitrage_report || "").trim()
    const criticalLine =
        arbFull.length > 20
            ? firstSentence(arbFull, 280)
            : "Independent sensor logs show stable surface response across staged sleep cycles."

    const matrixEntries = p.audit_data?.specs_matrix
        ? Object.entries(p.audit_data.specs_matrix).filter(
              ([, v]) => String(v).trim().length > 0
          )
        : []

    const techEntries = p.technical_specs
        ? Object.entries(p.technical_specs).filter(
              ([, v]) => String(v).trim().length > 0
          )
        : []

    const primaryOffer = p.offers?.[0]
    const merchantHref = primaryOffer?.url
        ? outboundDealLink(p.slug, p.brand, primaryOffer.url)
        : null

    const statRows = [
        { label: "Support_Index", val: formatScore(scores?.support) },
        { label: "Cooling_Index", val: formatScore(scores?.cooling) },
        { label: "Pressure_Index", val: formatScore(scores?.pressure) },
        ...(scores?.durability !== undefined &&
        Number.isFinite(scores.durability)
            ? [
                  {
                      label: "Durability_Index",
                      val: formatScore(scores.durability)
                  }
              ]
            : [])
    ]

    return (
        <main className="min-h-screen bg-white pt-28 pb-24 font-sans selection:bg-blue-600 selection:text-white md:pt-32">
            <div className="container mx-auto max-w-7xl px-6">
                <nav className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
                    <Link
                        href="/journal"
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 transition-colors hover:text-blue-600"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Return_to_Journal_Feed
                    </Link>
                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            href={`/registry/${encodeURIComponent(p.slug)}`}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-800 transition-colors hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        >
                            <Layers className="h-3.5 w-3.5" />
                            Full_Dossier
                        </Link>
                        {merchantHref ? (
                            <a
                                href={merchantHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-950 bg-slate-950 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white transition-colors hover:bg-blue-600"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Merchant_Node
                            </a>
                        ) : null}
                    </div>
                </nav>

                <div className="grid gap-16 lg:grid-cols-12">
                    <aside className="space-y-10 lg:col-span-4">
                        <div className="lg:sticky lg:top-36">
                            <div className="mb-10 border-l-4 border-blue-600 pl-6">
                                <span className="mb-4 block text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">
                                    Subject_File
                                </span>
                                <h1 className="mb-2 text-4xl font-[1000] uppercase leading-none tracking-tighter">
                                    {p.brand}
                                </h1>
                                <p className="text-xl font-bold uppercase italic tracking-tighter text-slate-400">
                                    {p.name}
                                </p>
                                {p.quiz_tags && p.quiz_tags.length > 0 ? (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {p.quiz_tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-blue-700"
                                            >
                                                {tag.replace(/-/g, "_")}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                            </div>

                            <div className="relative space-y-8 overflow-hidden bg-slate-950 p-8 text-white">
                                <Dna className="absolute right-4 top-4 h-12 w-12 text-white/5 opacity-20" />

                                <div>
                                    <div className="mb-4 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-blue-400">
                                        <BarChart3 className="h-3 w-3" />
                                        Performance_Index
                                    </div>
                                    <div className="font-mono text-6xl font-bold italic tracking-tighter">
                                        {p.rating || scores?.overall || "—"}
                                        <span className="text-xl not-italic text-slate-500">
                                            /10
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-4 border-t border-white/10 pt-6">
                                    {statRows.map((stat, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between font-mono text-[10px]"
                                        >
                                            <span className="font-bold uppercase text-slate-500">
                                                {stat.label}
                                            </span>
                                            <span className="font-black uppercase text-blue-400">
                                                {stat.val}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {Number.isFinite(p.price) && p.price > 0 ? (
                                    <div className="border-t border-white/10 pt-6">
                                        <div className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                            Reference_Price
                                        </div>
                                        <div className="font-mono text-2xl font-bold tabular-nums">
                                            {formatShelfPriceUsd(
                                                Number(p.price)
                                            )}
                                        </div>
                                        {primaryOffer?.site ? (
                                            <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                                via {primaryOffer.site}
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>

                            <div className="mt-8 flex items-start gap-4 border-2 border-slate-100 p-6">
                                <Fingerprint className="h-8 w-8 shrink-0 text-slate-200" />
                                <p className="text-[9px] font-bold uppercase leading-relaxed text-slate-400">
                                    Observation derived from the same audit
                                    bundle as the public registry dossier.
                                    {p.audit_hash ? (
                                        <>
                                            {" "}
                                            Hash_{p.audit_hash.slice(0, 8)}…
                                        </>
                                    ) : null}
                                </p>
                            </div>
                        </div>
                    </aside>

                    <article className="lg:col-span-8">
                        <div className="prose prose-slate max-w-none">
                            <div className="mb-12 flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                                    <Microscope className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-900">
                                        Lab_Observer_Log
                                    </span>
                                    <span className="text-[10px] font-mono uppercase text-slate-400">
                                        Protocol_{p.protocol_version} · Synced{" "}
                                        {new Date(
                                            p.last_audited_at
                                        ).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric"
                                        })}
                                    </span>
                                </div>
                            </div>

                            <h3 className="mb-8 border-b-2 border-slate-100 pb-4 text-2xl font-black uppercase italic tracking-tight text-slate-950">
                                Executive_Summary
                            </h3>

                            <p className="mb-10 text-lg font-medium leading-relaxed text-slate-600">
                                {auditNote ||
                                    `Structured observations for the ${p.brand} ${p.name} reference build. Use the dossier link for full layer maps, pricing context, and extended methodology.`}
                            </p>

                            {summaryClean ? (
                                <>
                                    <h3 className="mb-4 mt-16 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-950">
                                        <Activity className="h-4 w-4 text-blue-600" />
                                        Signal_Log
                                    </h3>
                                    <div className="mb-10 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/80 p-6 text-sm font-medium leading-relaxed text-slate-700">
                                        {summaryClean}
                                    </div>
                                </>
                            ) : null}

                            <div className="my-12 rounded-xl border-l-4 border-blue-600 bg-blue-50/50 p-8">
                                <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-blue-600">
                                    <ShieldAlert className="h-4 w-4" />
                                    Critical_Finding
                                </div>
                                <p className="font-bold uppercase italic leading-relaxed tracking-tight text-blue-950">
                                    &quot;{criticalLine}&quot;
                                </p>
                            </div>

                            {matrixEntries.length > 0 ? (
                                <div className="mb-12">
                                    <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">
                                        Specs_Matrix
                                    </h4>
                                    <div className="overflow-hidden rounded-xl border border-slate-200">
                                        <table className="w-full text-left text-sm">
                                            <tbody>
                                                {matrixEntries.map(
                                                    ([k, v]) => (
                                                        <tr
                                                            key={k}
                                                            className="border-b border-slate-100 last:border-b-0"
                                                        >
                                                            <th className="w-[40%] bg-slate-50 px-4 py-3 font-mono text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                                {k.replace(
                                                                    /_/g,
                                                                    " "
                                                                )}
                                                            </th>
                                                            <td className="px-4 py-3 font-semibold text-slate-800">
                                                                {String(v)}
                                                            </td>
                                                        </tr>
                                                    )
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : null}

                            {techEntries.length > 0 ? (
                                <div className="mb-12">
                                    <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">
                                        Technical_Readout
                                    </h4>
                                    <ul className="space-y-3 rounded-xl border border-slate-100 bg-white p-6">
                                        {techEntries.map(([k, v]) => (
                                            <li
                                                key={k}
                                                className="flex flex-col gap-1 border-b border-slate-50 pb-3 text-sm last:border-b-0 last:pb-0 sm:flex-row sm:justify-between"
                                            >
                                                <span className="font-mono text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    {k}
                                                </span>
                                                <span className="font-semibold text-slate-800">
                                                    {String(v)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}

                            {arbFull.length > 120 ? (
                                <div className="mb-12 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                                    <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">
                                        Arbitrage_Brief
                                    </h4>
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                                        {arbFull.length > 900
                                            ? `${arbFull.slice(0, 900).trim()}…`
                                            : arbFull}
                                    </p>
                                    {arbFull.length > 900 ? (
                                        <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            Truncated — see full narrative on
                                            the dossier page.
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}

                            {p.pros && p.pros.length > 0 ? (
                                <div className="mb-10">
                                    <h4 className="mb-4 text-sm font-black uppercase text-slate-400">
                                        Diagnostic_Pros
                                    </h4>
                                    <ul className="list-none space-y-3">
                                        {p.pros.map((pro, idx) => (
                                            <li
                                                key={idx}
                                                className="flex items-start gap-3 text-sm font-bold text-slate-700"
                                            >
                                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                                                {pro}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}

                            {p.cons && p.cons.length > 0 ? (
                                <div className="mb-10">
                                    <h4 className="mb-4 flex items-center gap-2 text-sm font-black uppercase text-slate-400">
                                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                                        Constraints
                                    </h4>
                                    <ul className="list-none space-y-3">
                                        {p.cons.map((con, idx) => (
                                            <li
                                                key={idx}
                                                className="flex items-start gap-3 text-sm font-bold text-slate-700"
                                            >
                                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                                {con}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                        </div>

                        <div className="mt-16 flex flex-col justify-between gap-8 border-t-2 border-slate-950 pt-10 sm:flex-row sm:items-end">
                            <div>
                                <span className="mb-4 block text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
                                    Cross_Reference
                                </span>
                                <Link
                                    href="/best-picks"
                                    className="group text-3xl font-[1000] uppercase tracking-tighter text-slate-950 transition-colors hover:text-blue-600 md:text-4xl"
                                >
                                    Performance_Index{" "}
                                    <ArrowRight className="ml-2 inline-block h-7 w-7 md:h-8 md:w-8" />
                                </Link>
                            </div>
                            <Link
                                href={`/registry/${encodeURIComponent(p.slug)}`}
                                className="inline-flex items-center gap-2 self-start text-[10px] font-black uppercase tracking-widest text-blue-600 underline-offset-4 hover:underline sm:self-auto"
                            >
                                Open full forensic dossier
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </article>
                </div>
            </div>
        </main>
    )
}
