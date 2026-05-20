import { getSiteHeaderMetrics } from "@/lib/site-metrics"
import LabPageClient from "./lab-client"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Testing Protocols",
    description:
        "Live index metrics from aggregated review intelligence—see methodology for how scores are modeled without bench hardware.",
    alternates: { canonical: "/methodology" },
    robots: { index: false, follow: true }
}

export default async function LabPage() {
    const metrics = await getSiteHeaderMetrics()
    return <LabPageClient metrics={metrics} />
}
