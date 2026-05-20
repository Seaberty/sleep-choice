"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ComponentProps } from "react"

type Props = ComponentProps<typeof Link>

/** Internal link to `/registry/[slug]` with viewport + hover prefetch */
export function RegistryDetailLink({ href, onMouseEnter, onFocus, ...rest }: Props) {
    const router = useRouter()
    const path =
        typeof href === "string"
            ? href
            : typeof href === "object" && href && "pathname" in href
              ? String(href.pathname ?? "")
              : ""

    const warm = () => {
        if (path.startsWith("/registry/")) {
            router.prefetch(path)
        }
    }

    return (
        <Link
            href={href}
            prefetch
            onMouseEnter={(e) => {
                warm()
                onMouseEnter?.(e)
            }}
            onFocus={(e) => {
                warm()
                onFocus?.(e)
            }}
            {...rest}
        />
    )
}
