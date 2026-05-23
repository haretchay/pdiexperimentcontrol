import { randomUUID } from "node:crypto"

import { NextResponse } from "next/server"

import { requireAdminForRoute } from "@/lib/pdi/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

function isValidEmail(email: string) {
  return /^\S+@\S+\.\S+$/.test(email)
}

function normalizeRole(value: unknown) {
  return value === "admin" ? "admin" : "user"
}

function buildSignUpUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "")
  const origin = configuredUrl || new URL(request.url).origin
  return `${origin}/auth/sign-up`
}

export async function POST(request: Request) {
  const auth = await requireAdminForRoute()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const email = normalizeEmail(body?.email)
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : ""
    const role = normalizeRole(body?.role)
    const now = new Date().toISOString()

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 })
    }

    // Evita duplicidade de autorizações pendentes para o mesmo e-mail.
    await auth.admin
      .from("user_invitations")
      .update({ status: "revoked", revoked_at: now, updated_at: now })
      .eq("email", email)
      .eq("status", "pending")
      .is("accepted_at", null)

    const { data, error } = await auth.admin
      .from("user_invitations")
      .insert({
        email,
        full_name: fullName || null,
        role,
        status: "pending",
        token_hash: `authorized-email:${randomUUID()}`,
        invited_by: auth.user.id,
        expires_at: "9999-12-31T23:59:59.999Z",
      })
      .select(
        "id, email, full_name, role, status, invited_by, accepted_user_id, expires_at, accepted_at, revoked_at, created_at, updated_at",
      )
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message || "Erro ao autorizar cadastro." }, { status: 500 })
    }

    return NextResponse.json({ ok: true, authorization: data, invitation: data, signUpUrl: buildSignUpUrl(request) })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Erro inesperado ao autorizar cadastro." },
      { status: 500 },
    )
  }
}
