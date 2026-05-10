"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    motion,
    AnimatePresence,
    useScroll,
    useMotionValueEvent
} from "framer-motion"
import {
    ShieldCheck,
    Activity,
    Cpu,
    Terminal,
    Hash,
    Menu,
    X,
    ArrowRight,
    Command,
    Database,
    ChevronRight,
    Search
} from "lucide-react"
// Info icon removed because unused
import { cn } from "@/lib/utils"
import type { SiteHeaderMetrics } from "@/lib/site-metrics"

export function SiteHeader({ metrics }: { metrics: SiteHeaderMetrics }) {
    const pathname = usePathname()
    const [isScrolled, setIsScrolled] = React.useState(false)
    const [hasHydrated, setHasHydrated] = React.useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
    const { scrollY } = useScroll()

    React.useEffect(() => {
        setHasHydrated(true)
    }, [])

    useMotionValueEvent(scrollY, "change", (latest) => {
        setIsScrolled(latest > 20)
    })

    /** Until hydrated, keep trust strip visible so SSR matches client (scroll restore / motion differ). */
    const trustStripVisible = !hasHydrated || !isScrolled

    React.useEffect(() => {
        setIsMobileMenuOpen(false)
    }, [pathname])

    React.useEffect(() => {
        document.body.style.overflow = isMobileMenuOpen ? "hidden" : "unset"
    }, [isMobileMenuOpen])

    const navLinks = [
        { name: "Performance Index", href: "/best-picks" },
        { name: "Compare", href: "/compare" },
        { name: "Real-time Arbitrage", href: "/deals", isHot: true },
        { name: "Testing Protocols", href: "/lab" },
        { name: "Technical Docs", href: "/docs" }
    ]

    const pathSegments = pathname.split("/").filter((v) => v)

    return (
        <motion.div className="fixed top-0 left-0 right-0 z-[100] w-full">
            {/* 1. EEAT Trust Bar: 权威背书层 (顶级白帽站标志) */}
            <AnimatePresence mode="wait">
                {trustStripVisible && (
                    <motion.div
                        initial={false}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-[#050505] border-b border-white/[0.05] py-2 hidden lg:block"
                    >
                        <div className="container mx-auto px-4 sm:px-6 flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase tracking-[0.25em]">
                            <div className="flex items-center gap-6">
                                <span className="flex items-center gap-2 text-blue-500 cursor-default">
                                    <Activity className="w-3 h-3 animate-pulse" />
                                    LIVE_INDEX: {metrics.modelsAnalyzed}{" "}
                                    MODELS
                                </span>
                                <span className="w-[1px] h-3 bg-white/10" />
                                <span className="flex items-center gap-1.5 hover:text-white transition-colors cursor-help">
                                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                    INDEPENDENT_LAB_AUDIT
                                </span>
                            </div>
                            <div className="flex items-center gap-5">
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1.5">
                                        <Database className="w-2.5 h-2.5 opacity-50" />
                                        SYNC: {metrics.lastUpdate}
                                    </span>
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded border border-white/10 text-slate-400">
                                        <Command className="w-2.5 h-2.5" />
                                        <span>NODE: {metrics.node}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 2. Main Navigation: 极致玻璃拟态 */}
            <header
                className={cn(
                    "w-full transition-all duration-500 px-4 md:px-6 lg:px-0 border-b",
                    isScrolled
                        ? "bg-white/90 backdrop-blur-2xl py-3 shadow-[0_4px_30px_-10px_rgba(0,0,0,0.05)] border-slate-200/60"
                        : "bg-white py-5 md:py-8 border-transparent"
                )}
            >
                <div className="container mx-auto flex items-center justify-between gap-4">
                    {/* Logo Area */}
                    <Link
                        href="/"
                        className="flex items-center space-x-3 group cursor-pointer shrink-0"
                    >
                        <div className="w-9 h-9 md:w-10 md:h-10 bg-slate-950 rounded-xl flex items-center justify-center group-hover:bg-blue-700 transition-all duration-500 shadow-2xl shadow-slate-950/20">
                            <span className="text-white font-black text-lg md:text-xl italic tracking-tighter uppercase">
                                S
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg md:text-2xl font-[1000] tracking-tighter text-slate-950 uppercase leading-none">
                                SleepChoice
                                <span className="text-blue-700">Guide</span>
                            </span>
                            <span className="text-[7px] md:text-[9px] font-black text-slate-400 tracking-[0.4em] uppercase mt-1 pl-0.5 flex items-center gap-2">
                                <span className="w-2 h-[1px] bg-blue-500/30" />
                                Intel Unit
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Nav: 胶囊式导航 */}
                    <nav className="hidden lg:flex items-center bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50 backdrop-blur-sm">
                        {navLinks.map((link) => {
                            const isActive = pathname.startsWith(link.href)
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={cn(
                                        "px-5 py-2.5 text-[10px] font-black uppercase tracking-widest relative group transition-all rounded-xl cursor-pointer",
                                        isActive
                                            ? "text-blue-700"
                                            : "text-slate-500 hover:text-slate-950"
                                    )}
                                >
                                    <span className="relative z-10">
                                        {link.name}
                                    </span>
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeNav"
                                            className="absolute inset-0 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-slate-200/60 rounded-xl"
                                            transition={{
                                                type: "spring",
                                                bounce: 0.15,
                                                duration: 0.5
                                            }}
                                        />
                                    )}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Desktop Actions — icon jumps to registry search; inline fields belong on /registry */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Link
                            href="/registry#registry-search"
                            title="Search verified mattresses"
                            aria-label="Search verified mattresses in registry"
                            className={cn(
                                "hidden lg:inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white",
                                "text-slate-500 shadow-sm transition-colors",
                                "hover:border-slate-950 hover:bg-slate-950 hover:text-white",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                            )}
                        >
                            <Search className="h-[18px] w-[18px]" strokeWidth={2.25} />
                        </Link>

                        <Link
                            href="/quiz"
                            className="bg-slate-950 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] hover:bg-blue-700 transition-all shadow-xl shadow-slate-950/10 flex items-center gap-2.5 cursor-pointer group overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                            <Cpu className="w-4 h-4 group-hover:rotate-12 transition-transform duration-500" />
                            <span className="hidden sm:inline">
                                Match_Engine
                            </span>
                        </Link>

                        <button
                            onClick={() =>
                                setIsMobileMenuOpen(!isMobileMenuOpen)
                            }
                            className="lg:hidden p-3 text-slate-950 bg-slate-100 rounded-xl border border-slate-200 active:scale-95 transition-all cursor-pointer"
                        >
                            {isMobileMenuOpen ? (
                                <X size={20} />
                            ) : (
                                <Menu size={20} />
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* 3. Mobile Menu Overlay: 指挥中心风格 */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="fixed inset-0 top-[60px] bg-white z-[90] lg:hidden flex flex-col"
                    >
                        <div className="flex flex-col p-8 space-y-10 overflow-y-auto">
                            <Link
                                href="/registry#registry-search"
                                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-slate-950 transition-colors hover:border-blue-600 hover:bg-blue-50/50 active:scale-[0.99]"
                            >
                                <span className="flex items-center gap-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-blue-600">
                                        <Search className="h-5 w-5" aria-hidden />
                                    </span>
                                    <span className="text-sm font-black uppercase tracking-wide">
                                        Registry Search
                                    </span>
                                </span>
                                <ArrowRight className="h-5 w-5 text-slate-300" aria-hidden />
                            </Link>

                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
                                    <Terminal className="w-3.5 h-3.5 text-blue-600" />
                                    System_Protocols
                                </h4>
                                <nav className="flex flex-col gap-3">
                                    {navLinks.map((link) => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            className="flex items-center justify-between py-5 border-b border-slate-50 text-2xl font-[1000] text-slate-950 tracking-tighter uppercase cursor-pointer group"
                                        >
                                            <span className="flex items-center gap-4">
                                                {link.name}
                                                {link.isHot && (
                                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                                                )}
                                            </span>
                                            <ArrowRight className="w-6 h-6 text-blue-600 -translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                                        </Link>
                                    ))}
                                </nav>
                            </div>

                            <div className="pt-10 border-t border-slate-100 space-y-6">
                                <Link
                                    href="/quiz"
                                    className="w-full bg-slate-950 text-white h-20 rounded-2xl flex items-center justify-center gap-5 font-black uppercase tracking-[0.3em] shadow-2xl shadow-slate-950/20 cursor-pointer"
                                >
                                    <Cpu className="w-6 h-6 text-blue-500" />
                                    Execute Match Engine
                                </Link>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                        <span className="block text-[8px] font-bold text-slate-400 uppercase mb-2 tracking-widest text-center">
                                            Core_Status
                                        </span>
                                        <div className="text-[11px] font-black text-emerald-600 uppercase flex items-center justify-center gap-2">
                                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                                            Active
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-center">
                                        <span className="block text-[8px] font-bold text-slate-400 uppercase mb-2 tracking-widest">
                                            Database
                                        </span>
                                        <span className="text-[11px] font-black text-slate-950 uppercase">
                                            {metrics.protocol}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 4. Breadcrumbs: 路径解析视觉 */}
            <AnimatePresence>
                {pathSegments.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn(
                            "relative border-b border-slate-100 overflow-x-auto no-scrollbar",
                            isScrolled
                                ? "bg-white/90 backdrop-blur-xl"
                                : "bg-slate-50/60"
                        )}
                    >
                        <div className="container mx-auto px-4 md:px-6">
                            <nav className="flex items-center h-10 md:h-12 min-w-max">
                                <div className="flex items-center text-[10px] font-bold">
                                    <Link
                                        href="/"
                                        className="flex items-center gap-2 text-slate-400 hover:text-blue-700 transition-all group px-2 py-1.5 rounded-lg hover:bg-blue-50 cursor-pointer"
                                    >
                                        <Terminal className="w-3.5 h-3.5" />
                                        <span className="uppercase font-black tracking-[0.2em] text-[9px]">
                                            INDEX
                                        </span>
                                    </Link>

                                    {pathSegments.map((segment, index) => {
                                        const href = `/${pathSegments
                                            .slice(0, index + 1)
                                            .join("/")}`
                                        const isLast =
                                            index === pathSegments.length - 1
                                        return (
                                            <div
                                                key={href}
                                                className="flex items-center"
                                            >
                                                <ChevronRight className="mx-2 w-3.5 h-3.5 text-slate-300 font-light" />
                                                {isLast ? (
                                                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-950 text-white rounded-lg shadow-lg shadow-slate-950/20">
                                                        <Hash className="w-3 h-3 text-blue-400" />
                                                        <span className="font-black uppercase tracking-[0.15em] leading-none">
                                                            {segment.replace(
                                                                /-/g,
                                                                "_"
                                                            )}
                                                        </span>
                                                        <motion.span
                                                            animate={{
                                                                opacity: [1, 0]
                                                            }}
                                                            transition={{
                                                                duration: 0.8,
                                                                repeat: Infinity
                                                            }}
                                                            className="w-[2px] h-3 bg-blue-500"
                                                        />
                                                    </div>
                                                ) : (
                                                    <Link
                                                        href={href}
                                                        className="text-slate-400 hover:text-slate-950 transition-colors uppercase font-black tracking-widest text-[9px] px-1 cursor-pointer"
                                                    >
                                                        {segment.replace(
                                                            /-/g,
                                                            "_"
                                                        )}
                                                    </Link>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </nav>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
