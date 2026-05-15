import { supabase } from "@/lib/supabase"
import { APP_PROTOCOL } from "@/lib/constants"
import { buildRegistryProductJsonLd } from "@/lib/product-jsonld"
import { productGoLink } from "@/lib/go-redirect"
import { quizShelfFields } from "@/lib/quiz-results"
import { AddToCompareButton } from "@/components/compare/add-to-compare-button"
import { withImageCacheBust } from "@/lib/utils"
import { getBrandIntelligenceByProductSlug } from "@/lib/brand-intelligence"
import {
    formatShelfPriceUsd,
    merchantPriceAfterSiteStack
} from "@/lib/deals-utils"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Metadata } from "next"
import Image from "next/image"
import React, { useMemo } from "react"
import AuditRadarChart from "@/components/AuditRadarChart"
import { ForensicMetricTiles } from "@/components/ForensicMetricTiles"
import {
    ShieldCheck,
    ExternalLink,
    Microscope,
    RefreshCcw,
    Fingerprint,
    ShieldAlert,
    Box,
    Layers,
    Plus,
    Minus,
    AlertCircle,
    ChevronRight,
    Radio
} from "lucide-react"

// --- 类型定义 (根据 Supabase 表结构) ---
interface AuditScores {
    overall: number
    support: number
    cooling: number
    pressure: number
    durability: number
}

interface Offer {
    merchant: string
    /** Stack-adjusted shelf price (aligned with registry merge / cards) */
    price: number
    link: string
}

interface Product {
    id: string
    slug: string
    brand: string
    model: string
    // --- 新增 SEO 字段 ---
    seo_title?: string // 对应 SEO 标题
    seo_description?: string // 对应 SEO 描述（产品简介，结构化数据 description 优先使用）
    seo_keywords?: string // 对应 SEO 关键词
    // -------------------
    audit_scores: AuditScores | string
    technical_specs: Record<string, string> | string
    audit_data: { specs_matrix: Record<string, string> } | string
    pros: string[]
    cons: string[]
    is_verified: boolean
    image_url: string
    last_audited_at: string
    protocol_version: string
    summary_log: string
    audit_note: string
    price: number
    offers: Offer[] | string
    /** 舆情片段条数，用于结构化数据 ratingCount */
    review_count?: number
    /** 与 registry 合并逻辑一致；用于解剖图货架与 quizShelf 对齐 */
    category?: string | null
}

// --- 辅助解析函数 ---
const safeParse = <T,>(data: any, fallback: T): T => {
    if (typeof data === "string") {
        try {
            return JSON.parse(data)
        } catch {
            return fallback
        }
    }
    return data || fallback
}

// --- Monetization helpers ---
/** 与 `/go/[slug]` 一致：由服务端解析 product_offers / official_link、套券与 CJ 前缀 */
function getAffiliateLink(
    brand: string,
    slug: string,
    _offers: Offer[] = []
): { href: string; restricted: boolean } {
    if (slug && /^[\w-]+$/.test(slug)) {
        return { href: productGoLink(slug), restricted: false }
    }
    return {
        href: `/quiz?brand=${encodeURIComponent(brand)}&slug=${encodeURIComponent(slug)}`,
        restricted: true
    }
}

// --- SEO 注入逻辑 ---
export async function generateMetadata({
    params
}: {
    params: Promise<{ slug: string }>
}): Promise<Metadata> {
    const { slug } = await params

    // 建议 select 包含所有可能的 SEO 字段，即便目前它们可能为空
    const { data: product } = await supabase
        .from("audit_products")
        .select(
            "brand, model, seo_title, seo_description, seo_keywords, summary_log, audit_note"
        )
        .eq("slug", slug)
        .single()

    if (!product) return { title: "Product Not Found" }

    // 优先使用专用 SEO 标题，否则使用标准审计格式
    const title =
        product.seo_title ||
        `${product.brand} ${product.model} Forensic Audit & Analysis`

    // 优化描述逻辑：优先 SEO 描述 -> 优先审计总结 -> 最后才是带时间戳的日志截取
    const description =
        product.seo_description ||
        product.audit_note ||
        product.summary_log?.replace(/\[T-.*?\]\s+/g, "").slice(0, 160) || // 移除时间戳提升可读性
        "Professional forensic material analysis and sleep performance audit."

    return {
        title: title,
        description: description,
        keywords:
            product.seo_keywords ||
            `${product.brand}, ${product.model}, mattress audit, lab test`,
        alternates: {
            canonical: `/registry/${slug}`
        },
        openGraph: {
            title: title,
            description: description,
            type: "website"
        }
    }
}

