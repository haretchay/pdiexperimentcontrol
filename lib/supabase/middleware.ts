import { NextResponse, type NextRequest } from "next/server"

// Middleware desabilitado intencionalmente.
// Motivo: o middleware anterior chamava Supabase Auth em toda requisição,
// o que gerava 429 (Too Many Requests), AbortError e falhas de JSON parse.
//
// A proteção de rotas e verificação de perfil agora ficam no layout server (app/(app)/layout.tsx).

export function middleware(_req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  // Nunca bate em nenhuma rota (desativa na prática)
  matcher: ["/__middleware_disabled__"],
}
