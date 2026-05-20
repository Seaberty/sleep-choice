"use client"

import { useEffect, useRef } from "react"
import { trackGa4Event } from "@/lib/analytics"

type Props = {
    productFocus?: string
    matchCount: number
}

/** Quiz 落地 `/best-picks?quiz=1` 时上报 quiz_complete（每会话一次）。 */
export function QuizCompleteTracker({ productFocus, matchCount }: Props) {
    const fired = useRef(false)

    useEffect(() => {
        if (fired.current) return
        fired.current = true
        trackGa4Event("quiz_complete", {
            product_focus: productFocus ?? "unknown",
            match_count: matchCount
        })
    }, [productFocus, matchCount])

    return null
}
