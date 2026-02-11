import { createBrowserClient } from "@supabase/ssr"

// Normaliza respostas não-JSON de erro (ex: 429 "Too Many Requests")
// para evitar SyntaxError no supabase-js.
async function supabaseSafeFetch(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input as any, init)
  const ct = res.headers.get("content-type") ?? ""

  if (ct.includes("application/json") || res.status === 204) return res

  if (res.status >= 400) {
    const text = await res.text().catch(() => "")
    return new Response(JSON.stringify({ message: text || res.statusText, status: res.status }), {
      status: res.status,
      headers: { "content-type": "application/json" },
    })
  }

  return res
}

export function createClient() {
  /**
   * Evita criar múltiplas instâncias do GoTrueClient (warning de excesso) e storms de refresh.
   *
   * ⚠️ Importante (Next.js): componentes "use client" ainda são renderizados no servidor
   * no primeiro HTML. Portanto, NÃO podemos dar throw quando `window` não existe,
   * senão o preview quebra em qualquer rota que importe este client.
   *
   * Estratégia:
   * - No browser: singleton com auth normal.
   * - No servidor (apenas para SSR de componentes client): cria uma instância "safe"
   *   sem persistência/refresh automático. Ela não deve ser usada para operações críticas
   *   no servidor; serve apenas para não quebrar o SSR. As chamadas reais rodam no browser.
   */

  const g = globalThis as any

  // Browser singleton
  if (typeof window !== "undefined") {
    if (!g.__pdi_supabase_browser_client) {
      g.__pdi_supabase_browser_client = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            fetch: supabaseSafeFetch as any,
          },
        } as any,
      )
    }
    return g.__pdi_supabase_browser_client
  }

  // SSR fallback (não persistir / não refreshar tokens)
  if (!g.__pdi_supabase_ssr_fallback_client) {
    g.__pdi_supabase_ssr_fallback_client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          fetch: supabaseSafeFetch as any,
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      } as any,
    )
  }

  return g.__pdi_supabase_ssr_fallback_client
}
