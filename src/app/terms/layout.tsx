import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Terms of Use",
    description:
        "Terms governing use of SleepChoice Guide content, tools, and affiliate disclosures.",
    alternates: { canonical: "/terms" }
}

export default function TermsLayout({
    children
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
