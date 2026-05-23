import { NextResponse } from "next/server"

import { validateInvitationToken } from "@/lib/pdi/invitation-accept-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const result = await validateInvitationToken(url.searchParams.get("token"))

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status, headers: NO_STORE_HEADERS })
  }

  return NextResponse.json({ ok: true, invitation: result.invitation }, { headers: NO_STORE_HEADERS })
}
