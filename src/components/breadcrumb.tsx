"use client"

import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"
import { usePathname } from "next/navigation"

interface BreadcrumbItem {
    label: string
    href: string
}

interface BreadcrumbProps {
    items?: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
    const pathname = usePathname()
    
    // Auto-generate breadcrumbs from pathname if items not provided
    const breadcrumbItems: BreadcrumbItem[] = items || (() => {
        const paths = pathname.split("/").filter(Boolean)
        const result: BreadcrumbItem[] = [{ label: "Home", href: "/" }]
        
        let currentPath = ""
        paths.forEach((path, index) => {
            currentPath += `/${path}`
            const label = path
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ")
            result.push({ label, href: currentPath })
        })
        
        return result
    })()

    // Generate structured data for breadcrumbs
    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.label,
            item: `https://sleepchoiceguide.com${item.href}`
        }))
    }

    if (breadcrumbItems.length <= 1) return null

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(breadcrumbSchema)
                }}
            />
            <nav
                aria-label="Breadcrumb"
                className="container mx-auto px-6 py-4"
            >
                <ol className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    {breadcrumbItems.map((item, index) => {
                        const isLast = index === breadcrumbItems.length - 1
                        return (
                            <li key={item.href} className="flex items-center gap-2">
                                {index === 0 ? (
                                    <Link
                                        href={item.href}
                                        className="hover:text-blue-600 transition-colors flex items-center gap-1"
                                        aria-label="Home"
                                    >
                                        <Home className="w-4 h-4" />
                                    </Link>
                                ) : (
                                    <>
                                        <ChevronRight className="w-4 h-4 text-slate-400" />
                                        {isLast ? (
                                            <span className="text-slate-900 font-black uppercase tracking-tight">
                                                {item.label}
                                            </span>
                                        ) : (
                                            <Link
                                                href={item.href}
                                                className="hover:text-blue-600 transition-colors uppercase tracking-tight"
                                            >
                                                {item.label}
                                            </Link>
                                        )}
                                    </>
                                )}
                            </li>
                        )
                    })}
                </ol>
            </nav>
        </>
    )
}


