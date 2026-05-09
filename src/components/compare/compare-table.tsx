"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, X } from "lucide-react"
import type { AuditScores, ProductData } from "@/types/product"
import { outboundDealLink } from "@/lib/go-redirect"
import { formatShelfPriceUsd } from "@/lib/deals-utils"
import { withImageCacheBust } from "@/lib/utils"
import {
    compareHref,
    getCompareSlugs,
    removeCompareSlug
} from "@/components/compare/compare-storage"

function fmtScore(n: number | undefined): string {
    if (n == null || !Number.isFinite(Number(n))) return "—"
    const v = Number(n)
    if (v === 0) return "—"
    return v.toFixed(1)
}

function resolveDealHref(p: ProductData): string {
    const primary =
        p.offers?.find((o) => o.primary) || p.offers?.find((o) => o.url) ||
        p.offers?.[0]
    const raw = (primary?.url || "").trim()
    const out = outboundDealLink(p.slug, p.brand, raw)
    if (out && out.length > 0) return out
    return `/registry/${p.slug}`
}

const SCORE_ROWS: { label: string; key: keyof AuditScores }[] = [
    { label: "Overall", key: "overall" },
    { label: "Support", key: "support" },
    { label: "Cooling", key: "cooling" },
    { label: "Pressure relief", key: "pressure" },
    { label: "Durability", key: "durability" }
]

export function CompareTable({ products }: { products: ProductData[] }) {
    const router = useRouter()

    const remove = (slug: string) => {
        removeCompareSlug(slug)
        const rest = getCompareSlugs()
        if (rest.length === 0) {
            router.push("/registry")
            return
        }
        router.push(compareHref(rest))
        router.refresh()
    }

    const specKeys = [
        ...new Set(
            products.flatMap((p) => Object.keys(p.technical_specs || {}))
        )
    ].sort()

    return (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] border-collapse text-left font-mono text-[11px]">
                <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="sticky left-0 z-10 min-w-[140px] bg-slate-50 px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Metric
                        </th>
                        {products.map((p) => (
                            <th
                                key={p.slug}
                                className="relative min-w-[180px] px-4 py-4 align-top"
                            >
                                <button
                                    type="button"
                                    onClick={() => remove(p.slug)}
                                    className="absolute right-2 top-2 rounded-lg border border-slate-200 p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                    title="Remove from compare"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                                <div className="pr-8 space-y-3">
                                    <div className="relative mx-auto h-24 w-full max-w-[140px] overflow-hidden rounded-xl bg-slate-100">
                                        {p.image_url &&
                                        !p.image_url.includes(
                                            "placeholder"
                                        ) ? (
                                            <Image
                                                src={withImageCacheBust(
                                                    p.image_url,
                                                    p.last_audited_at
                                                )}
                                                alt={p.model}
                                                fill
                                                className="object-contain p-2"
                                                sizes="140px"
                                            />
                                        ) : (
                                            <div className="flex h-full items-center justify-center text-[9px] text-slate-400">
                                                No image
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-blue-600">
                                            {p.brand}
                                        </div>
                                        <Link
                                            href={`/registry/${p.slug}`}
                                            className="mt-1 block text-sm font-black uppercase italic leading-tight text-slate-950 hover:text-blue-600"
                                        >
                                            {p.name || p.model}
                                        </Link>
                                    </div>
                                    <Link
                                        href={`/registry/${p.slug}`}
                                        className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:underline"
                                    >
                                            Full audit
                                        <ExternalLink className="h-3 w-3" />
                                    </Link>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {SCORE_ROWS.map((row) => (
                        <tr
                            key={row.key}
                            className="border-b border-slate-100 hover:bg-slate-50/80"
                        >
                            <td className="sticky left-0 z-10 bg-white px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                {row.label}
                            </td>
                            {products.map((p) => (
                                <td
                                    key={`${p.slug}-${row.key}`}
                                    className="px-4 py-3 text-base font-black italic text-slate-950"
                                >
                                    {fmtScore(
                                        p.audit_scores?.[row.key] as
                                            | number
                                            | undefined
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                    <tr className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="sticky left-0 z-10 bg-white px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">
                            List price
                        </td>
                        {products.map((p) => {
                            const offer = p.offers?.[0]
                            const num = Number(offer?.price ?? p.price ?? 0)
                            return (
                                <td
                                    key={`${p.slug}-price`}
                                    className="px-4 py-3 text-lg font-black tabular-nums text-slate-950"
                                >
                                    {num > 0
                                        ? formatShelfPriceUsd(num) || "—"
                                        : "—"}
                                </td>
                            )
                        })}
                    </tr>
                    {specKeys.map((sk) => (
                        <tr
                            key={sk}
                            className="border-b border-slate-100 hover:bg-slate-50/80"
                        >
                            <td className="sticky left-0 z-10 bg-white px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                {sk.replace(/_/g, " ")}
                            </td>
                            {products.map((p) => (
                                <td
                                    key={`${p.slug}-spec-${sk}`}
                                    className="px-4 py-3 text-[11px] font-medium leading-snug text-slate-700"
                                >
                                    {(p.technical_specs &&
                                        p.technical_specs[sk]) ||
                                        "—"}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td className="sticky left-0 z-10 bg-slate-50 px-4 py-4 align-top text-[9px] font-black uppercase tracking-widest text-slate-500">
                            Official listing
                        </td>
                        {products.map((p) => {
                            const primary =
                                p.offers?.find((o) => o.primary) ||
                                p.offers?.[0]
                            const href = resolveDealHref(p)
                            const isRegistryFallback =
                                href.startsWith("/registry")
                            const priceNum = Number(
                                primary?.price ?? p.price ?? 0
                            )
                            const priceLabel =
                                priceNum > 0 && Number.isFinite(priceNum)
                                    ? formatShelfPriceUsd(priceNum) ||
                                      "Current price"
                                    : "Current price"
                            const siteLabel =
                                primary?.site?.trim() || "Official store"

                            return (
                                <td
                                    key={`${p.slug}-cta`}
                                    className="px-4 py-4 align-top"
                                >
                                    <div className="flex flex-col gap-2">
                                        {isRegistryFallback ? (
                                            <Link
                                                href={href}
                                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-slate-800 transition-colors hover:border-blue-300 hover:text-blue-700"
                                            >
                                                Open dossier
                                                <ExternalLink className="h-3 w-3 shrink-0" />
                                            </Link>
                                        ) : (
                                            <a
                                                href={href}
                                                target="_blank"
                                                rel="nofollow sponsored"
                                                className="inline-flex w-full flex-col items-stretch gap-1 rounded-xl bg-slate-950 px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-blue-600"
                                            >
                                                <span className="flex items-center justify-center gap-2">
                                                    View deal · {priceLabel}
                                                    <ExternalLink className="h-3 w-3 shrink-0 opacity-80" />
                                                </span>
                                                <span className="text-[8px] font-bold normal-case tracking-wide text-white/70">
                                                    {siteLabel}
                                                </span>
                                            </a>
                                        )}
                                        <p className="text-[8px] leading-snug text-slate-400">
                                            Affiliate routing may apply. See
                                            listing for final price.
                                        </p>
                                    </div>
                                </td>
                            )
                        })}
                    </tr>
                </tfoot>
            </table>
        </div>
    )
}
