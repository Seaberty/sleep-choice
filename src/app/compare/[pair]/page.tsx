import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import { CompareTable } from "@/components/compare/compare-table"
import { RegistryDetailLink } from "@/components/registry-detail-link"
import { getProductsForCompare } from "@/lib/registry"
import {
    buildComparePairDescription,
    buildComparePairTitle,
    buildDynamicCompareVerdict,
    canonicalComparePairSlug,
    comparePairPath,
    getMergedComparePairs,
    parseComparePairSlug,
    resolveCompareSeoPair
} from "@/lib/compare-seo"
import { SITE_ORIGIN } from "@/lib/site-origin"
import { ChevronLeft, GitCompare } from "lucide-react"

type Props = {
    params: Promise<{ pair: string }>
}

export const revalidate = 3600

export async function generateStaticParams() {
    try {
        const pairs = await getMergedComparePairs()
        return pairs.map((p) => ({ pair: p.pairSlug }))
    } catch {
        return []
    }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { pair } = await params
    const parsed = parseComparePairSlug(pair)
    if (!parsed) return { title: "Compare" }

    const canonical = canonicalComparePairSlug(parsed.slugA, parsed.slugB)
    const curated = await resolveCompareSeoPair(canonical)
    const products = await getProductsForCompare([parsed.slugA, parsed.slugB])

    const title = buildComparePairTitle(products, curated?.title)
    const description = buildComparePairDescription(
        products,
        curated?.description
    )

    return {
        title,
        description: description.slice(0, 160),
        alternates: { canonical: `/compare/${canonical}` },
        openGraph: {
            title,
            description: description.slice(0, 200),
            url: `${SITE_ORIGIN}/compare/${canonical}`
        }
    }
}

export default async function ComparePairPage({ params }: Props) {
    const { pair } = await params
    const parsed = parseComparePairSlug(pair)
    if (!parsed) notFound()

    const canonical = canonicalComparePairSlug(parsed.slugA, parsed.slugB)
    if (pair !== canonical) {
        redirect(`/compare/${canonical}`)
    }

    const curated = await resolveCompareSeoPair(canonical)
    const products = await getProductsForCompare([parsed.slugA, parsed.slugB])
    if (products.length < 2) notFound()

    const intro =
        curated?.intro ??
        `Forensic side-by-side comparison of ${products[0].brand} and ${products[1].brand} registry audits.`
    const verdict = buildDynamicCompareVerdict(products)
    const pageTitle = buildComparePairTitle(products, curated?.title)

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: pageTitle,
        description: buildComparePairDescription(
            products,
            curated?.description
        ),
        url: `${SITE_ORIGIN}/compare/${canonical}`,
        isPartOf: {
            "@type": "WebSite",
            name: "SleepChoice Guide",
            url: SITE_ORIGIN
        },
        about: products.map((p) => ({
            "@type": "Product",
            name: `${p.brand} ${p.name ?? p.slug}`,
            url: `${SITE_ORIGIN}/registry/${p.slug}`
        }))
    }

    return (
        <main className="min-h-screen bg-white overflow-x-clip pt-24 pb-24 sm:pt-28 sm:pb-32 md:pt-36 md:pb-40">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
                <nav className="mb-8 flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Link
                        href="/compare"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-slate-950"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Compare hub
                    </Link>
                    <span>/</span>
                    <span className="text-slate-600 truncate max-w-[min(100%,20rem)]">
                        {canonical}
                    </span>
                </nav>

                <header className="border-b border-slate-100 pb-10 mb-10">
                    <p className="text-[9px] font-black uppercase tracking-[0.35em] text-blue-600 mb-3 flex items-center gap-2">
                        <GitCompare className="h-3.5 w-3.5" />
                        Indexed comparison
                    </p>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-[1000] tracking-tight text-slate-950 leading-tight">
                        {pageTitle}
                    </h1>
                    <p className="mt-4 max-w-3xl text-sm text-slate-600 leading-relaxed">
                        {intro}
                    </p>
                    {verdict ? (
                        <p className="mt-4 max-w-3xl text-sm font-medium text-slate-800 leading-relaxed border-l-4 border-blue-600 pl-4">
                            {verdict}
                        </p>
                    ) : null}
                    <p className="mt-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Full dossiers:{" "}
                        {products.map((p, i) => (
                            <span key={p.slug}>
                                {i > 0 ? " · " : ""}
                                <RegistryDetailLink
                                    href={`/registry/${p.slug}`}
                                    className="text-blue-600 hover:underline"
                                >
                                    {p.brand} {p.name ?? p.slug}
                                </RegistryDetailLink>
                            </span>
                        ))}
                    </p>
                </header>

                <CompareTable products={products} />

                <footer className="mt-16 pt-10 border-t border-slate-100">
                    <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                        Scores are synthesized from third-party reviews and listing
                        signals—see{" "}
                        <Link
                            href="/methodology"
                            className="text-blue-600 font-bold hover:underline"
                        >
                            methodology
                        </Link>{" "}
                        and{" "}
                        <Link
                            href="/disclosure"
                            className="text-blue-600 font-bold hover:underline"
                        >
                            disclosure
                        </Link>
                        . Outbound deal links may earn affiliate commission.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                            href="/registry"
                            className="inline-flex rounded-xl border-2 border-slate-950 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-slate-950 hover:text-white transition-colors"
                        >
                            Browse registry
                        </Link>
                        <Link
                            href={comparePairPath(parsed.slugA, parsed.slugB)}
                            className="inline-flex rounded-xl bg-blue-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-slate-950 transition-colors"
                        >
                            Share this comparison
                        </Link>
                    </div>
                </footer>
            </div>
        </main>
    )
}
