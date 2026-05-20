import Link from "next/link"
import type { Metadata } from "next"
import { SEO_GUIDES } from "@/lib/seo-guides"
import { BookOpen, ArrowRight, Activity } from "lucide-react"

export const metadata: Metadata = {
    title: "Sleep Buying Guides · Evidence-Based Playbooks",
    description:
        "Long-form guides on reading SleepChoice audits, side-sleeper mattress picks, wool vs down-alternative bedding, and Saatva lineup comparisons.",
    alternates: { canonical: "/guides" }
}

export default function GuidesIndexPage() {
    const sorted = [...SEO_GUIDES].sort(
        (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )

    return (
        <main className="min-h-screen bg-[#F8FAFC] pt-28 pb-24 md:pt-32">
            <div className="container mx-auto max-w-4xl px-4 sm:px-6">
                <header className="mb-14">
                    <p className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-blue-600">
                        <Activity className="h-4 w-4 animate-pulse" />
                        Editorial guides
                    </p>
                    <h1 className="text-3xl font-[1000] tracking-tight text-slate-950 md:text-5xl">
                        Sleep buying guides
                    </h1>
                    <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
                        Standalone playbooks—not registry mirrors—linking to audits,
                        compare pages, and tools. Updated when scoring methodology or
                        catalog focus shifts.
                    </p>
                    <p className="mt-4">
                        <a
                            href="/guides/rss.xml"
                            className="text-[10px] font-black uppercase tracking-widest text-blue-700 hover:text-slate-950"
                        >
                            RSS feed (guides + comparisons)
                        </a>
                    </p>
                </header>

                <ul className="space-y-6">
                    {sorted.map((g) => (
                        <li key={g.slug}>
                            <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
                                <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <BookOpen className="h-4 w-4 text-blue-600" />
                                    Updated{" "}
                                    {new Date(g.updatedAt).toLocaleDateString(
                                        "en-US",
                                        {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric"
                                        }
                                    )}
                                </div>
                                <h2 className="text-xl font-[1000] tracking-tight text-slate-950">
                                    <Link
                                        href={`/guides/${g.slug}`}
                                        className="hover:text-blue-700"
                                    >
                                        {g.title}
                                    </Link>
                                </h2>
                                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                                    {g.description}
                                </p>
                                <Link
                                    href={`/guides/${g.slug}`}
                                    className="mt-6 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-700"
                                >
                                    Read guide
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </article>
                        </li>
                    ))}
                </ul>
            </div>
        </main>
    )
}
