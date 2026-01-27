import Link from "next/link"
import {
    ShieldCheck,
    AlertCircle,
    CheckCircle2,
    FileText,
    Lock,
    Scale,
    ArrowRight
} from "lucide-react"

export const metadata = {
    title: "Affiliate Disclosure & Editorial Policy | SleepChoice Guide",
    description:
        "Complete transparency about our affiliate relationships, editorial independence, and testing methodology. We accept no free products and maintain zero brand partnerships.",
    openGraph: {
        title: "Affiliate Disclosure | SleepChoice Guide",
        description:
            "Our commitment to editorial independence and transparency in affiliate relationships.",
        type: "article"
    },
    alternates: {
        canonical: "/disclosure"
    }
}

export default function DisclosurePage() {
    const disclosureSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Affiliate Disclosure & Editorial Policy",
        description:
            "Complete transparency about our affiliate relationships and editorial independence",
        author: {
            "@type": "Organization",
            name: "SleepChoice Guide",
            url: "https://sleepchoiceguide.com"
        },
        publisher: {
            "@type": "Organization",
            name: "SleepChoice Guide",
            logo: {
                "@type": "ImageObject",
                url: "https://sleepchoiceguide.com/logo.png"
            }
        },
        datePublished: "2026-01-07",
        dateModified: "2026-01-07"
    }

    return (
        <main className="container mx-auto px-6 py-16 md:py-24 max-w-4xl">
            {/* Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(disclosureSchema)
                }}
            />

            {/* Header */}
            <header className="mb-20 md:mb-24">
                <div className="flex items-center gap-3 text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] mb-6">
                    <ShieldCheck className="w-4 h-4" />
                    Full Transparency
                </div>
                <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase mb-6 leading-[0.9]">
                    Affiliate Disclosure <br />
                    <span className="text-blue-600">& Editorial Policy</span>
                </h1>
                <p className="text-lg text-slate-600 font-bold leading-relaxed">
                    Complete transparency about how we operate, how we make
                    money, and our unwavering commitment to editorial
                    independence.
                </p>
            </header>

            {/* Main Content */}
            <div className="space-y-12">
                {/* Affiliate Disclosure */}
                <section className="bg-white border-2 border-slate-200 rounded-3xl p-8 md:p-12">
                    <div className="flex items-center gap-3 mb-6">
                        <FileText className="w-6 h-6 text-blue-600" />
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                            Affiliate Disclosure
                        </h2>
                    </div>
                    <div className="prose prose-lg max-w-none space-y-6">
                        <p className="text-slate-700 font-bold leading-relaxed">
                            <strong className="text-slate-900">
                                SleepChoiceGuide.com
                            </strong>{" "}
                            is a reader-supported independent review authority.
                            We participate in affiliate marketing programs and
                            may earn a commission when you purchase through our
                            links—at no extra cost to you.
                        </p>
                        <p className="text-slate-700 font-bold leading-relaxed">
                            When you click on links to retailers (such as
                            Amazon, Saatva, or other brands) and make a
                            purchase, we may receive a small commission. This
                            helps fund our independent testing facility and
                            allows us to continue providing free, unbiased
                            reviews.
                        </p>
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mt-8">
                            <p className="text-blue-900 font-black uppercase tracking-tight mb-3 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                                Important to Know
                            </p>
                            <p className="text-blue-800 font-bold leading-relaxed">
                                Affiliate commissions never influence our
                                scoring, rankings, or editorial content. We
                                routinely rank expensive brands lower than
                                budget models when the data supports it.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Editorial Independence */}
                <section className="bg-white border-2 border-slate-200 rounded-3xl p-8 md:p-12">
                    <div className="flex items-center gap-3 mb-6">
                        <ShieldCheck className="w-6 h-6 text-emerald-500" />
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                            Editorial Independence
                        </h2>
                    </div>
                    <div className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            {[
                                {
                                    icon: <Lock className="w-6 h-6" />,
                                    title: "No Free Products",
                                    desc: "We purchase every mattress at full retail price. Zero free samples, zero brand partnerships."
                                },
                                {
                                    icon: <Scale className="w-6 h-6" />,
                                    title: "No Sponsored Content",
                                    desc: "We never accept payment for positive reviews, featured placements, or editorial influence."
                                },
                                {
                                    icon: <ShieldCheck className="w-6 h-6" />,
                                    title: "No Brand Partnerships",
                                    desc: "Zero exclusive deals, partnerships, or preferential treatment for any brand or manufacturer."
                                },
                                {
                                    icon: <CheckCircle2 className="w-6 h-6" />,
                                    title: "Data-Driven Rankings",
                                    desc: "All rankings are based solely on our independent laboratory testing results. Data rules, always."
                                }
                            ].map((principle, i) => (
                                <div
                                    key={i}
                                    className="p-6 bg-slate-50 rounded-2xl border border-slate-100"
                                >
                                    <div className="text-blue-600 mb-4">
                                        {principle.icon}
                                    </div>
                                    <h3 className="text-lg font-black uppercase tracking-tight mb-2">
                                        {principle.title}
                                    </h3>
                                    <p className="text-sm text-slate-600 font-bold leading-relaxed">
                                        {principle.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Testing Methodology */}
                <section className="bg-white border-2 border-slate-200 rounded-3xl p-8 md:p-12">
                    <div className="flex items-center gap-3 mb-6">
                        <AlertCircle className="w-6 h-6 text-amber-500" />
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                            Our Testing Process
                        </h2>
                    </div>
                    <div className="space-y-6">
                        <p className="text-slate-700 font-bold leading-relaxed">
                            Every mattress we review undergoes rigorous
                            independent testing in our laboratory facility. Our
                            testing protocol includes:
                        </p>
                        <ul className="space-y-4">
                            {[
                                "Pressure mapping and spinal alignment analysis",
                                "Temperature regulation and cooling performance",
                                "VOC emissions and material safety testing",
                                "Durability testing (50,000+ compression cycles)",
                                "Edge support and motion isolation metrics",
                                "30-night real-world durability test"
                            ].map((item, i) => (
                                <li
                                    key={i}
                                    className="flex items-start gap-3 text-slate-700 font-bold"
                                >
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-8">
                            <Link
                                href="/methodology"
                                className="inline-flex items-center gap-2 text-blue-600 font-black uppercase tracking-wider text-sm hover:underline"
                            >
                                Read Our Full Testing Methodology
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </section>

                {/* How We Make Money */}
                <section className="bg-slate-900 rounded-3xl p-8 md:p-12 text-white">
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-6">
                        How We Fund Our Lab
                    </h2>
                    <div className="space-y-6">
                        <p className="text-slate-300 font-bold leading-relaxed text-lg">
                            Running an independent testing facility is expensive.
                            Here's how we fund our operations while maintaining
                            complete editorial independence:
                        </p>
                        <div className="space-y-4">
                            {[
                                {
                                    method: "Affiliate Commissions",
                                    desc: "We earn a small commission (typically 3-10%) when you purchase through our links. This never affects our scoring."
                                },
                                {
                                    method: "Reader Support",
                                    desc: "Some readers choose to support our work directly, allowing us to purchase additional test units."
                                },
                                {
                                    method: "Transparency",
                                    desc: "Every dollar goes back into testing more products, maintaining our equipment, and hiring certified experts."
                                }
                            ].map((item, i) => (
                                <div
                                    key={i}
                                    className="p-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl"
                                >
                                    <h3 className="text-lg font-black uppercase tracking-tight mb-2">
                                        {item.method}
                                    </h3>
                                    <p className="text-slate-300 font-bold leading-relaxed">
                                        {item.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Commitment */}
                <section className="bg-emerald-50 border-2 border-emerald-500 rounded-3xl p-8 md:p-12">
                    <div className="flex items-center gap-3 mb-6">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-emerald-900">
                            Our Commitment to You
                        </h2>
                    </div>
                    <p className="text-emerald-800 font-bold leading-relaxed text-lg">
                        We are committed to providing honest, unbiased, and
                        data-driven mattress reviews. Our integrity is our
                        greatest asset, and we will never compromise it for
                        financial gain. When you use our links, you're
                        supporting independent journalism and helping us test
                        more products—all while getting the same price you'd
                        pay directly.
                    </p>
                </section>

                {/* Contact */}
                <section className="bg-white border-2 border-slate-200 rounded-3xl p-8 md:p-12 text-center">
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-6">
                        Questions or Concerns?
                    </h2>
                    <p className="text-slate-600 font-bold leading-relaxed mb-8 max-w-xl mx-auto">
                        If you have any questions about our disclosure, testing
                        methodology, or editorial process, we're happy to
                        discuss.
                    </p>
                    <Link
                        href="/contact"
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-black uppercase tracking-wider text-sm transition-all shadow-lg active:scale-95"
                    >
                        Contact Us
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </section>
            </div>
        </main>
    )
}


