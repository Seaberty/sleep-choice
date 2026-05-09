import Link from "next/link"
import {
    BookOpen,
    FlaskConical,
    Scale,
    GitCompare,
    Database,
    FileText,
    ArrowRight,
    Activity
} from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Technical Docs · Protocol Library",
    description:
        "Index of SleepChoice Guide audit protocols: methodology, lab scoring, disclosure, comparison tools, and data interfaces.",
    alternates: { canonical: "/docs" }
}

export default function TechnicalDocsPage() {
    const sections = [
        {
            href: "/methodology",
            title: "Audit Methodology",
            desc: "How audits are scored, data sources, and known limitations.",
            icon: BookOpen
        },
        {
            href: "/lab",
            title: "Testing Protocols",
            desc: "Live lab metrics and how registry scores align to protocols.",
            icon: FlaskConical
        },
        {
            href: "/disclosure",
            title: "Full Disclosure",
            desc: "Affiliate and algorithmic transparency for this facility.",
            icon: Scale
        },
        {
            href: "/compare",
            title: "Audit Comparison",
            desc: "Side-by-side profiles from the verified registry index.",
            icon: GitCompare
        },
        {
            href: "/registry",
            title: "Verified Registry",
            desc: "Searchable archive of registry mattress dossiers (review-synthesized intelligence).",
            icon: Database
        },
        {
            href: "/journal",
            title: "Sleep Journal",
            desc: "Chronological observation logs and forensic narratives.",
            icon: FileText
        }
    ]

    return (
        <main className="min-h-screen bg-[#fdfdfd] pt-28 pb-24 font-sans selection:bg-blue-600 selection:text-white md:pt-32">
            <div className="container mx-auto max-w-5xl px-6">
                <header className="mb-16 border-l-4 border-slate-950 pl-8">
                    <div className="mb-6 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.35em] text-blue-600">
                        <Activity className="h-4 w-4 animate-pulse" />
                        Technical Documentation
                    </div>
                    <h1 className="mb-6 text-4xl font-[1000] uppercase tracking-tighter text-slate-950 md:text-6xl">
                        Protocol{" "}
                        <span className="text-blue-700 not-italic">Library</span>
                    </h1>
                    <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-600">
                        Central index for methodology, operational disclosure,
                        and interfaces used by the SleepChoice Guide intelligence
                        unit. Use these routes as the canonical reference for how
                        scores and observations are produced.
                    </p>
                </header>

                <ul className="grid gap-6 sm:grid-cols-2">
                    {sections.map(({ href, title, desc, icon: Icon }) => (
                        <li key={href}>
                            <Link
                                href={href}
                                className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:border-blue-600 hover:shadow-md"
                            >
                                <div className="mb-4 flex items-center gap-3">
                                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-blue-700 transition-colors group-hover:border-blue-200 group-hover:bg-blue-50">
                                        <Icon className="h-5 w-5" strokeWidth={2} />
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Route
                                    </span>
                                </div>
                                <h2 className="mb-3 text-lg font-[1000] uppercase tracking-tight text-slate-950">
                                    {title}
                                </h2>
                                <p className="mb-6 flex-grow text-sm leading-relaxed text-slate-600">
                                    {desc}
                                </p>
                                <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-700">
                                    Open
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </main>
    )
}
