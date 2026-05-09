import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Audit Methodology",
    description:
        "How mattress audits are scored: data sources, verification steps, and limitations of the SleepChoice Guide framework.",
    alternates: { canonical: "/methodology" }
}

export default function MethodologyLayout({
    children
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
