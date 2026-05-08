import { getSiteHeaderMetrics } from "@/lib/site-metrics"
import LabPageClient from "./lab-client"

export const metadata = {
    title: "Testing Protocols | SleepChoice Laboratory",
    description:
        "How we score mattresses in the verified registry: methodology overview aligned to live index metrics."
}

export default async function LabPage() {
    const metrics = await getSiteHeaderMetrics()
    return <LabPageClient metrics={metrics} />
}
