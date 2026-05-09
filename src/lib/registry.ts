import { promises as fs } from "fs"
import path from "path"
import {
    ProductData,
    ProductRegistry,
    AuditScores,
    Offer,
    ForensicAuditData
} from "@/types/product"
import { supabase } from "./supabase"
import { APP_PROTOCOL } from "./constants"
import { isListableAuditProduct } from "./audit-list-eligibility"
import { merchantPriceAfterSiteStack } from "@/lib/deals-utils"
import { cache } from "react"

const REGISTRY_PATH = path.join(process.cwd(), "src/data/registry.json")

function normalizeQuizTags(raw: unknown): string[] {
    if (Array.isArray(raw))
        return raw.map(String).map((t) => t.trim()).filter(Boolean)
    if (typeof raw === "string") {
        try {
            const j = JSON.parse(raw)
            if (Array.isArray(j)) return j.map(String).map((t) => String(t).trim())
        } catch {
            return raw
                .split(/[,|]/)
                .map((t) => t.trim())
                .filter(Boolean)
        }
    }
    return []
}

/** 嵌套用 `*`：避免请求库里尚未迁移的列名导致整条 select 失败（全站 registry 空白）。 */
const PRODUCT_OFFERS_SELECT = `
                *,
                product_offers (*)
            `

function parseTechnicalSpecs(raw: unknown): Record<string, string> {
    if (!raw) return {}
    if (typeof raw === "string") {
        try {
            const p = JSON.parse(raw)
            return typeof p === "object" && p !== null ? (p as Record<string, string>) : {}
        } catch {
            return {}
        }
    }
    if (typeof raw === "object") return raw as Record<string, string>
    return {}
}

function parseAuditDataPartial(
    raw: unknown
): Partial<ForensicAuditData> & {
    specs_matrix?: Record<string, string>
} {
    if (!raw) return {}
    const obj =
        typeof raw === "string"
            ? (() => {
                  try {
                      return JSON.parse(raw)
                  } catch {
                      return {}
                  }
              })()
            : raw
    if (typeof obj !== "object" || !obj) return {}
    return obj as Partial<ForensicAuditData> & {
        specs_matrix?: Record<string, string>
    }
}

function positiveMoney(value: unknown): number | undefined {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) return undefined
    return n
}

/** 版面促销词，勿当作优惠码（与 forensic_engine COUPON_DENYLIST 对齐） */
const COUPON_WORD_DENY = new Set([
    "HOURS",
    "TODAY",
    "TONIGHT",
    "NIGHT",
    "NIGHTS",
    "DAYS",
    "DAY",
    "WEEKS",
    "WEEK",
    "ORDER",
    "ORDERS",
    "SHIPPING",
    "STORE",
    "STORES",
    "SHOP",
    "FREE",
    "SAVE",
    "SALE",
    "DEALS",
    "DEAL",
    "LIMITED",
    "SPRING",
    "SUMMER",
    "TIME",
    "LEFT",
    "OFF",
    "VIP",
    "SLEEP",
    "REST",
    "BED"
])

/**
 * 从 promo 文案中提取优惠码：优先「字母+数字」形态（如 MOM15），避免首词命中 HOURS 等噪声。
 */
function extractCouponFromPromo(
    promoText: string | undefined | null
): string | null {
    if (promoText == null || typeof promoText !== "string") return null
    const normalized = promoText.toUpperCase()
    const digitFirst = normalized.match(/\b([A-Z]{2,}\d{2,}[A-Z0-9]*)\b/)
    if (digitFirst) {
        const w = digitFirst[1]
        if (
            !COUPON_WORD_DENY.has(w) &&
            w.length >= 4 &&
            w.length <= 14
        ) {
            return w
        }
    }
    const re = /\b[A-Z0-9]{4,14}\b/g
    let m: RegExpExecArray | null
    while ((m = re.exec(normalized)) !== null) {
        const w = m[0]
        if (COUPON_WORD_DENY.has(w)) continue
        if (/^\d+$/.test(w)) continue
        if (/^[A-Z]+$/.test(w) && w.length <= 6) continue
        return w
    }
    return null
}

