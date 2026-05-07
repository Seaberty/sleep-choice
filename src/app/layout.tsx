import { Inter, JetBrains_Mono } from "next/font/google"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { getSiteHeaderMetrics } from "@/lib/site-metrics"
import { cn } from "@/lib/utils"
import { SpeedInsights } from "@vercel/speed-insights/next"
import Script from "next/script"
import "./globals.css"

// 主字体：用于大规模文本阅读
const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap"
})

// 等宽字体：用于显示审计代码、实验室得分和技术指标，增加权威感
const mono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
    display: "swap"
})

export const metadata = {
    metadataBase: new URL("https://sleepchoiceguide.com"),
    title: {
        default:
            "SleepChoice Guide | Bio-Performance Registry & Sleep Forensics",
        template: "%s | SleepChoice Registry"
    },
    description:
        "Global registry for non-sponsored sleep architecture audits. Independent forensic analysis of spinal alignment and chemical safety."
    // ... metadata 保持之前的硬核 SEO 配置
}

export default async function RootLayout({
    children
}: {
    children: React.ReactNode
}) {
    const siteMetrics = await getSiteHeaderMetrics()

    return (
        <html lang="en" className="scroll-smooth antialiased">
            <body
                className={cn(
                    inter.variable,
                    mono.variable,
                    "font-sans bg-[#fdfdfd] text-slate-900 min-h-screen flex flex-col"
                )}
            >
                {/* 1. 高级 Schema 注入：从 Organization 升级为 MedicalOrganization 以提升权威得分 */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "MedicalOrganization",
                            name: "SleepChoice Intelligence Unit",
                            url: "https://sleepchoiceguide.com",
                            logo: "https://sleepchoiceguide.com/logo.png",
                            contactPoint: {
                                "@type": "ContactPoint",
                                contactType: "Technical Support",
                                email: "lab@sleepchoiceguide.com"
                            },
                            knowsAbout: [
                                "Sleep Science",
                                "Material Forensics",
                                "Biometrics"
                            ],
                            description:
                                "Autonomous research entity specializing in sleep technology audits and material safety benchmarks."
                        })
                    }}
                />

                {/* 2. 布局优化：SiteHeader 内部应处理吸顶逻辑 */}
                <SiteHeader metrics={siteMetrics} />

                {/* 3. 解决“样式闪烁”的关键：
                   使用 pt (padding-top) 替代偏移类名，并结合 CSS 变量。
                   这样在 JS 加载前，浏览器就能预留出 Header 的空间。
                */}
                <main className="flex-grow pt-[var(--header-height,110px)] md:pt-[var(--header-height,140px)]">
                    {children}
                </main>

                <SiteFooter />

                {/* 4. 辅助视觉：防止移动端弹性滚动导致的背景留白 */}
                <div className="fixed inset-0 -z-50 bg-[#fdfdfd]" />
                <SpeedInsights />

                {/* 5. Skimlinks 脚本：使用 Next.js 标准加载方式 */}
                <Script
                    id="skimlinks-js"
                    strategy="afterInteractive"
                    src="https://s.skimresources.com/js/302440X1790440.skimlinks.js"
                />

                {/* Google Analytics 4 */}
                <Script
                    src="https://www.googletagmanager.com/gtag/js?id=G-SCZWF4WVTR"
                    strategy="afterInteractive"
                />
                <Script id="google-analytics" strategy="afterInteractive">
                    {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-SCZWF4WVTR');
          `}
                </Script>
            </body>
        </html>
    )
}
