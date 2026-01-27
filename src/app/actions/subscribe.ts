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

    // 2. Automated attribution: Get the URL the user is currently visiting (EEAT core data)
    const headerList = await headers()
    const referer = headerList.get("referer") || "footer_direct"

    try {
        // 3. Execute idempotent Upsert
        const { error } = await supabase.from("lead_captures").upsert(
            {
                email,
                source_path: referer,
                meta_data: {
                    subscribed_at: new Date().toISOString(),
                    // Record simple environment fingerprint for anti-fraud
                    platform: headerList.get("sec-ch-ua-platform") || "unknown"
                }
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
