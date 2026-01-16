import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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

  // Importante: manter este getUser para atualizar/validar sessão (SSR cookies)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // =========================================================
  // ✅ PRIORIDADE 1: NORMALIZAÇÃO DE ENTRADA (v0 preview)
  // Remove route groups literais que às vezes aparecem no preview:
  // "/(app)/..." -> "/..."
  // "/(auth)/..." -> "/auth/..."
  // "/(app)" ou "/(auth)" -> "/"
  // =========================================================
  const groupMatch = path.match(/^\/\((app|auth)\)(\/.*)?$/)

  if (groupMatch) {
    const group = groupMatch[1] // "app" | "auth"
    const rest = groupMatch[2] ?? "/"

    const normalizedPath =
      group === "auth"
        ? rest === "/" ? "/auth" : `/auth${rest}`
        : rest === "/" ? "/" : rest

    const url = request.nextUrl.clone()
    url.pathname = normalizedPath

    const redirectResponse = NextResponse.redirect(url)

    // Copia cookies já acumulados pelo Supabase (evita desync da sessão)
    for (const c of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(c.name, c.value)
    }

    return redirectResponse
  }

  // =========================================================
  // ✅ PRIORIDADE 2: REDIRECTS BÁSICOS (SEM CONSULTAR profiles AQUI)
  // - Não logado em rota protegida => /auth/login
  // - Logado em /auth/* (exceto blocked) => /dashboard
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
