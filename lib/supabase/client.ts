import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  // Evita criar múltiplas instâncias do GoTrueClient (warning de excesso) e storms de refresh.
  // No browser, podemos manter uma instância singleton segura.
  if (typeof window === "undefined") {
    throw new Error("createClient (browser) called on server. Use lib/supabase/server.ts instead.")
  }

  const g = globalThis as any
  if (!g.__pdi_supabase_browser_client) {
    g.__pdi_supabase_browser_client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }

  return g.__pdi_supabase_browser_client
}
