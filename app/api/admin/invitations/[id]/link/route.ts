import { NextResponse } from "next/server"

import { requireAdminForRoute } from "@/lib/pdi/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function buildSignUpUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "")
  const origin = configuredUrl || new URL(request.url).origin
  return `${origin}/auth/sign-up`
}

/**
 * Compatibilidade com botão/JS antigo.
 * O fluxo por token foi removido; se alguma tela ainda tentar copiar link,
 * devolvemos a página pública de cadastro por e-mail autorizado.
 */
export async function POST(request: Request) {
  const auth = await requireAdminForRoute()
  if (!auth.ok) return auth.response

  return NextResponse.json({
    ok: true,
    signUpUrl: buildSignUpUrl(request),
    inviteUrl: buildSignUpUrl(request),
    message: "Fluxo por token removido. Use a página pública de cadastro por e-mail autorizado.",
  })
}
