import { NextResponse } from "next/server"

import { requireAdminForRoute } from "@/lib/pdi/admin-auth"
import { buildInvitationUrl, createInvitationToken, hashInvitationToken } from "@/lib/pdi/invitations"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdminForRoute()
  if (!auth.ok) return auth.response

  try {
    const id = params.id
    if (!id) {
      return NextResponse.json({ ok: false, error: "Convite inválido." }, { status: 400 })
    }

    const { data: invitation, error: invitationError } = await auth.admin
      .from("user_invitations")
      .select("id, status, expires_at")
      .eq("id", id)
      .maybeSingle()

    if (invitationError) {
      return NextResponse.json(
        { ok: false, error: invitationError.message || "Erro ao buscar convite." },
        { status: 500 },
      )
    }

    if (!invitation) {
      return NextResponse.json({ ok: false, error: "Convite não encontrado." }, { status: 404 })
    }

    if (invitation.status !== "pending") {
      return NextResponse.json(
        { ok: false, error: "Somente convites pendentes permitem copiar link de envio." },
        { status: 400 },
      )
    }

    const now = new Date()
    const expiresAt = new Date(invitation.expires_at)
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
      await auth.admin
        .from("user_invitations")
        .update({ status: "expired", updated_at: now.toISOString() })
        .eq("id", id)
        .eq("status", "pending")

      return NextResponse.json(
        { ok: false, error: "Este convite expirou. Gere um novo convite para o usuário." },
        { status: 400 },
      )
    }

    const token = createInvitationToken()
    const tokenHash = hashInvitationToken(token)
    const updatedAt = now.toISOString()

    const { data, error } = await auth.admin
      .from("user_invitations")
      .update({ token_hash: tokenHash, updated_at: updatedAt })
      .eq("id", id)
      .eq("status", "pending")
      .select("id, status, updated_at")
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Erro ao gerar link do convite." },
        { status: 500 },
      )
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Convite não encontrado ou já não está pendente." },
        { status: 404 },
      )
    }

    return NextResponse.json({ ok: true, invitation: data, inviteUrl: buildInvitationUrl(token, request) })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Erro inesperado ao gerar link do convite." },
      { status: 500 },
    )
  }
}
