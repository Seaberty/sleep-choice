/** @type {import('next').NextConfig} */
const nextConfig = {
    // 开启精简输出，减小包体积，Vercel 部署推荐
    output: "standalone",

    images: {
        formats: ["image/avif", "image/webp"],
        // 图片缓存策略：设置为 1 年，提升 LCP 评分
        minimumCacheTTL: 31536000,

        // 核心修复点：数组内直接放对象，不要再次嵌套 remotePatterns 键
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**.supabase.co"
            },
            {
                protocol: "https",
                hostname: "**.saatva.com"
            },
            {
                protocol: "https",
                hostname: "helixsleep.com"
            }
        ]
    },

    experimental: {
        // 优化 CSS 注入，提升白帽站点的 FCP 速度
        optimizeCss: true,
        scrollRestoration: true
    },

    async headers() {
        return [
            {
                // 全局缓存控制策略：配合 ISR 使用，达到极致性能
                source: "/(.*)",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, s-maxage=3600, stale-while-revalidate=59"
                    }
                ]
            }
        ]
    },

    // 建议增加：白帽站常用的联盟链接中转
    async redirects() {
        return [
            {
                source: "/go/:slug",
                destination: "https://link.sleepchoice.com/:slug", // 替换为你的中转逻辑
                permanent: false
            }
        ]
    }
}

module.exports = nextConfig
