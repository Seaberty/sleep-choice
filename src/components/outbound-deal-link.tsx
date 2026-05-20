"use client"

import React, { useCallback, useState } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { prefetchOutboundDeal } from "@/lib/go-redirect"
import { useOutboundNavigation } from "@/components/outbound-navigation"

type OutboundDealLinkProps = React.ComponentPropsWithoutRef<"a"> & {
    href: string
    /**
     * inline — spinner in link content (compact CTAs)
     * overlay — dim card + centered spinner (product / deals cards)
     * none — global top bar only
     */
    loadingVariant?: "inline" | "overlay" | "none"
}

const NEW_TAB_LOADING_MS = 500

function opensInNewTab(target: string | undefined): boolean {
    return target === "_blank" || target?.toLowerCase() === "_blank"
}

function isModifiedClick(e: React.MouseEvent<HTMLAnchorElement>): boolean {
    return (
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
    )
}

export function OutboundDealLink({
    href,
    className,
    children,
    onClick,
    onMouseEnter,
    onFocus,
    loadingVariant = "inline",
    target = "_blank",
    rel = "nofollow sponsored",
    ...rest
}: OutboundDealLinkProps) {
    const { beginNavigation, endNavigation } = useOutboundNavigation()
    const [loading, setLoading] = useState(false)

    const clearLoading = useCallback(() => {
        setLoading(false)
        endNavigation()
    }, [endNavigation])

    const warmPrefetch = useCallback(() => {
        prefetchOutboundDeal(href)
    }, [href])

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (loading) {
            e.preventDefault()
            return
        }

        if (isModifiedClick(e)) {
            onClick?.(e)
            return
        }

        onClick?.(e)
        if (e.defaultPrevented) return

        if (!href?.trim()) {
            e.preventDefault()
            return
        }

        setLoading(true)
        beginNavigation()

        const newTab = opensInNewTab(target)

        if (newTab) {
            // 不 preventDefault：交给原生 <a target="_blank">，避免 window.open 被拦截
            try {
                /* 浏览器在本轮点击中打开新标签 */
            } finally {
                window.setTimeout(() => clearLoading(), NEW_TAB_LOADING_MS)
            }
            return
        }

        e.preventDefault()
        try {
            window.location.href = href
        } catch {
            try {
                window.location.assign(href)
            } catch {
                /* ignore */
            }
        } finally {
            clearLoading()
        }
    }

    return (
        <a
            href={href}
            target={target}
            rel={rel}
            aria-busy={loading || undefined}
            className={cn(
                className,
                loadingVariant === "overlay" && "relative",
                loading && "pointer-events-none cursor-wait",
                loading &&
                    loadingVariant === "overlay" &&
                    "opacity-90"
            )}
            onMouseEnter={(e) => {
                warmPrefetch()
                onMouseEnter?.(e)
            }}
            onFocus={(e) => {
                warmPrefetch()
                onFocus?.(e)
            }}
            onClick={handleClick}
            {...rest}
        >
            {children}
            {loading && loadingVariant === "overlay" ? (
                <span
                    className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-slate-950/35 backdrop-blur-[1px]"
                    aria-hidden
                >
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                </span>
            ) : null}
            {loading && loadingVariant === "inline" ? (
                <span className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-[inherit] bg-inherit/80">
                    <Loader2
                        className="h-4 w-4 shrink-0 animate-spin"
                        aria-hidden
                    />
                </span>
            ) : null}
        </a>
    )
}
