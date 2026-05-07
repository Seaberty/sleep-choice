import { promises as fs } from "fs"
import path from "path"
import {
    ProductData,
    ProductRegistry,
    AuditScores,
    Offer
} from "@/types/product"
import { supabase } from "./supabase"
import { cache } from "react"

const REGISTRY_PATH = path.join(process.cwd(), "src/data/registry.json")
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
                        .select(
                            `
                *,
                product_offers (
                    offer_url, price, promo_text, is_primary, status, site_name
                )
            `
                        )
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
                return Object.values(localRegistry.products || {})
            }

            return dbProducts.map((item: any): ProductData => {
                const slug = item.slug || ""
                const localMeta = localRegistry.products[slug] || {}
                const dbOffer = item.product_offers?.[0]

                // 1. 评分逻辑
                const scores: AuditScores = {
                    overall: Number(item.audit_scores?.overall) || 0,
                    support: Number(item.audit_scores?.support) || 0,
                    cooling: Number(item.audit_scores?.cooling) || 0,
                    pressure: Number(item.audit_scores?.pressure) || 0,
                    ...(item.audit_scores || {})
                }

                // 2. 核心修复：确保 Pros/Cons 优先级
                // 策略：如果本地 JSON 有精心写的 pros，优先用本地的；否则用 DB 的；最后保底。
                const finalPros =
                    localMeta.pros?.length > 0
                        ? localMeta.pros
                        : item.pros?.length > 0
                          ? item.pros
                          : ["Lab Verified Material", "Premium Construction"]

                const finalCons =
                    localMeta.cons?.length > 0
                        ? localMeta.cons
                        : item.cons || []

                const auditDataRaw = item.audit_data
                let auditHash: string | undefined
                if (
                    auditDataRaw &&
                    typeof auditDataRaw === "object" &&
                    "audit_hash" in auditDataRaw
                ) {
                    auditHash = String(
                        (auditDataRaw as { audit_hash?: string }).audit_hash ||
                            ""
                    ).trim()
                } else if (typeof auditDataRaw === "string") {
                    try {
                        const parsed = JSON.parse(auditDataRaw)
                        if (parsed?.audit_hash)
                            auditHash = String(parsed.audit_hash).trim()
                    } catch {
                        /* ignore */
                    }
                }

                // 3. Offer 逻辑
                const defaultOffer: Offer = {
                    site: dbOffer?.site_name || "Official Store",
                    price:
                        Number(
                            dbOffer?.price || item.price || localMeta.price
                        ) || 0,
                    url:
                        dbOffer?.offer_url ||
                        item.affiliate_link ||
                        `https://link.sleepchoice.com/${slug}`,
                    primary: true,
                    promo: "LATEST_DEAL",
                    promo_text: dbOffer?.promo_text || "Check Latest Price",
                    is_best_deal: true
                }

                // 4. 返回完整对象
                return {
                    ...localMeta, // 基础 UI 配置
                    id: String(item.id),
                    slug,
                    brand: item.brand || localMeta.brand,
                    name: item.model || localMeta.name,
                    image_url:
                        item.image_url ||
                        localMeta.image_url ||
                        item.original_image_url ||
                        "/placeholder-product.png",
                    original_image_url:
                        item.original_image_url || localMeta.original_image_url,

                    // 覆盖关键数据
                    price: defaultOffer.price,
                    rating: scores.overall,
                    audit_scores: scores,
                    offers: [defaultOffer],
                    pros: finalPros, // ✨ 确保这里被赋值
                    cons: finalCons, // ✨ 确保这里被赋值
                    // 补全必填
                    protocol_version: "2026.1",
                    last_audited_at: item.updated_at || new Date().toISOString(),
                    ...(auditHash ? { audit_hash: auditHash } : {}),
                    ...(typeof item.review_count === "number"
                        ? { review_count: item.review_count }
                        : {})
                } as ProductData
            })
        } catch (e) {
            console.error("❌ Critical Failure:", e)
            return []
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
