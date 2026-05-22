import { NextResponse } from "next/server"

import { hashInvitationToken } from "@/lib/pdi/invitations"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor." },
        { status: 500 },
      )
    }

    const url = new URL(request.url)
    const token = url.searchParams.get("token")?.trim() ?? ""

    if (!token) {
      return NextResponse.json({ ok: false, error: "Token do convite não informado." }, { status: 400 })
    }

    const tokenHash = hashInvitationToken(token)
    const { data: invitation, error } = await admin
      .from("user_invitations")
      .select("id, email, full_name, role, status, expires_at, accepted_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Erro ao validar convite." },
        { status: 500 },
      )
    }

    if (!invitation) {
      return NextResponse.json({ ok: false, error: "Convite inválido." }, { status: 404 })
    }

    if (invitation.status !== "pending" || invitation.accepted_at || invitation.revoked_at) {
      return NextResponse.json({ ok: false, error: "Este convite não está mais disponível." }, { status: 409 })
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await admin
        .from("user_invitations")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", invitation.id)
        .eq("status", "pending")

      return NextResponse.json({ ok: false, error: "Este convite expirou." }, { status: 410 })
    }

    return NextResponse.json({
      ok: true,
      invitation: {
        email: invitation.email,
        fullName: invitation.full_name,
        role: invitation.role,
        expiresAt: invitation.expires_at,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Erro inesperado ao validar convite." },
      { status: 500 },
    )
  }
}
