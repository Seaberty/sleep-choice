"use server"

import { supabase } from "@/lib/supabase" // Import unified configuration
import { headers } from "next/headers"

export async function subscribeAction(formData: FormData) {
    const email = (formData.get("email") as string)?.toLowerCase().trim()

    // 1. Strict validation: Comply with top-tier white-hat e-commerce standards
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email)) {
        return { success: false, error: "Please provide a valid expert email." }
    }

    const source =
        (formData.get("source") as string)?.trim().toLowerCase() || "footer"
    const explicitPath = (formData.get("source_path") as string)?.trim()

    const headerList = await headers()
    const referer = headerList.get("referer") || "footer_direct"
    const source_path = explicitPath || referer

    const meta_data: Record<string, unknown> = {
        subscribed_at: new Date().toISOString(),
        source,
        platform: headerList.get("sec-ch-ua-platform") || "unknown"
    }

    const quizAnswersRaw = formData.get("quiz_answers")
    if (typeof quizAnswersRaw === "string" && quizAnswersRaw.trim()) {
        try {
            meta_data.quiz_answers = JSON.parse(quizAnswersRaw)
        } catch {
            meta_data.quiz_answers_raw = quizAnswersRaw.slice(0, 2000)
        }
    }

    try {
        const { error } = await supabase.from("lead_captures").upsert(
            {
                email,
                source_path,
                meta_data
            },
            { onConflict: "email" }
        )

        if (error) {
            // Friendly handling for 42501 (RLS rejection)
            if (error.code === "42501") {
                console.error(
                    "RLS Policy Error: Ensure SELECT/INSERT/UPDATE are enabled for anon role."
                )
                return {
                    success: false,
                    error: "Security validation failed. Try again later."
                }
            }
            throw error
        }

        return { success: true }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error("Subscribe Action Error:", message)
        return { success: false, error: "System busy. Please try again." }
    }
}
