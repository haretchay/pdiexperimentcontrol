import { NextResponse } from "next/server"

import { acceptInvitationRequest, invitationOptionsResponse } from "@/lib/pdi/accept-invitation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

export async function POST(request: Request) {
  return acceptInvitationRequest(request)
}

export async function OPTIONS() {
  return invitationOptionsResponse()
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "/api/auth/accept-invitation",
      message: "Rota alternativa de aceite do convite ativa. Use POST para concluir o cadastro.",
    },
    { headers: NO_STORE_HEADERS },
  )
}
