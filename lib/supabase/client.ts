import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let browserClient: SupabaseClient | null = null

export function createClient() {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    console.error("[v0] Missing Supabase environment variables")
    console.error("[v0] NEXT_PUBLIC_SUPABASE_URL:", url ? "SET" : "MISSING")
    console.error("[v0] NEXT_PUBLIC_SUPABASE_ANON_KEY:", anon ? "SET" : "MISSING")

    // Fornecer valores default para preview funcionar (não seguro para produção)
    browserClient = createBrowserClient(url || "https://placeholder.supabase.co", anon || "placeholder-anon-key")
    return browserClient
  }

  browserClient = createBrowserClient(url, anon)
  return browserClient
}
