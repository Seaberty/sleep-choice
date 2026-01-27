import { promises as fs } from "fs"
import path from "path"
import { ProductData, ProductRegistry, AuditScores, Offer } from "@/types/product"
import { supabase } from "./supabase"
import { cache } from "react"

const REGISTRY_PATH = path.join(process.cwd(), "data/registry.json")
/**
 * 优化后的自动化注册表获取逻辑
 * 策略：DB 提供实时审计分值和状态，Local JSON 提供运营文案、SEO 和人工校准
 */
export const getAutomatedRegistry = cache(async (): Promise<ProductData[]> => {
    try {
        // 1. 并行读取：数据库(实时) + 本地(运营补丁)
        // 使用 Promise.race 增加 3s 超时保护
        const [dbResult, localRegistry] = await Promise.all([
            Promise.race([
                supabase
                    .from("audit_products")
                    .select("*")
                    .order("audit_scores->>overall", { ascending: false })
                    .limit(12),
                new Promise((_, reject) =>
                    setTimeout(
                        () => reject(new Error("Supabase Timeout")),
                        3000
                    )
                )
            ]) as Promise<{ data: any[] | null; error: any }>,
            getRegistry()
        ])

        const { data: dbProducts, error } = dbResult

        // 2. 降级逻辑：如果数据库不可用，回退到本地缓存的所有产品
        if (error || !dbProducts) {
            console.warn(
                "⚠️ Database unavailable, falling back to local registry."
            )
            return Object.values(localRegistry.products || {})
        }

        // 3. 数据融合 (Fusion)
        return dbProducts.map((item: any): ProductData => {
            const slug = item.slug || ""
            // 获取本地运营配置（如有）
            const localMeta = localRegistry.products[slug] || {}

            // 构造符合 2.0 规范的评分对象
            const scores: AuditScores = {
                overall: Number(item.audit_scores?.overall) || 0,
                support: Number(item.audit_scores?.support) || 0,
                cooling: Number(item.audit_scores?.cooling) || 0,
                pressure: Number(item.audit_scores?.pressure) || 0,
                ...(item.audit_scores || {}) // 允许动态扩展
            }

            // 构造 Offer 对象
            const defaultOffer: Offer = {
                site: "Official Store",
                price: Number(item.price) || 0,
                url:
                    item.affiliate_link ||
                    `https://link.sleepchoice.com/${slug}`,
                primary: true,
                promo: "LATEST_DEAL",
                promo_text: "Check Latest Price",
                is_best_deal: true // 👈 补全这个必填字段
            }

            return {
                // --- 基础标识 ---
                id: String(item.id || ""),
                slug: slug,
                brand: String(item.brand || ""),
                name: String(item.model || ""),
                model: String(item.model || ""),
                category:
                    item.category || localMeta.category || "Laboratory Audit",

                // --- 价格与状态 ---
                price:
                    Number(item.technical_specs?.price) || localMeta.price || 0,
                price_range: localMeta.price_range || "$0-$9999",
                rating: scores.overall,
                tag:
                    localMeta.tag ||
                    (scores.overall >= 9.5 ? "Best Overall" : item.category),
                isBestSeller: scores.overall >= 9.5,
                is_verified: item.status === "verified",

                // --- 2.0 审计核心数据 ---
                audit_id: String(item.id || ""),
                audit_status:
                    (item.status as any) || localMeta.audit_status || "pending",
                audit_scores: scores,

                pros: item.pros || localMeta.pros || ["Lab Verified Material"],
                cons: localMeta.cons || [],

                // --- 视觉资产 ---
                image_url:
                    item.image_url ||
                    localMeta.image_url ||
                    "/placeholder-mattress.jpg",
                gallery: localMeta.gallery || [],

                // --- 商务与元数据 ---
                offers: localMeta.offers || [defaultOffer],
                last_audited_at: item.updated_at || new Date().toISOString(),

                // SEO
                meta: {
                    title:
                        localMeta.meta?.title ||
                        `${item.brand} ${item.model} Review`,
                    description:
                        localMeta.meta?.description ||
                        `In-depth lab test results for ${item.model}.`
                },
                // --- 补全缺失的必填字段 ---
                currency: item.currency || "USD",
                metrics: item.metrics || localMeta.metrics || {},
                protocol_version: "2026.1", // 或者是 item.protocol_version
                audit_note: item.audit_note || "Standard automated audit",
                summary_log: item.summary_log || [], // 通常是一个数组
                audit_data: item.audit_data || {
                    checked_at: new Date().toISOString(),
                    inspector: "Automated System"
                },
                technical_specs:
                    item.technical_specs || localMeta.technical_specs || {}
            }
        })
    } catch (e) {
        console.error("❌ Critical Failure in getAutomatedRegistry:", e)
        return []
    }
})

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