function isPlausibleCouponCode(code: string | null | undefined): boolean {
    if (code == null || typeof code !== "string" || !code.trim()) return false
    const u = code
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
    if (u.length < 4 || u.length > 16) return false
    if (COUPON_WORD_DENY.has(u)) return false
    if (/^[A-Z]+$/.test(u) && u.length <= 6) return false
    return true
}

/** DB / promo 合并；噪声码丢弃；无默认品牌码（须爬虫/库里有真实记录） */
function resolveCouponCode(
    fromRow: string | null,
    fromPromo: string | null
): string | null {
    const prefer = (c: string | null | undefined) =>
        c && isPlausibleCouponCode(c) ? c.trim().toUpperCase() : null
    return prefer(fromRow) ?? prefer(fromPromo) ?? null
}

function mergeAuditProductRow(
    item: any,
    localRegistry: ProductRegistry
): ProductData {
    const slug = item.slug || ""
    const localMeta = localRegistry.products[slug] || {}
    const offersArr = Array.isArray(item.product_offers)
        ? item.product_offers
        : []
    const dbOffer =
        offersArr.find(
            (o: { is_primary?: boolean; status?: string }) =>
                o.is_primary && o.status === "active"
        ) || offersArr[0]

    const scores: AuditScores = {
        overall: Number(item.audit_scores?.overall) || 0,
        support: Number(item.audit_scores?.support) || 0,
        cooling: Number(item.audit_scores?.cooling) || 0,
        pressure: Number(item.audit_scores?.pressure) || 0,
        ...(item.audit_scores || {})
    }

    const finalPros =
        localMeta.pros?.length > 0
            ? localMeta.pros
            : item.pros?.length > 0
              ? item.pros
              : ["Lab Verified Material", "Premium Construction"]

    const finalCons =
        localMeta.cons?.length > 0 ? localMeta.cons : item.cons || []

    const auditDataRaw = item.audit_data
    let auditHash: string | undefined
    if (
        auditDataRaw &&
        typeof auditDataRaw === "object" &&
        "audit_hash" in auditDataRaw
    ) {
        auditHash = String(
            (auditDataRaw as { audit_hash?: string }).audit_hash || ""
        ).trim()
    } else if (typeof auditDataRaw === "string") {
        try {
            const parsed = JSON.parse(auditDataRaw)
            if (parsed?.audit_hash) auditHash = String(parsed.audit_hash).trim()
        } catch {
            /* ignore */
        }
    }

    const localAudit = parseAuditDataPartial(localMeta.audit_data)
    const dbAudit = parseAuditDataPartial(item.audit_data)
    const mergedSpecsMatrix = {
        ...(typeof localAudit.specs_matrix === "object"
            ? localAudit.specs_matrix
            : {}),
        ...(typeof dbAudit.specs_matrix === "object" ? dbAudit.specs_matrix : {})
    } as ForensicAuditData["specs_matrix"]

    const msrpColumn = positiveMoney(item.msrp)
    const msrpFromAuditJson =
        Number(dbAudit.msrp ?? localAudit.msrp ?? 0) || 0

    const mergedAuditVariant = (
        dbAudit.audit_variant ??
        localAudit.audit_variant ??
        ""
    ).trim()

    const mergedAuditData: ForensicAuditData = {
        msrp: msrpColumn ?? msrpFromAuditJson,
        specs_matrix: mergedSpecsMatrix,
        arbitrage_report: String(
            dbAudit.arbitrage_report ?? localAudit.arbitrage_report ?? ""
        ),
        ...(auditHash ||
        dbAudit.audit_hash ||
        localAudit.audit_hash
            ? {
                  audit_hash: String(
                      auditHash ||
                          dbAudit.audit_hash ||
                          localAudit.audit_hash ||
                          ""
                  ).trim()
              }
            : {}),
        ...(mergedAuditVariant ? { audit_variant: mergedAuditVariant } : {})
    }

    const promoText = dbOffer?.promo_text || "Check Latest Price"
    const merchantListPrice =
        Number(dbOffer?.price || item.price || localMeta.price) || 0
    const stackPctSource = (
        dbOffer as { promo_discount_percent?: number } | null | undefined
    )?.promo_discount_percent
    const priceNum = merchantPriceAfterSiteStack(
        merchantListPrice,
        item.brand || localMeta.brand,
        stackPctSource
    )

    /** 官方原价：优先 audit_products.msrp，其次 product_offers.old_price */
    const msrpFromProductRow = positiveMoney(item.msrp)
    const oldFromOffer = positiveMoney(
        dbOffer?.old_price ?? dbOffer?.oldPrice
    )
    const resolvedOldPrice = msrpFromProductRow ?? oldFromOffer

    let savingsAmount: number | null = null
    let savingsPercent: number | null = null
    if (
        resolvedOldPrice !== undefined &&
        resolvedOldPrice > priceNum
    ) {
        savingsAmount = resolvedOldPrice - priceNum
        savingsPercent = Math.round((savingsAmount / resolvedOldPrice) * 100)
    }

    const couponFromRow =
        typeof dbOffer?.coupon_code === "string" && dbOffer.coupon_code.trim()
            ? dbOffer.coupon_code.trim().toUpperCase()
            : null
    const couponFromPromo = extractCouponFromPromo(promoText)
    const couponCode = resolveCouponCode(couponFromRow, couponFromPromo)

    const defaultOffer: Offer = {
        site: dbOffer?.site_name || "Official Store",
        price: priceNum,
        url:
            dbOffer?.offer_url ||
            item.affiliate_link ||
            `https://link.sleepchoice.com/${slug}`,
        primary: true,
        promo: "LATEST_DEAL",
        promo_text: promoText,
        is_best_deal: true,
        ...(resolvedOldPrice !== undefined ? { oldPrice: resolvedOldPrice } : {}),
        savingsAmount,
        savingsPercent,
        couponCode,
        availability: (() => {
            const a = dbOffer?.availability
            if (a == null || a === "") return null
            const s = String(a).trim()
            return s || null
        })()
    }

    return {
        ...localMeta,
        id: String(item.id),
        slug,
        brand: item.brand || localMeta.brand,
        name: item.model || localMeta.name,
        model: item.model || localMeta.model || "",
        // Supabase 可无 category / quiz_tags；货架与标签由 quiz-results 用 slug·型号·分数推断
        category: item.category ?? localMeta.category ?? "",
        audit_note: item.audit_note ?? localMeta.audit_note ?? "",
        summary_log: String(item.summary_log ?? localMeta.summary_log ?? ""),
        audit_data: mergedAuditData,
        technical_specs: {
            ...parseTechnicalSpecs(localMeta.technical_specs),
            ...parseTechnicalSpecs(item.technical_specs)
        },
        quiz_tags: normalizeQuizTags(item.quiz_tags),
        image_url:
            item.image_url ||
            localMeta.image_url ||
            item.original_image_url ||
            "/placeholder-product.png",
        original_image_url:
            item.original_image_url || localMeta.original_image_url,

        price: defaultOffer.price,
        rating: scores.overall,
        audit_scores: scores,
        offers: [defaultOffer],
        pros: finalPros,
        cons: finalCons,
        protocol_version: APP_PROTOCOL,
        last_audited_at:
            (typeof item.last_audited_at === "string" &&
                item.last_audited_at.trim()) ||
            item.updated_at ||
            new Date().toISOString(),
        ...(auditHash ? { audit_hash: auditHash } : {}),
        ...(typeof item.review_count === "number"
            ? { review_count: item.review_count }
            : {})
    } as ProductData
}

