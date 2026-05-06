// next-sitemap.config.js
/** @type {import('next-sitemap').IConfig} */
module.exports = {
    siteUrl: 'https://sleepchoiceguide.com', // 你的域名
    generateRobotsTxt: true, // 必须开启，省去手动维护 robots.txt
    generateIndexSitemap: false,
    sitemapSize: 7000,
    changefreq: 'daily', // 告诉 Google 我们每天都在监控价格
    priority: 0.7,

    // 排除不需要被抓取的路径
    exclude: ['/server-sitemap.xml'],

    // 针对不同路径设置不同的抓取策略
    robotsTxtOptions: {
        policies: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/*', '/admin/*'], // 保护你的自动化接口
            },
        ]
    },
}