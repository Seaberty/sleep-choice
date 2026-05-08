"use client"

import * as React from "react"
import {
    motion,
    AnimatePresence,
    useScroll,
    useMotionValueEvent
} from "framer-motion"
import { ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

const SHOW_AFTER_PX = 380

export function ScrollToTop() {
    const [visible, setVisible] = React.useState(false)
    const { scrollY } = useScroll()

    useMotionValueEvent(scrollY, "change", (latest) => {
        setVisible(latest > SHOW_AFTER_PX)
    })

    return (
        <AnimatePresence>
            {visible && (
                <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.92, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 10 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => {
                        window.scrollTo({ top: 0, behavior: "smooth" })
                    }}
                    className={cn(
                        "fixed bottom-6 right-5 md:bottom-8 md:right-8 z-[95]",
                        "flex h-11 w-11 items-center justify-center rounded-xl",
                        "border border-slate-200 bg-white/95 shadow-lg backdrop-blur-md",
                        "text-slate-700 hover:bg-slate-950 hover:text-white hover:border-slate-950",
                        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                    )}
                    aria-label="Scroll to top"
                >
                    <ChevronUp className="h-5 w-5" strokeWidth={2.5} />
                </motion.button>
            )}
        </AnimatePresence>
    )
}
