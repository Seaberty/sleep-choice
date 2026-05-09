import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Match Engine",
    description:
        "Answer a short protocol to match mattress types to your sleep profile using the SleepChoice scoring matrix.",
    alternates: { canonical: "/quiz" }
}

export default function QuizLayout({
    children
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
