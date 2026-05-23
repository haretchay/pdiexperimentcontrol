import { NextResponse } from "next/server"

import { acceptInvitation } from "@/lib/pdi/invitation-accept-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  Allow: "POST, OPTIONS",
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const result = await acceptInvitation(body)

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status, headers: NO_STORE_HEADERS })
  }

  return NextResponse.json(
    { ok: true, signedIn: false, redirectTo: result.redirectTo },
    { status: 200, headers: NO_STORE_HEADERS },
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS })
}

export async function GET() {
  return NextResponse.json(
    { ok: true, accepts: ["POST", "OPTIONS"] },
    { headers: NO_STORE_HEADERS },
  )
}

function methodNotAllowed() {
  return NextResponse.json(
    { ok: false, error: "Método não permitido. Esta rota aceita POST para concluir o cadastro por convite." },
    { status: 405, headers: NO_STORE_HEADERS },
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
