import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return res

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      },
    },
  })

  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user

  const path = req.nextUrl.pathname
  const isAuthRoute = path.startsWith("/auth")
  const isProtected =
    path === "/" ||
    path.startsWith("/dashboard") ||
    path.startsWith("/experiments") ||
    path.startsWith("/media") ||
    path.startsWith("/registers")

  if (!user && isProtected) {
    const url = req.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute && path !== "/auth/blocked") {
    const url = req.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, role")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!profile || profile.status !== "active") {
      if (path !== "/auth/blocked") {
        const url = req.nextUrl.clone()
        url.pathname = "/auth/blocked"
        return NextResponse.redirect(url)
      }
      return res
    }

    const isAdminRoute = path.startsWith("/admin")
    if (isAdminRoute && profile.role !== "admin") {
      const url = req.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
