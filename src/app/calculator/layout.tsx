import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Room & Bed Dimension Matrix",
    description:
        "Plan mattress and room fit: bed sizes, clearance, and layout notes for independent lab-style planning.",
    alternates: { canonical: "/calculator" }
}

export default function CalculatorLayout({
    children
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
