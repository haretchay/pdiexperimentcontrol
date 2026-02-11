import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Supabase pode retornar 429/erros como texto puro (ex: "Too Many Requests"),
// o que faz o supabase-js tentar dar JSON.parse e explodir com SyntaxError.
// Este wrapper transforma respostas não-JSON de erro em JSON, evitando o crash.
async function supabaseSafeFetch(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input as any, init)
  const ct = res.headers.get("content-type") ?? ""

  // Se já é JSON (ou não tem body), deixa passar.
  if (ct.includes("application/json") || res.status === 204) return res

  // Somente normaliza quando é erro e não é JSON.
  if (res.status >= 400) {
    const text = await res.text().catch(() => "")
    return new Response(JSON.stringify({ message: text || res.statusText, status: res.status }), {
      status: res.status,
      headers: { "content-type": "application/json" },
    })
  }

  return res
}

/**
 * IMPORTANTE: Com Fluid Compute, não coloque este cliente em uma variável global.
 * Sempre crie um novo cliente dentro de cada função ao usá-lo.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: {
      fetch: supabaseSafeFetch as any,
    },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // O método "setAll" foi chamado de um Server Component.
          // Isso pode ser ignorado se você tiver middleware atualizando
          // as sessões do usuário.
        }
      },
    },
  })
}
