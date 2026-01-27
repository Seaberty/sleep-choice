import Link from "next/link"
import {
    Microscope,
    ShieldCheck,
    Beaker,
    Award,
    Thermometer,
    Activity,
    AlertCircle,
    CheckCircle2,
    Clock,
    Users,
    Database,
    ArrowRight
} from "lucide-react"

export const metadata = {
    title: "How We Test Mattresses | Our Testing Methodology 2026",
    description:
        "Comprehensive breakdown of our independent testing protocol: pressure mapping, spinal alignment, temperature regulation, VOC emissions, and durability testing. ISO-certified lab standards.",
    openGraph: {
        title: "Mattress Testing Methodology | SleepChoice Guide",
        description:
            "See exactly how we test mattresses in our independent laboratory. Transparent, rigorous, unbiased.",
        type: "article"
    },
    alternates: {
        canonical: "/methodology"
    }
}

export default function MethodologyPage() {
    const methodologySchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "How We Test Mattresses | Our Testing Methodology 2026",
        description:
            "Comprehensive breakdown of our independent testing protocol",
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

    const testingProtocols = [
        {
            icon: <Activity className="w-6 h-6" />,
            title: "Pressure Mapping",
            score: "Support Score",
            desc: "We deploy high-resolution pressure sensors across the mattress surface to measure force distribution. Our system captures data points every 2cm, generating a detailed map of pressure zones.",
            details: [
                "90+ sensors per square meter",
                "Real-time data collection over 30 nights",
                "Analysis of 7 sleep positions",
                "Spinal alignment verification"
            ]
        },
        {
            icon: <Thermometer className="w-6 h-6" />,
            title: "Thermal Regulation",
            score: "Cooling Index",
            desc: "Temperature sensors embedded throughout the mattress track heat dissipation over 8-hour sleep cycles. We measure BTU loss per square inch and airflow patterns.",
            details: [
                "Continuous monitoring for 240 hours",
                "Ambient temperature control (70°F ± 2°F)",
                "Humidity tracking at 45% ± 5%",
                "Microclimate analysis"
            ]
        },
        {
            icon: <ShieldCheck className="w-6 h-6" />,
            title: "Material Safety",
            score: "VOC Emissions",
            desc: "Third-party certified VOC (Volatile Organic Compound) testing in accordance with GREENGUARD Gold standards. We test for formaldehyde, benzene, and other harmful emissions.",
            details: [
                "Off-gassing testing at 72 hours",
                "HEPA-filtered chamber environment",
                "SGS-certified laboratory",
                "California Prop 65 compliance check"
            ]
        },
        {
            icon: <Beaker className="w-6 h-6" />,
            title: "Durability Testing",
            score: "Longevity Score",
            desc: "Automated compression testing simulates 10 years of use in 90 days. We measure sag depth, edge support retention, and material degradation.",
            details: [
                "50,000 compression cycles",
                "Edge support retention testing",
                "Motion transfer analysis",
                "Material integrity verification"
            ]
        }
    ]

    return (
        <main className="container mx-auto px-6 py-16 md:py-24 max-w-4xl">
            {/* Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(methodologySchema)
                }}
            />

            {/* Hero Section */}
            <header className="mb-20 md:mb-24">
                <div className="flex items-center gap-3 text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] mb-6">
                    <Database className="w-4 h-4" />
                    ISO-Certified Protocol
                </div>
                <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-[0.9] mb-6">
                    How We Test <br />
                    <span className="text-blue-600">Everything.</span>
                </h1>
                <p className="text-lg md:text-xl text-slate-600 font-bold leading-relaxed mb-8 max-w-2xl">
                    Our testing methodology is completely transparent. Here's
                    exactly how we evaluate every mattress in our laboratory,
                    with no marketing influence—just data.
                </p>
            </header>

            {/* Core Principles */}
            <section className="mb-20 grid md:grid-cols-3 gap-6">
                {[
                    {
                        icon: <ShieldCheck className="w-6 h-6" />,
                        title: "100% Independent",
                        desc: "We purchase every mattress at retail price. Zero free samples, zero brand partnerships."
                    },
                    {
                        icon: <Award className="w-6 h-6" />,
                        title: "Expert Verified",
                        desc: "All test results reviewed by Certified Sleep Science Coaches (CSCT) before publication."
                    },
                    {
                        icon: <Clock className="w-6 h-6" />,
                        title: "30-Night Minimum",
                        desc: "Each mattress undergoes real-world testing for at least 30 nights before scoring."
                    }
                ].map((principle, i) => (
                    <div
                        key={i}
                        className="p-8 bg-white border-2 border-slate-200 rounded-3xl"
                    >
                        <div className="text-blue-600 mb-6">{principle.icon}</div>
                        <h3 className="text-xl font-black uppercase tracking-tight mb-3">
                            {principle.title}
                        </h3>
                        <p className="text-slate-600 font-bold leading-relaxed">
                            {principle.desc}
                        </p>
                    </div>
                ))}
            </section>

            {/* Testing Protocols */}
            <section className="mb-20">
                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-12">
                    Our Testing Protocols
                </h2>
                <div className="space-y-8">
                    {testingProtocols.map((protocol, index) => (
                        <div
                            key={index}
                            className="p-10 bg-white border-2 border-slate-200 rounded-3xl hover:border-blue-600 transition-colors"
                        >
                            <div className="flex items-start gap-6 mb-6">
                                <div className="p-4 bg-blue-600 text-white rounded-2xl">
                                    {protocol.icon}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-4 mb-3">
                                        <h3 className="text-2xl font-black uppercase tracking-tight">
                                            {protocol.title}
                                        </h3>
                                        <span className="px-4 py-1 bg-slate-100 text-slate-900 text-xs font-black uppercase tracking-wider rounded-full">
                                            {protocol.score}
                                        </span>
                                    </div>
                                    <p className="text-slate-600 font-bold leading-relaxed text-lg mb-6">
                                        {protocol.desc}
                                    </p>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {protocol.details.map((detail, i) => (
                                            <div
                                                key={i}
                                                className="flex items-start gap-3"
                                            >
                                                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                                <span className="text-sm font-bold text-slate-700">
                                                    {detail}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Lab Facility Info */}
            <section className="mb-20 bg-slate-900 rounded-3xl p-12 md:p-20 text-white">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-6">
                            Our Laboratory Facility
                        </h2>
                        <p className="text-slate-300 font-bold leading-relaxed mb-8 text-lg">
                            Our 2,000 sq ft testing facility in San Francisco
                            houses state-of-the-art equipment for independent
                            mattress evaluation. Every test follows ISO/IEC
                            17025 standards.
                        </p>
                        <div className="space-y-4">
                            {[
                                "Climate-controlled environment (70°F ± 2°F)",
                                "ISO/IEC 17025 certified equipment",
                                "HEPA-filtered air quality",
                                "24/7 security monitoring"
                            ].map((feature, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-3"
                                >
                                    <CheckCircle2 className="w-5 h-5 text-blue-400" />
                                    <span className="font-bold text-slate-200">
                                        {feature}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 p-10 rounded-3xl">
                        <div className="flex items-center gap-3 mb-6">
                            <Users className="w-6 h-6 text-blue-400" />
                            <h3 className="text-xl font-black uppercase">
                                Testing Team
                            </h3>
                        </div>
                        <p className="text-slate-300 font-bold leading-relaxed mb-6">
                            Our team consists of certified sleep science
                            coaches, materials engineers, and data scientists
                            with combined 50+ years of experience.
                        </p>
                        <Link
                            href="/about"
                            className="inline-flex items-center gap-2 text-blue-400 font-black uppercase tracking-wider text-sm hover:text-white transition-colors"
                        >
                            Meet the Experts
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Transparency Disclaimer */}
            <section className="bg-slate-50 rounded-3xl p-10 border-2 border-dashed border-slate-200">
                <div className="flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-1" />
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight mb-4">
                            Full Transparency
                        </h3>
                        <p className="text-slate-600 font-bold leading-relaxed mb-4">
                            We accept no free products, no sponsored content,
                            and no brand partnerships. Our affiliate links help
                            fund our testing facility, but they never influence
                            our scoring methodology. We routinely rank expensive
                            brands lower than budget models when the data
                            supports it.
                        </p>
                        <Link
                            href="/disclosure"
                            className="text-blue-600 font-black uppercase tracking-wider text-sm hover:underline inline-flex items-center gap-2"
                        >
                            Read Full Disclosure
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    )
}


