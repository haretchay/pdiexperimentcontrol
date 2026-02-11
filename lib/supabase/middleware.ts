import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

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

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname

  // =========================================================
  // ✅ PRIORIDADE 1: NORMALIZAÇÃO DE ENTRADA (v0 preview)
  // Faz isso ANTES de criar client/consultar Supabase (reduz chamadas e 429).
  // Remove route groups literais que às vezes aparecem no preview:
  // "/(app)/..." -> "/..."
  // "/(auth)/..." -> "/auth/..."
  // "/(app)" ou "/(auth)" -> "/"
  // =========================================================
  const groupMatch = path.match(/^\/\((app|auth)\)(\/.*)?$/)

  if (groupMatch) {
    const group = groupMatch[1] // "app" | "auth"
    const rest = groupMatch[2] ?? "/"

    const normalizedPath = group === "auth" ? (rest === "/" ? "/auth" : `/auth${rest}`) : rest === "/" ? "/" : rest

    const url = request.nextUrl.clone()
    url.pathname = normalizedPath

    return NextResponse.redirect(url)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: supabaseSafeFetch as any,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Mantém compatibilidade com o snippet SSR do Supabase
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  // =========================================================
  // ✅ PRIORIDADE 2: CONSULTA AO SUPABASE (APENAS QUANDO NECESSÁRIO)
  // No preview (v0), o middleware pode rodar MUITAS vezes; chamar getUser
  // em tudo gera 429 e quebra páginas.
  // =========================================================
  const isAuthRoute = path.startsWith("/auth")
  const isProtected =
    path === "/" ||
    path.startsWith("/dashboard") ||
    path.startsWith("/experiments") ||
    path.startsWith("/tests") ||
    path.startsWith("/repetitions") ||
    path.startsWith("/media") ||
    path.startsWith("/registers")

  let user: any = null
  if (isProtected || isAuthRoute) {
    try {
      // Importante: manter este getUser para atualizar/validar sessão (SSR cookies)
      const {
        data: { user: u },
      } = await supabase.auth.getUser()
      user = u
    } catch (err: any) {
      const msg = String(err?.message ?? err ?? "")

      // Se estourar rate limit / abort no preview, não faz redirect (evita loop)
      if (msg.includes("Too Many") || msg.includes("rate limit") || err?.status === 429 || err?.name === "AbortError") {
        return supabaseResponse
      }

      // Token antigo/inválido: limpa e manda para login.
      if (msg.includes("refresh_token_not_found") || msg.includes("Invalid Refresh Token")) {
        const url = request.nextUrl.clone()
        url.pathname = "/auth/login"
        const r = NextResponse.redirect(url)
        // copia cookies que o Supabase pode ter setado
        for (const c of supabaseResponse.cookies.getAll()) r.cookies.set(c.name, c.value)
        // força limpeza do storage do supabase (cookies)
        r.cookies.delete("sb-access-token")
        r.cookies.delete("sb-refresh-token")
        return r
      }

      console.error("[middleware] getUser error:", err)
      return supabaseResponse
    }
  }

  // =========================================================
  // ✅ PRIORIDADE 3: REDIRECTS BÁSICOS (SEM CONSULTAR profiles AQUI)
  // - Não logado em rota protegida => /auth/login
  // - Logado em /auth/* (exceto blocked) => /dashboard
  // =========================================================
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute && path !== "/auth/blocked") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Observação:
  // - Checagem de status/role (profiles) fica no SERVER LAYOUT do grupo (app)
  //   via requireActiveUser() para evitar duplicação de chamadas e 429.

  return supabaseResponse
}
