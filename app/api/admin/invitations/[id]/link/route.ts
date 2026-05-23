import { NextResponse } from "next/server"

import { requireAdminForRoute } from "@/lib/pdi/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function buildSignUpUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "")
  const origin = configuredUrl || new URL(request.url).origin
  return `${origin}/auth/sign-up`
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdminForRoute()
  if (!auth.ok) return auth.response

  const id = params?.id
  if (!id) {
    return NextResponse.json({ ok: false, error: "Autorização inválida." }, { status: 400 })
  }

  const { data, error } = await auth.admin
    .from("user_invitations")
    .select("id, email, full_name, role, status, invited_by, accepted_user_id, expires_at, accepted_at, revoked_at, created_at, updated_at")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message || "Erro ao buscar autorização." }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: "Autorização não encontrada." }, { status: 404 })
  }

  if (data.status !== "pending") {
    return NextResponse.json({ ok: false, error: "Essa autorização não está mais pendente." }, { status: 409 })
  }

  return NextResponse.json({ ok: true, authorization: data, invitation: data, signUpUrl: buildSignUpUrl(request) })
}
