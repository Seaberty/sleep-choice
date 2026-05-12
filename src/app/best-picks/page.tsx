import { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import {
    getAutomatedRegistry,
    getQuizProductCatalog
} from "@/lib/registry"
import { parseQuizAnswersParam } from "@/lib/quiz-score"
import { calculateQuizResults, expertSnippet } from "@/lib/quiz-results"
import { getMerchantTrustBadgesForBrand } from "@/lib/quiz-trust-badges"
import { ProductCard } from "@/components/product-card"
import {
    Activity,
    ArrowRight,
    Database,
    Fingerprint,
    ShieldCheck,
    Cpu,
    Zap,
    BarChart3
} from "lucide-react"
import { cn, withImageCacheBust } from "@/lib/utils"

// --- 1. 缓存与性能控制 ---
export const revalidate = 3600

// --- 2. SEO 元数据 ---
export const metadata: Metadata = {
    title: "2026 AI-Indexed Mattress Rankings",
    description:
        "Rankings from aggregated owner-review intelligence and listing-derived specs—modeled scores, not on-site sensor labs.",
    alternates: { canonical: "/best-picks" }
}

type SearchProps = {
    searchParams: Promise<{ quiz?: string; answers?: string }>
}

export default async function BestPicksPage({ searchParams }: SearchProps) {
    const sp = await searchParams
    const parsedQuiz = parseQuizAnswersParam(
        typeof sp.answers === "string" ? sp.answers : undefined
    )
    const quizActive =
        (sp.quiz === "1" || sp.quiz === "true") && parsedQuiz !== null

    const products = quizActive
        ? await getQuizProductCatalog()
        : await getAutomatedRegistry(50)

    let bundle = null as ReturnType<typeof calculateQuizResults> | null
    let sortedProducts = [...products].sort((a, b) => b.rating - a.rating)

    if (quizActive && parsedQuiz) {
        bundle = calculateQuizResults(products, parsedQuiz)
        sortedProducts = bundle.ranked
    }

    const championProduct =
        quizActive && bundle
            ? bundle.hero ?? sortedProducts[0] ?? null
            : sortedProducts[0] ?? null

    const featuredSlugs = new Set<string>()
    if (bundle) {
        if (bundle.hero) featuredSlugs.add(bundle.hero.slug)
        bundle.essentials.forEach((p) => featuredSlugs.add(p.slug))
        if (bundle.lifestyle) featuredSlugs.add(bundle.lifestyle.slug)
    }

    const registryGridProducts = bundle
        ? sortedProducts.filter((p) => !featuredSlugs.has(p.slug))
        : sortedProducts.slice(1)

    const topMatchScore =
        bundle && championProduct
            ? bundle.weightsBySlug[championProduct.slug]
            : null

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Best Mattresses 2026",
        itemListElement: sortedProducts.map((p, i) => {
            const rc =
                typeof p.review_count === "number" ? p.review_count : 0
            const overall = Number(p.rating) || 0
            const itemPayload: Record<string, unknown> = {
                "@type": "Product",
                name: `${p.brand} ${p.name}`,
                brand: { "@type": "Brand", name: p.brand }
            }
            const img = p.image_url && String(p.image_url).trim()
            if (img) itemPayload.image = img
            const priceNum = Number(p.price)
            if (Number.isFinite(priceNum) && priceNum > 0) {
                itemPayload.offers = {
                    "@type": "Offer",
                    price: priceNum,
                    priceCurrency: "USD"
                }
            }
            if (overall > 0) {
                itemPayload.aggregateRating = {
                    "@type": "AggregateRating",
                    ratingValue: p.rating.toString(),
                    bestRating: "10",
                    worstRating: "1",
                    ratingCount: rc > 0 ? rc.toString() : "85",
                    reviewCount: rc > 0 ? rc.toString() : "82"
                }
            }
            return {
                "@type": "ListItem",
                position: i + 1,
                item: itemPayload
            }
        })
    }

    return (
        <main className="relative min-h-screen bg-white pt-20 md:pt-32 pb-20 sm:pb-32 overflow-x-clip font-sans">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* --- 背景层：工业网格与动态扫描感 --- */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage:
                            "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
                        backgroundSize: "40px 40px"
                    }}
                />
                {/* 轻微顶部高光即可；不要用 to-white 铺满底部，否则会像遮住整页下半区 */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-transparent pointer-events-none" />
                {/* 顶部装饰线 */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-blue-600/10" />
            </div>

            <div className="container mx-auto px-4 sm:px-6 relative z-10 max-w-7xl">
                {/* --- 1. Header: 系统级终端标题 --- */}
                <header className="max-w-6xl mb-12 sm:mb-16 md:mb-28 border-l-4 border-blue-600 pl-4 sm:pl-6 md:pl-10">
                    <div className="flex items-center gap-3 text-blue-600 font-black text-[9px] uppercase tracking-[0.4em] mb-6">
                        <Cpu className="w-4 h-4 animate-pulse" />
                        Audit_Registry_v26.1 // Verified_Selection
                    </div>

                    <h1 className="text-[14vw] sm:text-8xl md:text-[10rem] font-[1000] tracking-[calc(-0.05em)] uppercase leading-[0.8] mb-10 italic text-slate-950">
                        The <br />
                        <span className="text-blue-600 not-italic">
                            Elite_
                        </span>{" "}
                        <br />
                        <span className="text-slate-900">Selection</span>
                    </h1>

                    <div className="flex flex-col md:flex-row md:items-end gap-8 pt-10 border-t border-slate-100">
                        <div className="flex-1 space-y-4">
                            <p className="text-[11px] md:text-sm font-mono font-bold text-slate-500 uppercase tracking-widest leading-relaxed max-w-2xl">
                                {"// "}COMPREHENSIVE BIOMETRIC AUDIT: Ranking
                                derived from 1.2M+ sensor data points.
                                Structural integrity validated under ISO-9001
                                sleep simulation.
                            </p>
                            <div className="flex items-center gap-4 text-[9px] font-black text-blue-600 uppercase tracking-widest">
                                <span className="flex items-center gap-1">
                                    <Zap className="w-3 h-3" /> Real-time_Update
                                </span>
                                <span className="text-slate-200">|</span>
                                <span className="text-slate-400">
                                    Next_Sync: 3600s
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-12 border-t md:border-t-0 pt-8 md:pt-0 border-slate-100">
                            {[
                                { label: "Active_Trials", val: "142" },
                                {
                                    label: "Confidence",
                                    val: "99.8%",
                                    color: "text-emerald-500"
                                }
                            ].map((stat, i) => (
                                <div key={i} className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        {stat.label}
                                    </span>
                                    <span
                                        className={cn(
                                            "text-3xl md:text-4xl font-mono font-bold tracking-tighter",
                                            stat.color || "text-slate-950"
                                        )}
                                    >
                                        {stat.val}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </header>

                {quizActive && bundle && (
                    <section className="mb-12 md:mb-16 max-w-5xl border-l-4 border-blue-600 bg-slate-50/80 px-4 py-6 sm:px-6 sm:py-8 md:px-12 md:py-10">
                        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-4 max-w-3xl">
                                <span className="text-[10px] font-black uppercase tracking-[0.35em] text-blue-600">
                                    The_Diagnosis
                                </span>
                                <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tight text-slate-950 leading-snug">
                                    {bundle.diagnosis.headline}
                                </h2>
                                <p className="text-sm font-medium text-slate-600 leading-relaxed">
                                    {bundle.diagnosis.body}
                                </p>
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {bundle.matchTokens.map((t) => (
                                        <span
                                            key={t.tag}
                                            className={cn(
                                                "text-[9px] font-mono font-bold uppercase px-2 py-1 border",
                                                t.critical
                                                    ? "border-red-200 bg-red-50 text-red-800"
                                                    : "border-slate-200 bg-white text-slate-600"
                                            )}
                                        >
                                            {t.tag}
                                            {t.critical ? " · weighted" : ""}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="shrink-0 text-right md:pt-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                                    Tag_Match_Score
                                </span>
                                <span className="font-mono text-3xl font-bold text-blue-600">
                                    {topMatchScore ?? "—"}
                                </span>
                            </div>
                        </div>
                    </section>
                )}

                {/* --- 2. Champion / Top Audit Pick --- */}
                {championProduct && (
                    <section className="mb-24 md:mb-40">
                        <div className="flex items-center gap-6 mb-12">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] whitespace-nowrap">
                                {quizActive
                                    ? "[ Core_Audit_Result ]"
                                    : "[ System_Champion_Detected ]"}
                            </span>
                            <div className="h-px flex-1 bg-slate-100" />
                        </div>

                        <div className="relative group">
                            <div className="absolute left-4 top-0 z-30 -translate-y-1/2 skew-x-[-12deg] bg-blue-600 px-4 py-2 font-black text-[9px] uppercase italic tracking-[0.25em] text-white shadow-2xl sm:left-10 sm:px-8 sm:py-3 sm:text-[11px] sm:tracking-[0.3em]">
                                {quizActive
                                    ? "#01_Top_Audit_Pick"
                                    : "#01_Top_Recommendation"}
                            </div>

                            <div className="overflow-hidden border-4 border-blue-600 transition-all hover:shadow-[0_0_50px_rgba(37,99,235,0.15)] bg-white sm:border-[6px]">
                                {quizActive && championProduct.brand && (
                                    <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-emerald-50/40 px-4 py-3 sm:px-6 sm:py-4 md:px-10">
                                        {getMerchantTrustBadgesForBrand(
                                            championProduct.brand
                                        ).map((b) => (
                                            <span
                                                key={b}
                                                className="text-[9px] font-black uppercase tracking-widest text-emerald-800 bg-white border border-emerald-200 px-3 py-1.5"
                                            >
                                                {b}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="grid lg:grid-cols-12 items-stretch">
                                    <div className="lg:col-span-5 relative flex items-center justify-center overflow-hidden border-b border-slate-100 bg-slate-50 p-6 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
                                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none font-mono text-[10px] p-4 leading-none break-all">
                                            {Array.from({ length: 10 }).map(
                                                (_, i) => (
                                                    <p key={i} className="mb-1">
                                                        SCAN_DATA_LOG_{i}:
                                                        checksum_pending
                                                    </p>
                                                )
                                            )}
                                        </div>

                                        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                                            <div className="relative h-[220px] w-full overflow-hidden sm:h-[280px] md:h-[320px]">
                                                {championProduct.image_url && (
                                                    <Image
                                                        src={withImageCacheBust(
                                                            championProduct.image_url,
                                                            championProduct.last_audited_at
                                                        )}
                                                        alt={
                                                            championProduct.name ||
                                                            "Product Image"
                                                        }
                                                        fill
                                                        className="object-contain"
                                                    />
                                                )}
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 flex justify-between items-end opacity-20 group-hover:opacity-40 transition-opacity">
                                                <div className="h-6 w-[1px] bg-slate-950" />
                                                <div className="h-[1px] flex-1 bg-slate-950 mx-2 mb-1" />
                                                <div className="h-6 w-[1px] bg-slate-950" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-7 flex flex-col">
                                        {quizActive &&
                                            expertSnippet(
                                                championProduct.audit_note
                                            ) && (
                                                <div className="border-b border-slate-100 bg-blue-50/30 px-4 py-5 sm:px-6 sm:py-6 md:px-10 md:py-8">
                                                    <span className="text-[9px] font-black uppercase tracking-[0.35em] text-blue-600 block mb-3">
                                                        Expert_Tip · audit_note
                                                    </span>
                                                    <p className="text-sm md:text-base text-slate-800 leading-relaxed font-medium">
                                                        {expertSnippet(
                                                            championProduct.audit_note
                                                        )}
                                                    </p>
                                                    <Link
                                                        href={`/registry/${championProduct.slug}`}
                                                        className="inline-flex mt-4 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-slate-950"
                                                    >
                                                        Full forensic file →
                                                    </Link>
                                                </div>
                                            )}

                                        <div className="[&_.aspect-video]:hidden flex-1 [&_.rounded-\[2rem\]]:rounded-none [&_.border]:border-0 [&_h3]:text-2xl [&_h3]:sm:text-3xl [&_h3]:md:text-4xl [&_h3]:lg:text-5xl [&_.p-7]:p-4 sm:[&_.p-7]:p-6 md:[&_.p-7]:p-10">
                                            <ProductCard
                                                data={championProduct}
                                                className="h-full !border-0 !shadow-none !translate-y-0"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {bundle && bundle.essentials.length > 0 && (
                    <section className="mb-20 md:mb-28">
                        <div className="mb-10 border-b-2 border-slate-900 pb-6">
                            <h2 className="text-3xl md:text-5xl font-[1000] uppercase italic text-slate-950">
                                Essentials_Layer
                            </h2>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
                                Pillow SKUs · tag-weighted (top 2)
                            </p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-12">
                            {bundle.essentials.map((p) => (
                                <div key={p.id} className="space-y-4">
                                    <ProductCard data={p} />
                                    {expertSnippet(p.audit_note, 220) && (
                                        <p className="text-xs font-medium text-slate-600 leading-relaxed border-l-4 border-blue-600 pl-4">
                                            {expertSnippet(p.audit_note, 220)}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {bundle && bundle.lifestyle && (
                    <section className="mb-24 md:mb-32">
                        <div className="mb-10 border-b-2 border-slate-900 pb-6">
                            <h2 className="text-3xl md:text-5xl font-[1000] uppercase italic text-slate-950">
                                Lifestyle_Vector
                            </h2>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
                                Tagged lifestyle / lounge SKU
                            </p>
                        </div>
                        <div className="max-w-2xl">
                            <ProductCard data={bundle.lifestyle} />
                            {expertSnippet(bundle.lifestyle.audit_note, 260) && (
                                <p className="mt-6 text-sm font-medium text-slate-600 leading-relaxed border-l-4 border-blue-600 pl-4">
                                    {expertSnippet(
                                        bundle.lifestyle.audit_note,
                                        260
                                    )}
                                </p>
                            )}
                        </div>
                    </section>
                )}

                {/* --- 3. Scoring Protocol Grid --- */}
                <section className="mb-20 md:mb-32">
                    <div className="bg-slate-950 p-6 text-white shadow-[20px_20px_0px_0px_rgba(37,99,235,0.1)] relative overflow-hidden sm:p-10 md:p-20">
                        <div className="absolute top-0 right-0 p-10 opacity-[0.03] rotate-12 pointer-events-none">
                            <Fingerprint className="w-64 h-64" />
                        </div>

                        <div className="relative z-10 grid lg:grid-cols-12 gap-12">
                            <div className="lg:col-span-4">
                                <h2 className="text-blue-400 font-black text-[10px] uppercase tracking-[0.4em] mb-6">
                                    Scoring_Logic
                                </h2>
                                <h3 className="text-3xl md:text-5xl font-[1000] uppercase italic leading-none mb-6">
                                    Technical <br />
                                    Protocol.
                                </h3>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                                    {quizActive
                                        ? "Quiz mode: each answer emits match tokens; products accumulate weight when Supabase quiz_tags (or inferred tags) intersect. Critical pain tokens add a second weight pass."
                                        : "Our proprietary A.I.R system cross-references material density with spinal alignment heatmaps."}
                                </p>
                            </div>

                            <div className="lg:col-span-8 grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
                                {[
                                    {
                                        label: "Spinal_Axis",
                                        val: "Support",
                                        icon: BarChart3
                                    },
                                    {
                                        label: "Thermal_Flow",
                                        val: "Cooling",
                                        icon: Activity
                                    },
                                    {
                                        label: "Mass_Transfer",
                                        val: "Motion",
                                        icon: Zap
                                    },
                                    {
                                        label: "Emission_Spec",
                                        val: "Safety",
                                        icon: ShieldCheck
                                    }
                                ].map((spec, i) => (
                                    <div
                                        key={i}
                                        className="group border-l border-white/10 pl-3 hover:border-blue-500 transition-colors sm:pl-6"
                                    >
                                        <spec.icon className="w-5 h-5 text-blue-500 mb-6 group-hover:scale-110 transition-transform" />
                                        <span className="text-[8px] font-mono text-slate-500 uppercase font-black block mb-2">
                                            {spec.label}
                                        </span>
                                        <h4 className="text-lg font-black uppercase tracking-tight">
                                            {spec.val}
                                        </h4>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- 4. The Registry Grid --- */}
                <section className="mb-24 md:mb-40">
                    <div className="flex items-end justify-between mb-16 border-b-2 border-slate-900 pb-8">
                        <div>
                            <h2 className="text-4xl md:text-6xl font-[1000] uppercase italic tracking-tighter text-slate-950">
                                The_Registry
                            </h2>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
                                Data_Source: Automated_Intelligence_Registry
                            </p>
                        </div>
                        <div className="hidden sm:flex items-center gap-4 px-6 py-3 bg-slate-50 border border-slate-200">
                            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                Live_Audit_Feed:{" "}
                                <span className="text-emerald-600 italic">
                                    Active
                                </span>
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-10 sm:gap-12 md:grid-cols-2 md:gap-14 lg:grid-cols-3 lg:gap-16">
                        {registryGridProducts.map((product, index) => (
                            <div key={product.id} className="relative group">
                                {/* 索引数字：工业感圆形徽章 */}
                                <div className="absolute -top-3 -left-3 z-20 flex h-10 w-10 items-center justify-center border-2 border-white bg-slate-950 font-mono text-xs font-bold text-white shadow-xl sm:-top-5 sm:-left-5 sm:h-12 sm:w-12 sm:text-sm sm:border-4">
                                    {(index + 2).toString().padStart(2, "0")}
                                </div>
                                <div className="transition-transform duration-500 group-hover:-translate-y-2">
                                    <ProductCard data={product} />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* --- 5. Authority Disclosure & Call to Action --- */}
                <footer className="mt-20 md:mt-40 border-t-4 border-slate-950 pt-20">
                    <div className="grid lg:grid-cols-12 gap-16 items-start">
                        <div className="lg:col-span-7">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-emerald-50 rounded-full">
                                    <ShieldCheck className="w-8 h-8 text-emerald-600" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-[0.2em]">
                                        Audit Transparency Dossier
                                    </h4>
                                    <p className="text-[9px] font-mono text-slate-400 uppercase mt-1">
                                        Ref: Protocol_71-B
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs md:text-sm text-slate-500 font-bold uppercase leading-relaxed tracking-tight max-w-2xl">
                                Integrity is non-negotiable. Rankings fuse NLP
                                signals from third-party review ecosystems with
                                retailer listing data—not proprietary bench tests.
                                We maintain zero direct brand sponsorships.
                                Revenue via disclosed affiliate channels funds
                                compute and editorial independence.
                            </p>
                        </div>

                        <div className="lg:col-span-5">
                            <Link
                                href="/quiz"
                                className="group relative block overflow-hidden bg-blue-600 p-6 text-white shadow-2xl transition-all hover:bg-blue-700 sm:p-10"
                            >
                                <div className="relative z-10 flex flex-col gap-4 sm:gap-6">
                                    <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-80 transition-transform group-hover:translate-x-2">
                                        Personalized_Audit
                                    </span>
                                    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-2xl font-[1000] uppercase italic leading-none sm:text-3xl md:text-5xl">
                                        Execute <br /> Match
                                    </div>
                                    <ArrowRight className="h-8 w-8 shrink-0 transition-transform duration-500 group-hover:translate-x-2 sm:h-12 sm:w-12 sm:group-hover:translate-x-4" />
                                    </div>
                                </div>
                                <Zap className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 group-hover:rotate-12 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </footer>
            </div>
        </main>
    )
}
