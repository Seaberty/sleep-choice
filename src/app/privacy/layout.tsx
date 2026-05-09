import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Privacy Policy",
    description:
        "How SleepChoice Guide handles analytics, subscriptions, and data in line with our forensic audit workflow.",
    alternates: { canonical: "/privacy" }
}

export default function PrivacyLayout({
    children
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
