import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { RegistryDetailLink } from "@/components/registry-detail-link"
import { getSeoGuide, listSeoGuideSlugs, SEO_GUIDES } from "@/lib/seo-guides"
import { SITE_ORIGIN } from "@/lib/site-origin"
import { ChevronLeft, BookOpen } from "lucide-react"

type Props = {
    params: Promise<{ slug: string }>
}

export function generateStaticParams() {
    return listSeoGuideSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const guide = getSeoGuide(slug)
    if (!guide) return { title: "Guide" }

    return {
        title: guide.title,
        description: guide.description.slice(0, 160),
        alternates: { canonical: `/guides/${guide.slug}` },
        openGraph: {
            title: guide.title,
            description: guide.description,
            type: "article",
            publishedTime: guide.publishedAt,
            modifiedTime: guide.updatedAt,
            url: `${SITE_ORIGIN}/guides/${guide.slug}`
        }
    }
}

export default async function GuidePage({ params }: Props) {
    const { slug } = await params
    const guide = getSeoGuide(slug)
    if (!guide) notFound()

    const articleLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        datePublished: guide.publishedAt,
        dateModified: guide.updatedAt,
        url: `${SITE_ORIGIN}/guides/${guide.slug}`,
        author: {
            "@type": "Organization",
            name: "SleepChoice Intelligence Unit",
            url: SITE_ORIGIN
        },
        publisher: {
            "@type": "Organization",
            name: "SleepChoice Guide",
            url: SITE_ORIGIN
        },
        mainEntityOfPage: `${SITE_ORIGIN}/guides/${guide.slug}`
    }

    const breadcrumbLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "Guides",
                item: `${SITE_ORIGIN}/guides`
            },
            {
                "@type": "ListItem",
                position: 2,
                name: guide.title,
                item: `${SITE_ORIGIN}/guides/${guide.slug}`
            }
        ]
    }

    return (
        <main className="min-h-screen bg-white pt-28 pb-24 md:pt-32">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(breadcrumbLd)
                }}
            />
            <article className="container mx-auto max-w-3xl px-4 sm:px-6">
                <nav className="mb-10">
                    <Link
                        href="/guides"
                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-slate-950"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        All guides
                    </Link>
                </nav>

                <header className="mb-12 border-b border-slate-100 pb-10">
                    <p className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                        Updated{" "}
                        {new Date(guide.updatedAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric"
                        })}
                    </p>
                    <h1 className="text-3xl font-[1000] tracking-tight text-slate-950 md:text-4xl leading-tight">
                        {guide.title}
                    </h1>
                    <p className="mt-4 text-base text-slate-600 leading-relaxed">
                        {guide.description}
                    </p>
                </header>

                <div className="prose prose-slate max-w-none prose-headings:font-[1000] prose-headings:tracking-tight prose-h2:text-xl prose-p:text-slate-600 prose-p:leading-relaxed">
                    {guide.sections.map((section) => (
                        <section key={section.heading} className="mb-10">
                            <h2>{section.heading}</h2>
                            {section.paragraphs.map((para, i) => (
                                <p key={i}>{para}</p>
                            ))}
                        </section>
                    ))}
                </div>

                {(guide.relatedRegistrySlugs.length > 0 ||
                    guide.relatedComparePairSlugs.length > 0) && (
                    <aside className="mt-16 rounded-2xl border border-slate-200 bg-slate-50 p-8">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4">
                            Related routes
                        </h2>
                        {guide.relatedRegistrySlugs.length > 0 ? (
                            <ul className="mb-4 space-y-2 text-sm">
                                {guide.relatedRegistrySlugs.map((s) => (
                                    <li key={s}>
                                        <RegistryDetailLink
                                            href={`/registry/${s}`}
                                            className="font-bold text-blue-600 hover:underline"
                                        >
                                            Registry: {s}
                                        </RegistryDetailLink>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                        {guide.relatedComparePairSlugs.length > 0 ? (
                            <ul className="space-y-2 text-sm">
                                {guide.relatedComparePairSlugs.map((pair) => (
                                    <li key={pair}>
                                        <Link
                                            href={`/compare/${pair}`}
                                            className="font-bold text-blue-600 hover:underline"
                                        >
                                            Compare: {pair.replace(/-vs-/g, " vs ")}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                        <p className="mt-6 text-xs text-slate-500">
                            <Link href="/quiz" className="text-blue-600 font-bold hover:underline">
                                Sleep quiz
                            </Link>
                            {" · "}
                            <Link href="/deals" className="text-blue-600 font-bold hover:underline">
                                Deals vault
                            </Link>
                        </p>
                    </aside>
                )}

                <footer className="mt-12 pt-8 border-t border-slate-100 text-xs text-slate-500">
                    More guides:{" "}
                    {SEO_GUIDES.filter((g) => g.slug !== guide.slug)
                        .slice(0, 3)
                        .map((g, i) => (
                            <span key={g.slug}>
                                {i > 0 ? " · " : ""}
                                <Link
                                    href={`/guides/${g.slug}`}
                                    className="text-blue-600 font-bold hover:underline"
                                >
                                    {g.title.split(":")[0]}
                                </Link>
                            </span>
                        ))}
                </footer>
            </article>
        </main>
    )
}
