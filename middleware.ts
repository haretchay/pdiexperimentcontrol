import { NextResponse, type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

const LEGACY_INVITE_ACCEPT_PATHS = new Set([
  "/api/auth/invitations/accept",
  "/api/auth/accept-invitation",
  "/api/auth/accept-invitation-v2",
])

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Compatibilidade para JS antigo/cacheado da página de convite.
  // Esse JS ainda chama /api/auth/invitations/accept. Reescrevemos antes
  // do roteamento do Next para uma Pages API estável que aceita POST.
  if (LEGACY_INVITE_ACCEPT_PATHS.has(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/api/pdi/accept-invite"
    return NextResponse.rewrite(url)
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    "/api/auth/invitations/accept",
    "/api/auth/accept-invitation",
    "/api/auth/accept-invitation-v2",
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