/**
 * 按 slug 或数据库 id 取单条产品（Journal、sitemap 对应 URL 需与归档列表一致）。
 */
export const getProductBySlugOrId = cache(
    async (slugOrId: string): Promise<ProductData | null> => {
        const key = slugOrId.trim()
        if (!key) return null

        const localRegistry = await getRegistry()

        const { data: bySlug } = await supabase
            .from("audit_products")
            .select(PRODUCT_OFFERS_SELECT)
            .eq("slug", key)
            .maybeSingle()

        const item =
            bySlug ||
            (
                await supabase
                    .from("audit_products")
                    .select(PRODUCT_OFFERS_SELECT)
                    .eq("id", key)
                    .maybeSingle()
            ).data

        if (!item) return null

        const mapped = mergeAuditProductRow(item, localRegistry)
        return isListableAuditProduct(mapped) ? mapped : null
    }
)

/**
 * 法医对比矩阵：按 slug 批量拉取（最多 4 条）。
 * 不过滤 listable，便于对比仅有评分、暂缺主图的条目。
 */
export const getProductsForCompare = cache(
    async (slugs: string[]): Promise<ProductData[]> => {
        const unique = [
            ...new Set(slugs.map((s) => String(s).trim()).filter(Boolean))
        ].slice(0, 4)
        if (unique.length === 0) return []

        const localRegistry = await getRegistry()
        const { data, error } = await supabase
            .from("audit_products")
            .select(PRODUCT_OFFERS_SELECT)
            .in("slug", unique)

        if (error || !data?.length) return []

        const mapped: ProductData[] = data.map((item: unknown) =>
            mergeAuditProductRow(item as any, localRegistry)
        )
        const order = new Map(unique.map((s, i) => [s, i]))
        return mapped.sort(
            (a, b) =>
                (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99)
        )
    }
)

