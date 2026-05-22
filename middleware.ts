import { updateSession } from "@/lib/supabase/middleware"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Rotas de API ficam fora do middleware.
     * Isso evita que POST /api/auth/invitations/accept seja interceptado/rewriteado
     * antes do Route Handler do Next.js, que é o ponto que conclui o cadastro por convite.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
