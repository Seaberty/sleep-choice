import { promises as fs } from "fs"
import path from "path"
import {
    ProductData,
    ProductRegistry,
    AuditScores,
    Offer
} from "@/types/product"
import { supabase } from "./supabase"
import { APP_PROTOCOL } from "./constants"
import { isListableAuditProduct } from "./audit-list-eligibility"
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

const PRODUCT_OFFERS_SELECT = `
                *,
                product_offers (
                    offer_url, price, promo_text, is_primary, status, site_name
                )
            `

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

    const defaultOffer: Offer = {
        site: dbOffer?.site_name || "Official Store",
        price:
            Number(dbOffer?.price || item.price || localMeta.price) || 0,
        url:
            dbOffer?.offer_url ||
            item.affiliate_link ||
            `https://link.sleepchoice.com/${slug}`,
        primary: true,
        promo: "LATEST_DEAL",
        promo_text: dbOffer?.promo_text || "Check Latest Price",
        is_best_deal: true
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
        last_audited_at: item.updated_at || new Date().toISOString(),
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
