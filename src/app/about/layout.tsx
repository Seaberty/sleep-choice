import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "About",
    description:
        "How SleepChoice Guide operates: independent sleep technology audits, data methodology, and editorial standards.",
    alternates: { canonical: "/about" }
}

export default function AboutLayout({
    children
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
