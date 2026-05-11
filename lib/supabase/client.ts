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
   * ⚠️ Importante:
   * O client do navegador precisa usar a MESMA chave/cookie padrão que o client do servidor
   * em lib/supabase/server.ts. Antes havia um storageKey baseado no host da página,
   * enquanto o login via /api/auth/login gravava a sessão no cookie padrão do Supabase SSR.
   *
   * Resultado do conflito:
   * - o layout/servidor reconhecia o usuário logado;
   * - mas páginas client-side, ao chamar supabase.auth.getUser(), não encontravam sessão;
   * - o Supabase retornava: "Auth session missing!".
   *
   * Por isso, não defina auth.storageKey aqui. Deixe o @supabase/ssr usar o padrão
   * sb-<project-ref>-auth-token, igual ao servidor.
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
