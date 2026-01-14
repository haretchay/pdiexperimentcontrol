import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

declare global {
  // eslint-disable-next-line no-var
  var __supabaseBrowserClient: SupabaseClient | undefined
}

export function createClient() {
  if (typeof window === "undefined") {
    // Segurança: este client é só para browser
    throw new Error("createClient (browser) called on server. Use lib/supabase/server.ts instead.")
  }

  if (!globalThis.__supabaseBrowserClient) {
    globalThis.__supabaseBrowserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }

  return globalThis.__supabaseBrowserClient
}
