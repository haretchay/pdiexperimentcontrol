import type { NextApiRequest, NextApiResponse } from "next"
import { createHash } from "crypto"

import { createAdminClient } from "@/lib/supabase/admin"

type ApiResponse =
  | { ok: true; signedIn: false; redirectTo: string }
  | { ok: false; error: string }

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

function setBaseHeaders(res: NextApiResponse) {
  res.setHeader("Allow", "POST, OPTIONS")
  for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
    res.setHeader(key, value)
  }
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

function getBody(req: NextApiRequest) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }

  if (req.body && typeof req.body === "object") return req.body as Record<string, unknown>
  return {}
}

function jsonError(res: NextApiResponse<ApiResponse>, message: string, status: number) {
  setBaseHeaders(res)
  return res.status(status).json({ ok: false, error: message })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  setBaseHeaders(res)

  if (req.method === "OPTIONS") return res.status(204).end()

  if (req.method !== "POST") {
    return jsonError(res, "Método não permitido. Use POST para concluir o cadastro por convite.", 405)
  }

  try {
    const admin = createAdminClient()
    if (!admin) {
      return jsonError(res, "SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.", 500)
    }

    const body = getBody(req)
    const token = typeof body.token === "string" ? body.token.trim() : ""
    const password = typeof body.password === "string" ? body.password : ""
    const repeatPassword = typeof body.repeatPassword === "string" ? body.repeatPassword : ""

    if (!token) return jsonError(res, "Token do convite não informado.", 400)
    if (!password || password.length < 6) return jsonError(res, "A senha deve ter pelo menos 6 caracteres.", 400)
    if (password !== repeatPassword) return jsonError(res, "As senhas não coincidem.", 400)

    const db = admin as any
    const tokenHash = hashInvitationToken(token)

    const { data: invitation, error: invitationError } = await db
      .from("user_invitations")
      .select("id, email, full_name, role, status, expires_at, accepted_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle()

    if (invitationError) return jsonError(res, invitationError.message || "Erro ao validar convite.", 500)
    if (!invitation) return jsonError(res, "Convite inválido.", 404)

    if (invitation.status !== "pending" || invitation.accepted_at || invitation.revoked_at) {
      return jsonError(res, "Este convite não está mais disponível.", 409)
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await db
        .from("user_invitations")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", invitation.id)
        .eq("status", "pending")

      return jsonError(res, "Este convite expirou.", 410)
    }

    // Evita criar usuário duplicado se o mesmo e-mail já existir no Auth.
    const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers()
    if (listError) return jsonError(res, listError.message || "Erro ao verificar usuário existente.", 500)

    const existingUser = existingUsers.users.find(
      (user) => user.email?.trim().toLowerCase() === String(invitation.email).trim().toLowerCase(),
    )

    if (existingUser) {
      return jsonError(res, "Este e-mail já possui cadastro no sistema. Use a tela de login.", 409)
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
        res,
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
      return jsonError(res, profileError.message || "Erro ao criar perfil do usuário.", 500)
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

    if (acceptError) return jsonError(res, acceptError.message || "Erro ao concluir convite.", 500)

    return res.status(200).json({ ok: true, signedIn: false, redirectTo: "/auth/login" })
  } catch (error: any) {
    return jsonError(res, error?.message ?? "Erro inesperado ao aceitar convite.", 500)
  }
}
