import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const path = request.nextUrl.pathname

  // ✅ Normaliza URLs que às vezes vazam route-groups no preview do v0
  // "/(app)/x" -> "/x"
  // "/(auth)/x" -> "/auth/x"
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
    return NextResponse.redirect(url)
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // ✅ Só refresh de sessão/cookies. Sem redirects. Sem profile. Sem proteção aqui.
  try {
    await supabase.auth.getUser()
  } catch (err) {
    // Não quebra navegação do preview por erro transitório
    console.error("[middleware] supabase.auth.getUser failed:", err)
  }

  return supabaseResponse
}
