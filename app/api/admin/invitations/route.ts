import { NextResponse } from "next/server"

import {
  buildInvitationUrl,
  createInvitationToken,
  getInvitationExpiresAt,
  hashInvitationToken,
  INVITATION_DEFAULT_EXPIRES_DAYS,
  isInvitationRole,
  normalizeInvitationEmail,
} from "@/lib/pdi/invitations"
import { requireAdminForRoute } from "@/lib/pdi/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await requireAdminForRoute()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const email = normalizeInvitationEmail(typeof body?.email === "string" ? body.email : "")
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : ""
    const role = isInvitationRole(body?.role) ? body.role : "user"
    const expiresDaysRaw = Number(body?.expiresDays ?? INVITATION_DEFAULT_EXPIRES_DAYS)

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 })
    }

    const token = createInvitationToken()
    const tokenHash = hashInvitationToken(token)
    const expiresAt = getInvitationExpiresAt(expiresDaysRaw)
    const now = new Date().toISOString()

    // Evita que existam links pendentes antigos para o mesmo e-mail.
    await auth.admin
      .from("user_invitations")
      .update({ status: "revoked", revoked_at: now, updated_at: now })
      .eq("email", email)
      .eq("status", "pending")

    const { data, error } = await auth.admin
      .from("user_invitations")
      .insert({
        email,
        full_name: fullName || null,
        role,
        token_hash: tokenHash,
        invited_by: auth.user.id,
        expires_at: expiresAt,
        status: "pending",
      })
      .select(
        "id, email, full_name, role, status, invited_by, accepted_user_id, expires_at, accepted_at, revoked_at, created_at, updated_at",
      )
      .single()

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Erro ao criar convite." },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, invitation: data, inviteUrl: buildInvitationUrl(token, request) })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Erro inesperado ao criar convite." },
      { status: 500 },
    )
  }
}
