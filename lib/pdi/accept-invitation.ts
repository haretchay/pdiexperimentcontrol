import "server-only"

import { NextResponse } from "next/server"

import { hashInvitationToken } from "@/lib/pdi/invitations"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const ALLOW_HEADERS = {
  Allow: "POST, OPTIONS",
}

export function invitationOptionsResponse() {
  return new NextResponse(null, { status: 204, headers: ALLOW_HEADERS })
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: ALLOW_HEADERS })
}

export async function acceptInvitationRequest(request: Request) {
  try {
    const admin = createAdminClient()
    if (!admin) {
      return jsonError("SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.", 500)
    }

    const body = await request.json().catch(() => ({}))
    const token = typeof body?.token === "string" ? body.token.trim() : ""
    const password = typeof body?.password === "string" ? body.password : ""
    const repeatPassword = typeof body?.repeatPassword === "string" ? body.repeatPassword : ""

    if (!token) {
      return jsonError("Token do convite não informado.", 400)
    }

    if (!password || password.length < 6) {
      return jsonError("A senha deve ter pelo menos 6 caracteres.", 400)
    }

    if (password !== repeatPassword) {
      return jsonError("As senhas não coincidem.", 400)
    }

    const tokenHash = hashInvitationToken(token)
    const { data: invitation, error: invitationError } = await admin
      .from("user_invitations")
      .select("id, email, full_name, role, status, expires_at, accepted_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle()

    if (invitationError) {
      return jsonError(invitationError.message || "Erro ao validar convite.", 500)
    }

    if (!invitation) {
      return jsonError("Convite inválido.", 404)
    }

    if (invitation.status !== "pending" || invitation.accepted_at || invitation.revoked_at) {
      return jsonError("Este convite não está mais disponível.", 409)
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await admin
        .from("user_invitations")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", invitation.id)
        .eq("status", "pending")

      return jsonError("Este convite expirou.", 410)
    }

    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: invitation.full_name,
        role: invitation.role,
        invitation_id: invitation.id,
      },
    })

    if (createUserError || !createdUser.user) {
      return jsonError(
        createUserError?.message || "Não foi possível criar o usuário. Verifique se este e-mail já possui cadastro.",
        400,
      )
    }

    const now = new Date().toISOString()
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        user_id: createdUser.user.id,
        full_name: invitation.full_name,
        role: invitation.role,
        status: "active",
        updated_at: now,
      },
      { onConflict: "user_id" },
    )

    if (profileError) {
      // Evita usuário criado sem profile ativo.
      await admin.auth.admin.deleteUser(createdUser.user.id).catch(() => undefined)
      return jsonError(profileError.message || "Erro ao criar perfil do usuário.", 500)
    }

    const { error: acceptError } = await admin
      .from("user_invitations")
      .update({
        status: "accepted",
        accepted_user_id: createdUser.user.id,
        accepted_at: now,
        updated_at: now,
      })
      .eq("id", invitation.id)
      .eq("status", "pending")

    if (acceptError) {
      return jsonError(acceptError.message || "Erro ao concluir convite.", 500)
    }

    const supabase = await createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invitation.email,
      password,
    })

    return NextResponse.json(
      {
        ok: true,
        signedIn: !signInError,
        redirectTo: signInError ? "/auth/login" : "/dashboard",
      },
      { headers: ALLOW_HEADERS },
    )
  } catch (error: any) {
    return jsonError(error?.message ?? "Erro inesperado ao aceitar convite.", 500)
  }
}
