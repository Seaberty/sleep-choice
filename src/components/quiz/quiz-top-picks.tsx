import Image from "next/image"
import Link from "next/link"
import { RegistryDetailLink } from "@/components/registry-detail-link"
import { QuizGoCta } from "@/components/quiz/quiz-go-cta"
import { quizFitBullets, type MatchToken } from "@/lib/quiz-results"
import type { QuizAnswers } from "@/lib/quiz-score"
import type { ProductData } from "@/types/product"
import { formatShelfPriceUsd } from "@/lib/deals-utils"
import { cn, withImageCacheBust } from "@/lib/utils"
import { ExternalLink, ShieldCheck } from "lucide-react"

type Props = {
    picks: ProductData[]
    answers: QuizAnswers
    matchTokens: MatchToken[]
    weightsBySlug: Record<string, number>
}

export function QuizTopPicks({
    picks,
    answers,
    matchTokens,
    weightsBySlug
}: Props) {
    const top3 = picks.slice(0, 3)
    if (top3.length === 0) return null

    return (
        <section className="mb-16 md:mb-24">
            <div className="mb-10 flex items-center gap-6">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 whitespace-nowrap">
                    [ Top_3_Match_Matrix ]
                </span>
                <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid gap-8 md:grid-cols-3 md:gap-6 lg:gap-8">
                {top3.map((p, i) => {
                    const rank = i + 1
                    const bullets = quizFitBullets(p, answers, matchTokens)
                    const score = weightsBySlug[p.slug]
                    const offer = p.offers?.[0]
                    const price =
                        Number(p.price) || Number(offer?.price) || 0

                    return (
                        <article
                            key={p.id}
                            className={cn(
                                "relative flex flex-col border-[3px] border-slate-950 bg-white shadow-[8px_8px_0px_0px_rgba(37,99,235,0.12)]",
                                rank === 1 && "md:-mt-2 md:border-blue-600 md:shadow-[12px_12px_0px_0px_rgba(37,99,235,0.2)]"
                            )}
                        >
                            <div
                                className={cn(
                                    "px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-white",
                                    rank === 1 ? "bg-blue-600" : "bg-slate-950"
                                )}
                            >
                                #{rank.toString().padStart(2, "0")}_Match
                                {score != null ? (
                                    <span className="ml-2 font-mono tabular-nums opacity-90">
                                        · {score} pts
                                    </span>
                                ) : null}
                            </div>

                            <div className="relative aspect-[4/3] bg-slate-50 border-b border-slate-100">
                                {p.image_url ? (
                                    <Image
                                        src={withImageCacheBust(
                                            p.image_url,
                                            p.last_audited_at
                                        )}
                                        alt={p.name || p.model || p.slug}
                                        fill
                                        className="object-contain p-4"
                                        sizes="(max-width: 768px) 100vw, 33vw"
                                    />
                                ) : null}
                            </div>

                            <div className="flex flex-1 flex-col p-5 sm:p-6">
                                <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">
                                    {p.brand}
                                </span>
                                <h3 className="mt-1 text-lg font-[1000] uppercase italic leading-tight tracking-tighter text-slate-950 sm:text-xl">
                                    {p.name || p.model}
                                </h3>

                                <ul className="mt-4 space-y-2 flex-1">
                                    {bullets.map((b) => (
                                        <li
                                            key={b}
                                            className="flex gap-2 text-[11px] font-medium leading-snug text-slate-600"
                                        >
                                            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                            <span>{b}</span>
                                        </li>
                                    ))}
                                </ul>

                                <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
                                    <QuizGoCta
                                        slug={p.slug}
                                        brand={p.brand}
                                        label={
                                            rank === 1
                                                ? "Primary_CTA · View deal"
                                                : "Check price"
                                        }
                                        priceLabel={
                                            price > 0
                                                ? formatShelfPriceUsd(price)
                                                : undefined
                                        }
                                        rank={rank}
                                    />
                                    <RegistryDetailLink
                                        href={`/registry/${p.slug}`}
                                        className="inline-flex text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600"
                                    >
                                        Full audit dossier →
                                    </RegistryDetailLink>
                                </div>
                            </div>
                        </article>
                    )
                })}
            </div>

            <p className="mt-6 text-center text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                Outbound via{" "}
                <Link
                    href="/disclosure"
                    className="text-blue-600 underline-offset-2 hover:underline"
                >
                    /go
                </Link>{" "}
                affiliate gateways ·{" "}
                <ExternalLink className="inline h-3 w-3" aria-hidden />
            </p>
        </section>
    )
}
