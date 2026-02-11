import { updateSession } from "@/lib/supabase/middleware"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Corresponde a todos os caminhos de requisição exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (arquivos de otimização de imagem)
     * - favicon.ico (arquivo favicon)
     * - imagens - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Sinta-se livre para modificar este padrão para incluir mais caminhos.
     */
    // Também exclui rotas de API para evitar chamadas extras ao Supabase no preview.
    // As rotas /api já podem proteger/validar no handler.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