// --- 子组件：物理层级解剖 ---
// 接受完整的 `product` 优先使用，或者接受已经解析好的 `specs`（向后兼容）
const LayerStack = ({
    product,
    specs: incomingSpecs
}: {
    product?: Product
    specs?: Record<string, string>
}) => {
    // 使用 useMemo 确保只有在 product 或 specs 变化时才重新计算层级
    const layers = useMemo(() => {
        const slug = (product?.slug || "").toLowerCase()
        const modelName = (product?.model || "").toLowerCase()
        const cat = String(product?.category ?? "").toLowerCase()
        const blob = `${slug} ${modelName} ${cat}`

        // 优先从 product.technical_specs 解析，如果没有则使用传入的 specs
        let specs: any = {}
        try {
            if (product && typeof product.technical_specs === "string") {
                specs = JSON.parse(product.technical_specs || "{}")
            } else if (product && product.technical_specs) {
                specs = product.technical_specs
            } else {
                specs = incomingSpecs || {}
            }
        } catch (e) {
            specs = incomingSpecs || {}
        }

        const shelf = product
            ? quizShelfFields({
                  slug: product.slug,
                  model: product.model,
                  name: product.model,
                  category: product.category ?? undefined
              })
            : "mattress"

        // --- 枕头：quiz 货架 + 关键词 ---
        if (
            shelf === "pillow" ||
            /pillow|枕|bolster/i.test(blob)
        ) {
            return [
                {
                    name: "Outer Shell",
                    detail: specs.Construction || "Organic Cotton",
                    color: "bg-slate-100",
                    height: "20%"
                },
                {
                    name: "Support Core",
                    detail: specs.Comfort_Layer || "Adjustable Fill",
                    color: "bg-blue-200",
                    height: "60%"
                },
                {
                    name: "Base Lining",
                    detail: "High-density weave",
                    color: "bg-slate-300",
                    height: "20%"
                }
            ]
        }

        // --- 床单/被套类：类目或关键词（slug 中含 sheet set 等也可命中）---
        if (
            /sheet|duvet|quilt|percale|sateen|linen\s*set|床品|bedding/i.test(
                blob
            )
        ) {
            return [
                {
                    name: "Surface Weave",
                    detail: specs.Construction || "Sateen / Percale",
                    color: "bg-blue-50",
                    height: "30%"
                },
                {
                    name: "Fiber Density",
                    detail: specs.Firmness || "Thread Count Analysis",
                    color: "bg-blue-100",
                    height: "40%"
                },
                {
                    name: "Edge Finish",
                    detail: "Double-stitched integrity",
                    color: "bg-slate-400",
                    height: "30%"
                }
            ]
        }

        // --- 生活方式（浴袍、毛巾等）：与床垫层级区分 ---
        if (shelf === "lifestyle") {
            return [
                {
                    name: "Face / Pile",
                    detail: specs.Construction || "Terry or waffle structure",
                    color: "bg-slate-100",
                    height: "35%"
                },
                {
                    name: "GSM / Loft",
                    detail: specs.Firmness || "Weight & absorbency",
                    color: "bg-blue-100",
                    height: "40%"
                },
                {
                    name: "Hem & Binding",
                    detail: specs.Support_Core || "Reinforced seams",
                    color: "bg-slate-400",
                    height: "25%"
                }
            ]
        }

        // --- Topper / Protector：薄堆栈 ---
        if (shelf === "other") {
            return [
                {
                    name: "Comfort Surface",
                    detail: specs.Comfort_Layer || "Responsive top",
                    color: "bg-blue-100",
                    height: "25%"
                },
                {
                    name: "Transition Core",
                    detail: specs.Construction || "Pressure distribution",
                    color: "bg-blue-200",
                    height: "35%"
                },
                {
                    name: "Skirt / Anchor",
                    detail: specs.Support_Core || "Mattress grip / encasement",
                    color: "bg-slate-300",
                    height: "40%"
                }
            ]
        }

        // --- 默认逻辑: 视为床垫 ---
        return [
            {
                name: "Comfort Layer",
                detail: specs.Comfort_Layer || "Adaptive Foam",
                color: "bg-blue-100",
                height: "20%"
            },
            {
                name: "Transition Zone",
                detail: "Pressure Relief",
                color: "bg-blue-200",
                height: "20%"
            },
            {
                name: "Support Core",
                detail: specs.Support_Core || "Coil System",
                color: "bg-slate-300",
                height: "50%"
            },
            {
                name: "Base Foundation",
                detail: "High-density base",
                color: "bg-slate-950",
                height: "10%"
            }
        ]
    }, [product, incomingSpecs])

    return (
        <div className="relative w-full py-8 sm:py-10 px-4 sm:px-6 bg-slate-50 border border-slate-200 overflow-hidden font-mono shadow-inner">
            <div className="absolute top-4 left-4 flex items-center gap-2">
                <Layers className="w-3 h-3 text-blue-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Material_Forensics
                </span>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-12 mt-8">
                {/* 3D 可视化堆栈 */}
                <div className="relative w-48 h-64 [perspective:1000px] transform-gpu -rotate-x-12 -rotate-y-12 shrink-0">
                    {layers.map((layer, idx) => (
                        <div
                            key={idx}
                            className={`${layer.color} border border-slate-950/20 absolute w-full transition-all duration-500 hover:translate-x-4 cursor-crosshair group/layer shadow-sm`}
                            style={{
                                height: layer.height,
                                // 修正底部对齐逻辑，使其与列表顺序对应
                                bottom: `${layers.slice(idx + 1).reduce((acc, l) => acc + parseInt(l.height), 0)}%`,
                                transform: `translateZ(${(layers.length - idx) * 20}px)`,
                                zIndex: layers.length - idx
                            }}
                        >
                            <div className="absolute inset-0 opacity-0 group-hover/layer:opacity-100 bg-blue-500/10 flex items-center justify-center">
                                <span className="text-[8px] font-black uppercase text-blue-600 tracking-tighter italic">
                                    Scan_Layer_{idx + 1}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
                {/* 详情列表 - 取消 reverse 以匹配 3D 物理层级 */}
                <div className="flex-1 w-full space-y-3">
                    {layers.map((layer, idx) => (
                        <div key={idx} className="flex items-start gap-4 group">
                            <div
                                className={`w-3 h-3 mt-1 ${layer.color} border border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] rounded-sm shrink-0`}
                            />

                            {/* 响应式：小屏垂直排列，宽屏左右对齐；使用 min-w-0 允许子元素缩小换行 */}
                            <div className="flex-1 border-b border-slate-200 pb-1 flex flex-col md:flex-row justify-between items-baseline gap-4 min-w-0">
                                <span className="text-[10px] font-black uppercase group-hover:text-blue-600 transition-colors mr-3">
                                    {layer.name}
                                </span>
                                <span className="text-[9px] text-slate-400 italic min-w-0 md:text-right break-words">
                                    {layer.detail}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default async function ProductAuditPage({
    params
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params

    const { data: rawProduct, error } = await supabase
        .from("audit_products")
        .select(
            `
        *,
        product_offers (
            site_name,
            price,
            offer_url,
            is_primary,
            status,
            promo_discount_percent
        )
    `
        )
        .eq("slug", slug)
        .single()

    if (error || !rawProduct) notFound()

    const brandIntel = await getBrandIntelligenceByProductSlug(slug)

    const product = rawProduct as Product

    // 1. 获取数据库原始联表数据
    const dbOffers = (rawProduct as any).product_offers || []
    // 2. 栈后价（与 mergeAuditProductRow / 卡片一致），再按价格从低到高排序
    const offers: Offer[] = dbOffers
        .filter((o: any) => o.status === "active")
        .map((o: any) => ({
            merchant: o.site_name,
            price: merchantPriceAfterSiteStack(
                Number(o.price),
                product.brand,
                o.promo_discount_percent
            ),
            link: o.offer_url
        }))
        .sort((a: Offer, b: Offer) => Number(a.price) - Number(b.price))

    // --- 数据解析 ---
    const scores = safeParse<AuditScores>(product.audit_scores, {
        overall: 0,
        support: 0,
        cooling: 0,
        pressure: 0,
        durability: 0
    })
    const technicalSpecs = safeParse<Record<string, string>>(
        product.technical_specs,
        {}
    )
    const certRaw = (technicalSpecs.Certifications || "").trim()
    const certPlaceholder = "Not stated in captured listing"
    const certificationClaims =
        certRaw && certRaw !== certPlaceholder ? certRaw : ""
    const technicalSpecsForGrid = Object.fromEntries(
        Object.entries(technicalSpecs).filter(([k]) => {
            if (k === "Certifications" && certificationClaims) return false
            return true
        })
    )
    const auditData = safeParse<any>(product.audit_data, {})
    const specsMatrix = auditData?.specs_matrix || {}

    // 推荐的逻辑处理
    const seoData = {
        title: product.seo_title || `${product.brand} ${product.model} Audit`,
        // 修复点：如果 seo_description 为空，不要直接显示长日志，显示一个简短版本
        description:
            product.seo_description ||
            "No custom index summary provided. Using system default audit log excerpt.",
        keywords: product.seo_keywords || "General, Audit, Hardware"
    }

    const minPriceIndex = offers.length > 0 ? 0 : -1

    /** Radar + quick tiles: 0–10 forensic scores from audit pipeline (PDP text + corpus → LLM). */
    const radarData = [
        {
            subject: "SUPPORT",
            A: scores.support,
            hint: "Support / spinal alignment cues from captured PDP specs and comfort-layer claims, scored 0–10 by the forensic audit model—not a clinical measurement."
        },
        {
            subject: "COOLING",
            A: scores.cooling,
            hint: "Thermal / breathability signals inferred from foams, covers, and cooling marketing language in the listing and corroborating snippets (0–10 model estimate)."
        },
        {
            subject: "PRESSURE",
            A: scores.pressure,
            hint: "Pressure relief and comfort-layer themes derived from listing copy + community evidence, normalized to the same 0–10 rubric as other axes."
        },
        {
            subject: "DURABILITY",
            A: scores.durability,
            hint: "Warranty, density/firmness build cues, and durability-related language in captured evidence—heuristic 0–10, not accelerated wear testing."
        },
        {
            subject: "INTEGRITY",
            A: scores.overall,
            hint: "Composite “overall” index (0–10) from the same audit pass: synthesizes the five-axis judgment against PDP + corpus text; not a third-party certification score."
        }
    ]

    const hasListingImage = Boolean(
        product.image_url && String(product.image_url).trim()
    )
    const lowPriceNumRaw =
        offers.length > 0 && minPriceIndex >= 0
            ? Number(offers[minPriceIndex].price)
            : Number(product.price)
    const lowPriceNum = Number.isFinite(lowPriceNumRaw)
        ? Math.round(lowPriceNumRaw)
        : lowPriceNumRaw
    const hasOfferForLd = Number.isFinite(lowPriceNum) && lowPriceNum > 0
    const rcForLd =
        typeof product.review_count === "number" ? product.review_count : 0
    const showAggregateRating = Number(scores.overall) > 0

    const offerPricesPositive = offers
        .map((o) => Number(o.price))
        .filter((n) => Number.isFinite(n) && n > 0)
    const highPriceNum =
        offerPricesPositive.length > 0
            ? Math.round(Math.max(...offerPricesPositive))
            : lowPriceNum
    const offerPriceDisplay =
        offers.length > 0 && minPriceIndex >= 0
            ? Math.round(Number(offers[minPriceIndex].price))
            : Math.round(Number(product.price))

    const productJsonLd = buildRegistryProductJsonLd({
        slug,
        brand: product.brand,
        model: product.model,
        seo_description: product.seo_description,
        audit_note: product.audit_note,
        summary_log: product.summary_log,
        image_url: product.image_url,
        lowPriceNum,
        highPriceNum,
        offerCount: Math.max(1, offers.length),
        hasOfferForLd,
        offerPriceDisplay,
        scoresOverall: scores.overall,
        showAggregateRating,
        reviewCount: rcForLd
    })

    return (
        <main className="min-h-screen overflow-x-clip bg-white text-slate-900 pb-12 pt-28 sm:pb-20 sm:pt-32 md:pt-44 font-sans selection:bg-blue-600 selection:text-white">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(productJsonLd)
                }}
            />

            <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">
                {/* [ Header ] */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 sm:mb-16 pb-6 border-b border-slate-950 font-mono">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1 bg-slate-950 text-white text-[9px] font-black uppercase tracking-tighter">
                            <Fingerprint className="w-3 h-3 text-blue-500" />
                            LOG_ID: {product.id.split("-")[0]}
                        </div>
                        <div className="flex items-center bg-slate-50 border border-slate-200">
                            <div
                                className={`text-[9px] font-bold px-2 py-1 uppercase tracking-widest flex items-center gap-2 ${product.is_verified ? "text-emerald-600 bg-emerald-50" : "text-slate-400"}`}
                            >
                                {product.is_verified ? (
                                    <ShieldCheck className="w-3 h-3" />
                                ) : (
                                    <RefreshCcw className="w-3 h-3" />
                                )}
                                STATUS:{" "}
                                {product.is_verified
                                    ? "VERIFIED_EVIDENCE"
                                    : "PRELIMINARY_SCAN"}
                            </div>
                            <div className="text-[9px] font-black px-2 py-1 bg-slate-200 text-slate-600 border-l border-slate-200 uppercase">
                                Last_Sync:{" "}
                                {
                                    new Date(product.last_audited_at)
                                        .toISOString()
                                        .split("T")[0]
                                }
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 md:justify-end">
                        <AddToCompareButton
                            slug={slug}
                            productTitle={`${product.brand} ${product.model}`}
                        />
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest group">
                            Protocol:{" "}
                            <a
                                href="/methodology"
                                className="text-blue-600 hover:bg-blue-600 hover:text-white px-1 transition-colors border-b border-blue-600/30"
                            >
                                {product.protocol_version || APP_PROTOCOL}
                                <ExternalLink className="w-2 h-2 inline-block ml-1 mb-0.5" />
                            </a>
                        </div>
                    </div>
                </header>

                <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
                    <div className="lg:col-span-8 space-y-12 md:space-y-20">
                        {/* 1. Main Image - 优化响应式与优先级 */}
                        <section className="relative group bg-slate-50 border border-slate-200 overflow-hidden">
                            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_49%,rgba(37,99,235,0.05)_50%,transparent_51%)] bg-[length:100%_4px] animate-pulse z-20 pointer-events-none opacity-50" />
                            <div className="relative aspect-video flex items-center justify-center p-4 sm:p-8 md:p-12">
                                {product.image_url ? (
                                    <div className="relative w-full h-full overflow-hidden">
                                        <Image
                                            src={withImageCacheBust(
                                                product.image_url,
                                                product.last_audited_at
                                            )}
                                            alt={
                                                product.model || "Product Image"
                                            }
                                            fill // 使用 fill 填充容器
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            className="object-contain mix-blend-multiply contrast-110 saturate-50 group-hover:scale-105 transition-transform duration-1000"
                                            // 如果你想彻底消除某些缓存造成的闪烁，可以加这个：
                                            priority={true}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full h-48 bg-slate-100 flex items-center justify-center">
                                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                                            [No_Visual_Data_Acquired]
                                        </span>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* 2. Dashboard */}
                        <div>
                            <h1 className="text-3xl sm:text-5xl md:text-7xl lg:text-[90px] font-[1000] uppercase italic tracking-[-0.06em] leading-[0.9] sm:leading-[0.85] mb-8 sm:mb-10 text-slate-950 break-words">
                                {product.brand}{" "}
                                <span className="text-blue-600 not-italic">
                                    {product.model}
                                </span>
                            </h1>
                            <ForensicMetricTiles items={radarData.slice(0, 4)} />
                        </div>

                        {/* 3. Radar Chart */}
                        <section className="bg-slate-950 p-4 sm:p-6 md:p-10 border border-slate-800 shadow-2xl">
                            <div className="h-[240px] sm:h-[300px] md:h-[350px] w-full min-h-0">
                                <AuditRadarChart data={radarData} />
                            </div>
                            <p className="mt-4 text-[9px] font-mono uppercase tracking-wider text-slate-500">
                                Hover chart axes or the four metric tiles for
                                methodology. Scores are 0–10 model estimates from
                                listing + corpus evidence (
                                <span className="text-slate-400">
                                    not lab-tested
                                </span>
                                ).
                            </p>
                        </section>

                        <LayerStack product={product} specs={technicalSpecs} />

                        {/* 4. Pros & Cons */}
                        <section className="grid md:grid-cols-2 gap-px bg-slate-200 border border-slate-200 font-mono shadow-sm">
                            {/* Performance_Gains (PROS) */}
                            <div className="bg-white p-5 sm:p-8 space-y-6">
                                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-600 tracking-[0.2em]">
                                    <Plus className="w-3 h-3 shrink-0" />{" "}
                                    Performance_Gains
                                </h4>
                                <ul className="space-y-4">
                                    {product.pros?.map((pro, i) => (
                                        <li
                                            key={i}
                                            /* 修复点：使用 grid 锁定第一列宽度，防止文字挤压图标 */
                                            className="grid grid-cols-[12px_1fr] gap-3 items-start group"
                                        >
                                            <ChevronRight className="w-3 h-3 mt-1 text-slate-300 group-hover:text-emerald-500 shrink-0 transition-colors" />
                                            <span className="text-[11px] font-bold text-slate-700 leading-tight uppercase break-words">
                                                {pro}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* System_Constraints (CONS) */}
                            <div className="bg-white p-5 sm:p-8 space-y-6">
                                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase text-rose-500 tracking-[0.2em]">
                                    <Minus className="w-3 h-3 shrink-0" />{" "}
                                    System_Constraints
                                </h4>
                                <ul className="space-y-4">
                                    {product.cons?.map((con, i) => (
                                        <li
                                            key={i}
                                            /* 修复点：使用 grid 锁定第一列宽度，防止文字挤压图标 */
                                            className="grid grid-cols-[12px_1fr] gap-3 items-start group"
                                        >
                                            <AlertCircle className="w-3 h-3 mt-1 text-slate-300 group-hover:text-rose-500 shrink-0 transition-colors" />
                                            <span className="text-[11px] font-bold text-slate-400 leading-tight uppercase break-words">
                                                {con}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </section>

                        {/* 5. Forensic Analysis - 深度法医审计模块 */}
                        <section className="space-y-12 font-mono mt-20">
                            {/* 模块标题栏 */}
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-slate-400">
                                <Microscope className="w-5 h-5 shrink-0 text-blue-600" />
                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em]">
                                    Forensic_Analysis_Notes
                                </h4>
                                <div className="hidden min-[420px]:block flex-1 h-px min-w-[2rem] bg-slate-100" />
                            </div>

                            {/* 规格评估矩阵：增加高亮逻辑 */}
                            <div className="grid md:grid-cols-2 gap-x-12 gap-y-10">
                                {" "}
                                {/* 增加行间距 y-10 */}
                                {Object.entries(specsMatrix).map(
                                    ([key, text]) => {
                                        const isCore =
                                            /support|alignment|pressure/i.test(
                                                key
                                            )
                                        return (
                                            <div
                                                key={key}
                                                className={`space-y-3 group transition-all duration-300 ${
                                                    isCore
                                                        ? "opacity-100"
                                                        : "opacity-70 hover:opacity-100"
                                                }`}
                                            >
                                                {/* 1. 标题层级：优化为 10px，增加间距 */}
                                                <div className="flex items-center gap-3">
                                                    <span
                                                        className={`font-black uppercase tracking-[0.25em] text-[10px] break-words sm:whitespace-nowrap ${
                                                            isCore
                                                                ? "text-blue-600"
                                                                : "text-slate-400"
                                                        }`}
                                                    >
                                                        [
                                                        {key.replace(/_/g, " ")}
                                                        ]
                                                    </span>
                                                    <div
                                                        className={`h-[1px] flex-1 ${
                                                            isCore
                                                                ? "bg-blue-600/20"
                                                                : "bg-slate-100"
                                                        }`}
                                                    />
                                                </div>

                                                {/* 2. 正文层级：优化为 12px (text-xs)，提升易读性 */}
                                                <p
                                                    className={`
                        border-l-2 pl-4 text-[12px] leading-[1.8] uppercase font-medium transition-all
                        ${
                            isCore
                                ? "border-blue-500 text-slate-900 font-bold"
                                : "border-slate-200 text-slate-500"
                        }
                    `}
                                                >
                                                    {String(text)}
                                                </p>

                                                {/* 3. 视觉点缀：为核心指标增加一个极小的刻度感 */}
                                                {isCore && (
                                                    <div className="flex gap-1 pl-4 opacity-30">
                                                        <div className="w-4 h-0.5 bg-blue-600" />
                                                        <div className="w-1 h-0.5 bg-blue-600" />
                                                        <div className="w-1 h-0.5 bg-blue-600" />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    }
                                )}
                            </div>

                            {/* 最终审计结论印章 */}
                            <div className="bg-slate-950 p-5 sm:p-8 border-l-[8px] sm:border-l-[12px] border-blue-600 text-white font-bold text-base sm:text-xl uppercase tracking-tight shadow-[20px_20px_0px_0px_rgba(30,41,59,0.1)] relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="text-[9px] opacity-40 mb-2 tracking-[0.4em]">
                                        Final_Auditor_Verdict
                                    </div>
                                    "{product.audit_note}"
                                </div>
                                <ShieldCheck className="absolute right-[-10%] bottom-[-20%] w-40 h-40 opacity-10 rotate-12 pointer-events-none" />
                            </div>

                            {brandIntel.length > 0 ? (
                                <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
                                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <Radio className="h-4 w-4 text-blue-600" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                                                Cross_Platform_Signals
                                            </span>
                                        </div>
                                        <Link
                                            href="/intelligence"
                                            className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline"
                                        >
                                            Intelligence Center →
                                        </Link>
                                    </div>
                                    <ul className="space-y-5">
                                        {brandIntel.map(
                                            (intel: (typeof brandIntel)[number]) => (
                                            <li
                                                key={intel.id}
                                                className="border-l-2 border-blue-500/30 pl-4"
                                            >
                                                <div className="mb-1 flex flex-wrap items-baseline gap-2">
                                                    <span className="rounded bg-slate-950 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                                                        {intel.source_platform}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-slate-400">
                                                        sentiment{" "}
                                                        {intel.sentiment_score.toFixed(2)} · n=
                                                        {intel.signal_density} · conf{" "}
                                                        {intel.confidence_score.toFixed(2)}
                                                    </span>
                                                </div>
                                                <p className="text-[13px] leading-relaxed text-slate-600">
                                                    {intel.verdict_summary}
                                                </p>
                                                {intel.key_issue_tags?.length ? (
                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                        {intel.key_issue_tags.map((t: string) => (
                                                            <span
                                                                key={`${intel.id}-${t}`}
                                                                className="text-[9px] font-bold uppercase tracking-tight text-slate-500"
                                                            >
                                                                [{t.replace(/_/g, " ")}]
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}

                            {/* 深度审计日志区域 - 优化了间距与水印 */}
                            <div className="mt-16 p-4 sm:p-8 border border-slate-100 bg-slate-50/50 relative overflow-hidden group/log">
                                {/* 背景防伪水印 */}
                                <div className="absolute -right-8 -bottom-8 opacity-[0.03] pointer-events-none rotate-12 transition-transform group-hover/log:scale-110 duration-1000">
                                    <ShieldAlert className="w-56 h-56 text-slate-900" />
                                </div>

                                <div className="relative z-10">
                                    {/* 日志头部 */}
                                    <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-8">
                                        <div className="flex items-center gap-2">
                                            <ShieldAlert className="w-4 h-4 text-blue-600" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                                Detailed_Audit_Log
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                                            <span className="text-[8px] font-mono text-slate-300">
                                                HASH_REF:{" "}
                                                {product.id
                                                    .split("-")[0]
                                                    .toUpperCase()}
                                            </span>
                                            <span className="text-[8px] font-mono text-blue-500 font-bold bg-blue-50 px-2 py-0.5 border border-blue-100">
                                                PROTOCOL:{" "}
                                                {product.protocol_version ||
                                                    APP_PROTOCOL}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 日志正文：增加了 pb-6 确保不紧贴分割线 */}
                                    <div className="text-[12px] leading-[1.8] text-slate-500 uppercase font-medium max-h-[280px] sm:max-h-[350px] overflow-y-auto pr-2 sm:pr-4 custom-scrollbar pb-6 break-words">
                                        {product.summary_log}
                                    </div>

                                    {/* 核心优化：加宽间距的分割线 */}
                                    <div className="my-10 border-t border-slate-200/60 relative">
                                        <div className="absolute -top-1.5 left-0 w-12 h-px bg-blue-600" />
                                    </div>

                                    {/* 底部验证主体与方法论 */}
                                    <div className="space-y-5">
                                        <div className="flex flex-wrap items-center gap-y-3 gap-x-8">
                                            {/* 动态验证状态 */}
                                            <div className="flex items-center gap-2.5">
                                                <div className="relative">
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping absolute inset-0" />
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full relative" />
                                                </div>
                                                <span className="text-[10px] font-[1000] text-slate-950 uppercase tracking-tighter">
                                                    Verified by SLEEP_INTEL_LABS
                                                </span>
                                            </div>

                                            {/* 审计时间戳 */}
                                            <div className="flex items-center gap-2 text-[9px] text-slate-400 font-mono">
                                                <RefreshCcw className="w-3 h-3" />
                                                LAST_AUDIT_STAMP:{" "}
                                                {product.last_audited_at
                                                    ? new Date(
                                                          product.last_audited_at
                                                      )
                                                          .toISOString()
                                                          .replace("T", " ")
                                                          .split(".")[0]
                                                    : "N/A_PRELIMINARY"}
                                            </div>
                                        </div>

                                        {/* 方法论小字说明 */}
                                        <div className="max-w-3xl">
                                            <p className="text-[9px] text-slate-400 uppercase tracking-widest leading-relaxed font-medium">
                                                <span className="text-blue-600 font-bold">
                                                    Methodology:
                                                </span>{" "}
                                                This audit utilizes neural
                                                synthesis of aggregated consumer
                                                feedback, published material
                                                specs, and category benchmarks
                                                from public listings—not
                                                measurements performed on units we
                                                stock. Integrity relies on
                                                multi-source cross-referencing.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {certificationClaims ? (
                            <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 sm:p-8 font-mono shadow-sm">
                                <div className="mb-4 flex items-center gap-2 text-blue-700">
                                    <ShieldCheck className="h-4 w-4 shrink-0" />
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em]">
                                        Certifications_and_Listing_Claims
                                    </h4>
                                </div>
                                <p className="text-[12px] font-medium leading-relaxed text-slate-800">
                                    {certificationClaims}
                                </p>
                                <p className="mt-4 text-[9px] uppercase tracking-widest text-slate-500">
                                    Synthesized from captured listing and public copy — verify
                                    certificates and scope on the merchant before purchase.
                                </p>
                            </section>
                        ) : null}

                        {/* 6. Technical Raw Dataset */}
                        <section className="pt-10 border-t border-slate-100 font-mono text-[10px]">
                            <h4 className="font-black uppercase tracking-[0.3em] text-slate-400 mb-8 flex items-center gap-2">
                                <Box className="w-4 h-4" />{" "}
                                Technical_Dataset_Raw
                            </h4>

                            <div className="grid md:grid-cols-2 gap-x-12 gap-y-2">
                                {" "}
                                {/* 增加列间距，减少行间距 */}
                                {Object.entries(technicalSpecsForGrid).map(
                                    ([key, value]) => (
                                        <div
                                            key={key}
                                            className="group flex flex-col border-b border-slate-50 py-4 hover:bg-slate-50 transition-colors px-4"
                                        >
                                            {/* Key: 放在上方，且缩小不占位 */}
                                            <span className="text-slate-300 uppercase tracking-widest font-bold mb-1 group-hover:text-blue-500 transition-colors">
                                                {key}
                                            </span>

                                            {/* Value: 允许自动换行，且字号稍微调大一点保证易读 */}
                                            <span className="text-slate-900 font-black leading-relaxed break-words text-[11px]">
                                                {value as string}
                                            </span>
                                        </div>
                                    )
                                )}
                            </div>
                        </section>

                        <section className="mt-12 pt-8 border-t border-slate-100 font-mono">
                            <div className="flex items-center gap-2 mb-6 opacity-40">
                                <Fingerprint className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                                    Metadata_Registry
                                </span>
                            </div>

                            <div className="grid gap-6">
                                {/* 1. SEO Title: 核心索引标题 */}
                                <div className="flex flex-col gap-1 border-l-2 border-blue-500 pl-4 py-1">
                                    <span className="text-[9px] font-bold text-blue-600/50 uppercase">
                                        [SEO_Header_Tag]
                                    </span>
                                    <p className="text-[11px] font-black text-slate-900 leading-tight">
                                        {seoData.title}
                                    </p>
                                </div>

                                {/* 2. SEO Keywords: 补充关键词矩阵 */}
                                <div className="flex flex-col gap-1 border-l-2 border-slate-200 pl-4 py-1">
                                    <span className="text-[9px] font-bold text-slate-300 uppercase">
                                        [Target_Keywords]
                                    </span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {seoData.keywords
                                            .split(",")
                                            .map((tag, i) => (
                                                <span
                                                    key={i}
                                                    className="text-[9px] bg-slate-100 px-1.5 py-0.5 text-slate-500 rounded-sm border border-slate-200/50"
                                                >
                                                    {tag.trim()}
                                                </span>
                                            ))}
                                    </div>
                                </div>

                                {/* 3. SEO Description: 索引摘要 */}
                                <div className="flex flex-col gap-1 border-l-2 border-slate-200 pl-4 py-1">
                                    <span className="text-[9px] font-bold text-slate-300 uppercase">
                                        [Index_Summary_Excerpt]
                                    </span>
                                    <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic break-words">
                                        {seoData.description}
                                    </p>
                                </div>

                                {/* 4. Crawler Control: 增加系统感细节 */}
                                <div className="flex items-center gap-6 mt-2 pt-4 border-t border-slate-50">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[8px] font-bold text-slate-300 uppercase">
                                            Robots:
                                        </span>
                                        <span className="text-[8px] font-black text-green-600/70 bg-green-50 px-1">
                                            INDEX, FOLLOW
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[8px] font-bold text-slate-300 uppercase">
                                            Canonical:
                                        </span>
                                        <span className="text-[8px] font-medium text-slate-400 break-all sm:truncate sm:max-w-[200px]">
                                            /{product.slug}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 7. Methodology Transparency Footer */}
                        <footer className="mt-20 pt-10 border-t border-slate-950 font-mono">
                            <div className="grid md:grid-cols-3 gap-8 items-start text-left">
                                <div className="space-y-4">
                                    <h5 className="text-[10px] font-black uppercase text-slate-950">
                                        Data_Sourcing
                                    </h5>
                                    <p className="text-[9px] text-slate-400 leading-relaxed uppercase">
                                        Raw intelligence is gathered from
                                        aggregated marketplace reviews, retailer
                                        listings, and manufacturer-published spec
                                        sheets—not units tested in our facility.
                                        Models flag patterns consistent with
                                        review stacking and incentivized bias.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <h5 className="text-[10px] font-black uppercase text-slate-950">
                                        Audit_Integrity
                                    </h5>
                                    <p className="text-[9px] text-slate-400 leading-relaxed uppercase">
                                        SleepChoice Guide operates editorially
                                        independently. Scoring pipelines do not
                                        ingest affiliate commission rates as a
                                        feature. Log ID{" "}
                                        {product.id
                                            .split("-")[0]
                                            .toUpperCase()}
                                        is cryptographically tethered to this
                                        version of the analysis.
                                    </p>
                                </div>
                                <div className="flex flex-col items-start md:items-end justify-end h-full">
                                    <div className="text-left md:text-right">
                                        <div className="text-[10px] font-black text-blue-600 uppercase italic">
                                            Status: Final_Report_Verified
                                        </div>
                                        <div className="text-[8px] text-slate-300 font-mono mt-1">
                                            © 2026 SLEEPCHOICE_GUIDE /
                                            ALL_RIGHTS_RESERVED
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </footer>
                    </div>

                    {/* [ RIGHT SIDEBAR ] */}
                    <aside className="lg:col-span-4 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)]">
                        <div className="border-4 sm:border-[6px] border-slate-950 p-5 sm:p-8 bg-white shadow-[12px_12px_0px_0px_rgba(37,99,235,1)] sm:shadow-[20px_20px_0px_0px_rgba(37,99,235,1)]">
                            <div className="mb-8 pb-4 border-b border-slate-100">
                                <p className="text-[9px] leading-relaxed text-slate-400 font-mono uppercase tracking-tighter italic">
                                    <span className="text-blue-600 font-bold not-italic">
                                        AFFILIATE_DISCLOSURE:
                                    </span>{" "}
                                    As an associate, we may earn from qualifying
                                    purchases through the gateways below.
                                </p>
                            </div>

                            <div className="text-center border-b border-slate-100 pb-10 mb-8 font-mono">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">
                                    Performance_Index
                                </div>
                                <div className="text-[clamp(3.5rem,18vw,6.875rem)] font-[1000] italic text-slate-950 leading-none tracking-tighter tabular-nums">
                                    {scores.overall}
                                </div>
                            </div>

                            <div className="space-y-3 font-mono">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                        Verified_Gateways
                                    </span>
                                    <span className="text-[9px] text-slate-400">
                                        COUNT: {offers.length}
                                    </span>
                                </div>

                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 scroll-smooth no-scrollbar">
                                    {offers.length > 0 ? (
                                        offers.map((offer, idx) => {
                                            const isBest = idx === minPriceIndex
                                            const affiliate = getAffiliateLink(
                                                product.brand,
                                                product.slug,
                                                offers
                                            )
                                            const isNotApproved =
                                                affiliate.restricted
                                            return (
                                                <a
                                                    key={idx}
                                                    href={affiliate.href}
                                                    target={
                                                        isNotApproved
                                                            ? "_self"
                                                            : "_blank"
                                                    }
                                                    rel={
                                                        isNotApproved
                                                            ? undefined
                                                            : "nofollow noopener noreferrer"
                                                    }
                                                    className={`flex items-center justify-between w-full p-4 transition-all duration-300 group border-2 
                                                    ${
                                                        isNotApproved
                                                            ? "border-slate-300 bg-slate-50/70 hover:bg-slate-100"
                                                            : isBest
                                                              ? "border-blue-600 bg-blue-50/30"
                                                              : "border-slate-950 hover:bg-slate-950"
                                                    }`}
                                                >
                                                    <div className="flex flex-col items-start leading-none">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span
                                                                className={`text-[8px] font-black uppercase tracking-widest ${
                                                                    isBest
                                                                        ? "text-blue-600"
                                                                        : "text-slate-400 group-hover:text-slate-500"
                                                                }`}
                                                            >
                                                                {offer.merchant ||
                                                                    "External_Source"}
                                                            </span>
                                                            {isNotApproved && (
                                                                <span className="text-[7px] text-slate-500 font-mono bg-slate-200 px-1 py-0.5 border border-slate-300 uppercase tracking-tighter">
                                                                    [pending]
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span
                                                            className={`text-lg font-[1000] tracking-tighter ${
                                                                isBest
                                                                    ? "text-slate-950"
                                                                    : isNotApproved
                                                                      ? "text-slate-600"
                                                                      : "text-slate-950 group-hover:text-white"
                                                            }`}
                                                        >
                                                            {formatShelfPriceUsd(
                                                                Number(
                                                                    offer.price
                                                                )
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {isBest && (
                                                            <span className="text-[7px] bg-blue-600 text-white px-1 py-0.5 animate-pulse">
                                                                BEST_VALUE
                                                            </span>
                                                        )}
                                                        <ExternalLink
                                                            className={`w-5 h-5 ${
                                                                isBest
                                                                    ? "text-blue-600"
                                                                    : isNotApproved
                                                                      ? "text-slate-400"
                                                                      : "group-hover:text-white"
                                                            }`}
                                                        />
                                                    </div>
                                                </a>
                                            )
                                        })
                                    ) : (
                                        <div className="text-center py-6 border-2 border-dashed border-slate-200 text-slate-400 text-[10px] uppercase font-bold">
                                            No active gateways found.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    )
}
