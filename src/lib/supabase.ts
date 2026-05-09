// Database configuration
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** 服务端专用（如 /go 点击计数）；配置了 SUPABASE_SERVICE_ROLE_KEY 时可绕过 RLS 更新 product_offers */
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : supabase
