import { createHash } from "crypto"

import { createAdminClient } from "@/lib/supabase/admin"

type AcceptInviteInput = {
  token: string
  password: string
  repeatPassword: string
}

type AcceptInviteResult =
  | {
      ok: true
      status: 200
      signedIn: false
      redirectTo: string
    }
  | {
      ok: false
      status: number
      error: string
    }

export type ValidateInviteResult =
  | {
      ok: true
      status: 200
      invitation: {
        email: string
        fullName: string | null
        role: string
        expiresAt: string
      }
    }
  | {
      ok: false
      status: number
      error: string
    }

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

function fail(error: string, status: number): AcceptInviteResult {
  return { ok: false, status, error }
}

function failValidation(error: string, status: number): ValidateInviteResult {
  return { ok: false, status, error }
}

function normalizeInput(input: Partial<AcceptInviteInput>): AcceptInviteInput {
  return {
    token: typeof input.token === "string" ? input.token.trim() : "",
    password: typeof input.password === "string" ? input.password : "",
    repeatPassword: typeof input.repeatPassword === "string" ? input.repeatPassword : "",
  }
}

export async function validateInvitationToken(tokenValue: unknown): Promise<ValidateInviteResult> {
  try {
    const admin = createAdminClient()
    if (!admin) {
      return failValidation("SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.", 500)
    }

    const token = typeof tokenValue === "string" ? tokenValue.trim() : ""
    if (!token) {
      return failValidation("Token do convite não informado.", 400)
    }

    const db = admin as any
    const tokenHash = hashInvitationToken(token)

    const { data: invitation, error } = await db
      .from("user_invitations")
      .select("id, email, full_name, role, status, expires_at, accepted_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle()

    if (error) {
      return failValidation(error.message || "Erro ao validar convite.", 500)
    }

    if (!invitation) {
      return failValidation("Convite inválido.", 404)
    }

    if (invitation.status !== "pending" || invitation.accepted_at || invitation.revoked_at) {
      return failValidation("Este convite não está mais disponível.", 409)
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await db
        .from("user_invitations")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", invitation.id)
        .eq("status", "pending")

      return failValidation("Este convite expirou.", 410)
    }

    return {
      ok: true,
      status: 200,
      invitation: {
        email: invitation.email,
        fullName: invitation.full_name,
        role: invitation.role,
        expiresAt: invitation.expires_at,
      },
    }
  } catch (error: any) {
    return failValidation(error?.message ?? "Erro inesperado ao validar convite.", 500)
  }
}

export async function acceptInvitation(input: Partial<AcceptInviteInput>): Promise<AcceptInviteResult> {
  try {
    const admin = createAdminClient()
    if (!admin) {
      return fail("SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.", 500)
    }

    const { token, password, repeatPassword } = normalizeInput(input)

    if (!token) {
      return fail("Token do convite não informado.", 400)
    }

    if (!password || password.length < 6) {
      return fail("A senha deve ter pelo menos 6 caracteres.", 400)
    }

    if (password !== repeatPassword) {
      return fail("As senhas não coincidem.", 400)
    }

    const db = admin as any
    const tokenHash = hashInvitationToken(token)

    const { data: invitation, error: invitationError } = await db
      .from("user_invitations")
      .select("id, email, full_name, role, status, expires_at, accepted_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle()

    if (invitationError) {
      return fail(invitationError.message || "Erro ao validar convite.", 500)
    }

    if (!invitation) {
      return fail("Convite inválido.", 404)
    }

    if (invitation.status !== "pending" || invitation.accepted_at || invitation.revoked_at) {
      return fail("Este convite não está mais disponível.", 409)
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await db
        .from("user_invitations")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", invitation.id)
        .eq("status", "pending")

      return fail("Este convite expirou.", 410)
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
      return fail(
        createUserError?.message || "Não foi possível criar o usuário. Verifique se este e-mail já possui cadastro.",
        400,
      )
    }

    const now = new Date().toISOString()
    const { error: profileError } = await db.from("profiles").upsert(
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
      await admin.auth.admin.deleteUser(createdUser.user.id).catch(() => undefined)
      return fail(profileError.message || "Erro ao criar perfil do usuário.", 500)
    }

    const { error: acceptError } = await db
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
      await admin.auth.admin.deleteUser(createdUser.user.id).catch(() => undefined)
      return fail(acceptError.message || "Erro ao concluir convite.", 500)
    }

    return {
      ok: true,
      status: 200,
      signedIn: false,
      redirectTo: "/auth/login?registered=1",
    }
  } catch (error: any) {
    return fail(error?.message ?? "Erro inesperado ao aceitar convite.", 500)
  }
}

