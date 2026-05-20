"use client"

import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState
} from "react"
import { cn } from "@/lib/utils"

type OutboundNavContextValue = {
    isNavigating: boolean
    beginNavigation: () => void
    endNavigation: () => void
}

const OutboundNavContext = createContext<OutboundNavContextValue | null>(
    null
)

export function OutboundNavigationProvider({
    children
}: {
    children: React.ReactNode
}) {
    const [pending, setPending] = useState(0)
    const beginNavigation = useCallback(
        () => setPending((n) => n + 1),
        []
    )
    const endNavigation = useCallback(
        () => setPending((n) => Math.max(0, n - 1)),
        []
    )

    const value = useMemo(
        () => ({
            isNavigating: pending > 0,
            beginNavigation,
            endNavigation
        }),
        [pending, beginNavigation, endNavigation]
    )

    return (
        <OutboundNavContext.Provider value={value}>
            <div
                role="status"
                aria-live="polite"
                aria-hidden={!value.isNavigating}
                className={cn(
                    "pointer-events-none fixed inset-x-0 top-0 z-[300] h-0.5 overflow-hidden transition-opacity duration-200",
                    value.isNavigating ? "opacity-100" : "opacity-0"
                )}
            >
                <div className="h-full w-1/3 animate-outbound-bar bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.55)]" />
            </div>
            {children}
        </OutboundNavContext.Provider>
    )
}

export function useOutboundNavigation(): OutboundNavContextValue {
    const ctx = useContext(OutboundNavContext)
    if (!ctx) {
        return {
            isNavigating: false,
            beginNavigation: () => {},
            endNavigation: () => {}
        }
    }
    return ctx
}
