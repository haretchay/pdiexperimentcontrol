import { NextResponse } from "next/server"

import { acceptInvitation } from "@/lib/pdi/invitation-accept-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  Allow: "POST, OPTIONS",
}

async function readBody(request: Request) {
  const contentType = request.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    return request.json().catch(() => ({}))
  }

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null)
    if (!form) return {}
    return Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]))
  }

  const text = await request.text().catch(() => "")
  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    return Object.fromEntries(new URLSearchParams(text).entries())
  }
}

export async function POST(request: Request) {
  const result = await acceptInvitation(await readBody(request))

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, route: "/api/auth/invitations/accept", error: result.error },
      { status: result.status, headers: HEADERS },
    )
  }

  return NextResponse.json(
    { ok: true, route: "/api/auth/invitations/accept", signedIn: false, redirectTo: result.redirectTo },
    { status: 200, headers: HEADERS },
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS })
}

function methodNotAllowed() {
  return NextResponse.json(
    { ok: false, route: "/api/auth/invitations/accept", error: "Método não permitido. Esta rota aceita POST." },
    { status: 405, headers: HEADERS },
  )
}

export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
