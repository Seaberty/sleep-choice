import Link from "next/link"
import type { CompareSeoPair } from "@/lib/compare-seo"
import { ArrowRight, GitCompare } from "lucide-react"

type Props = {
    pairs: CompareSeoPair[]
    curatedCount?: number
}

export function ComparePairIndex({ pairs, curatedCount }: Props) {
    const autoCount =
        curatedCount != null ? Math.max(0, pairs.length - curatedCount) : null

    return (
        <section className="mt-16 border-t border-slate-100 pt-12">
            <div className="mb-8 flex items-center gap-3">
                <GitCompare className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-[1000] uppercase tracking-tight text-slate-950">
                    Popular comparisons
                </h2>
            </div>
            <p className="mb-8 max-w-2xl text-sm text-slate-600 leading-relaxed">
                Indexable side-by-side pages for high-intent search queries.
                {autoCount != null && autoCount > 0 ? (
                    <>
                        {" "}
                        Includes {pairs.length} pairs ({curatedCount} editorial
                        + {autoCount} from live registry).
                    </>
                ) : (
                    <> Each URL includes editorial context plus the live matrix.</>
                )}
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pairs.map((p) => (
                    <li key={p.pairSlug}>
                        <Link
                            href={`/compare/${p.pairSlug}`}
                            className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50/50 p-6 transition-all hover:border-blue-600 hover:bg-white hover:shadow-md"
                        >
                            <h3 className="text-sm font-[1000] text-slate-950 leading-snug group-hover:text-blue-700 line-clamp-2">
                                {p.title}
                            </h3>
                            <p className="mt-2 flex-grow text-xs text-slate-500 leading-relaxed line-clamp-2">
                                {p.description}
                            </p>
                            <span className="mt-4 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600">
                                Open matrix
                                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    )
}
