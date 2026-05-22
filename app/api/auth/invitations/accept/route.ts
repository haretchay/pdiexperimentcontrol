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
      route: "/api/auth/invitations/accept",
      accepts: ["POST", "OPTIONS"],
      message: "Rota de aceite do convite ativa. Use POST para concluir o cadastro.",
    },
    { headers: NO_STORE_HEADERS },
  )
}

function methodNotAllowed() {
  return NextResponse.json(
    {
      ok: false,
      error: "Método não permitido. Esta rota aceita POST para concluir o cadastro por convite.",
    },
    {
      status: 405,
      headers: {
        Allow: "POST, OPTIONS",
        ...NO_STORE_HEADERS,
      },
    },
  )
}

export async function PUT() {
  return methodNotAllowed()
}

export async function PATCH() {
  return methodNotAllowed()
}

export async function DELETE() {
  return methodNotAllowed()
}