/**
 * 优化后的自动化注册表获取逻辑
 * 策略：DB 提供实时审计分值和状态，Local JSON 提供运营文案、SEO 和人工校准
 */
export const getAutomatedRegistry = cache(
    async (limit: number = 12): Promise<ProductData[]> => {
        try {
            const [dbResult, localRegistry] = await Promise.all([
                Promise.race([
                    supabase
                        .from("audit_products")
                        .select(PRODUCT_OFFERS_SELECT)
                        // ✨ 核心优化 1：排除价格为 0 或空的数据
                        .gt("price", 0)
                        // ✨ 核心优化 2：排除使用占位图的数据
                        .not("image_url", "is", null)
                        .not("image_url", "eq", "/placeholder-product.png")
                        // ✨ 核心优化 3：确保关联的 Offer 也是激活状态
                        .eq("product_offers.is_primary", true)
                        .eq("product_offers.status", "active")
                        // 按评分倒序，确保最优质的排在最前面
                        .order("audit_scores->>overall", { ascending: false })
                        .limit(limit),
                    new Promise((_, reject) =>
                        setTimeout(
                            () => reject(new Error("Supabase Timeout")),
                            15000
                        )
                    )
                ]) as Promise<{ data: any[] | null; error: any }>,
                getRegistry()
            ])

            const { data: dbProducts, error } = dbResult

            if (error || !dbProducts) {
                return Object.values(localRegistry.products || {}).filter(
                    isListableAuditProduct
                )
            }

            return dbProducts
                .map((item: any) => mergeAuditProductRow(item, localRegistry))
                .filter(isListableAuditProduct)
        } catch (e) {
            console.error("❌ Critical Failure:", e)
            return []
        }
    }
)

/**
 * Quiz 结果页：拉取更广 SKU（枕头、浴袍等），按更新时间而非仅总分排序，避免只剩床垫。
 */
export const getQuizProductCatalog = cache(
    async (): Promise<ProductData[]> => {
        try {
            const [dbResult, localRegistry] = await Promise.all([
                supabase
                    .from("audit_products")
                    .select(PRODUCT_OFFERS_SELECT)
                    .gt("price", 0)
                    .not("image_url", "is", null)
                    .not("image_url", "eq", "/placeholder-product.png")
                    .eq("product_offers.is_primary", true)
                    .eq("product_offers.status", "active")
                    .order("updated_at", { ascending: false })
                    .limit(120),
                getRegistry()
            ])

            const { data: dbProducts, error } = dbResult

            if (error || !dbProducts?.length) {
                return await getAutomatedRegistry(80)
            }

            return dbProducts
                .map((item: any) => mergeAuditProductRow(item, localRegistry))
                .filter(isListableAuditProduct)
        } catch (e) {
            console.error("getQuizProductCatalog:", e)
            return await getAutomatedRegistry(80)
        }
    }
)

/**
 * 获取本地 JSON 注册表
 */
export async function getRegistry(): Promise<ProductRegistry> {
    try {
        const fileContent = await fs.readFile(REGISTRY_PATH, "utf8")
        return JSON.parse(fileContent)
    } catch (error) {
        // console.error("Reading registry.json failed, using empty state.")
        return {
            last_updated: new Date().toISOString(),
            version: "2.0.0",
            products: {}
        }
    }
}
