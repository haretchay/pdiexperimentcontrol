import { updateSession } from "@/lib/supabase/middleware"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  // Compatibilidade com builds/chunks antigos do convite.
  // Alguns navegadores ainda podem enviar POST para /api/auth/invitations/accept;
  // reescrevemos para a rota nova antes de qualquer outra lógica.
  if (request.nextUrl.pathname === "/api/auth/invitations/accept") {
    const url = request.nextUrl.clone()
    url.pathname = "/api/auth/accept-invitation"
    return NextResponse.rewrite(url)
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    "/api/auth/invitations/accept",
    /*
     * Corresponde a todos os caminhos de requisição exceto:
     * - /api, exceto a rota antiga de aceite tratada acima
     * - _next/static (arquivos estáticos)
     * - _next/image (arquivos de otimização de imagem)
     * - favicon.ico
     * - imagens/arquivos estáticos comuns
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
