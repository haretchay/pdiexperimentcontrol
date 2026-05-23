import type { NextApiRequest, NextApiResponse } from "next"

import { createAdminClient } from "@/lib/supabase/admin"

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function isValidEmail(email: string) {
  return /^\S+@\S+\.\S+$/.test(email)
}

function noStore(res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
}

function formatAuthError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
    return "Este e-mail já possui cadastro. Acesse pelo login."
  }
  if (lower.includes("password")) {
    return "A senha informada não atende aos requisitos mínimos."
  }
  return message || "Não foi possível criar o usuário."
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  noStore(res)

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ ok: false, error: "Método não permitido." })
  }

  const admin = createAdminClient()
  if (!admin) {
    return res.status(500).json({ ok: false, error: "Configuração pendente: SUPABASE_SERVICE_ROLE_KEY não foi definida." })
  }

  const email = normalizeEmail(req.body?.email)
  const fullName = normalizeText(req.body?.fullName)
  const password = String(req.body?.password ?? "")
  const repeatPassword = String(req.body?.repeatPassword ?? "")

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: "Informe um e-mail válido." })
  }

  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: "A senha precisa ter pelo menos 6 caracteres." })
  }

  if (password !== repeatPassword) {
    return res.status(400).json({ ok: false, error: "As senhas não conferem." })
  }

  const { data: authorization, error: authorizationError } = await admin
    .from("user_invitations")
    .select("id, email, full_name, role, status, accepted_at, revoked_at, created_at")
    .eq("email", email)
    .eq("status", "pending")
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (authorizationError) {
    return res.status(500).json({ ok: false, error: authorizationError.message || "Erro ao validar autorização do e-mail." })
  }

  if (!authorization) {
    return res.status(403).json({ ok: false, error: "Este e-mail não está autorizado para cadastro ou já foi utilizado." })
  }

  const displayName = fullName || authorization.full_name || email
  const role = authorization.role === "admin" ? "admin" : "user"

  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: displayName,
      role,
      authorization_id: authorization.id,
    },
  })

  if (createUserError || !createdUser.user) {
    return res.status(400).json({ ok: false, error: formatAuthError(createUserError?.message ?? "Não foi possível criar o usuário.") })
  }

  const now = new Date().toISOString()

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      user_id: createdUser.user.id,
      full_name: displayName,
      role,
      status: "active",
      updated_at: now,
    },
    { onConflict: "user_id" },
  )

  if (profileError) {
    // Evita usuário órfão no Auth caso o profile não seja criado.
    await admin.auth.admin.deleteUser(createdUser.user.id).catch(() => undefined)
    return res.status(500).json({ ok: false, error: profileError.message || "Usuário criado, mas houve erro ao criar o perfil." })
  }

  await admin
    .from("user_invitations")
    .update({
      status: "accepted",
      accepted_user_id: createdUser.user.id,
      accepted_at: now,
      updated_at: now,
    })
    .eq("id", authorization.id)

  try {
    await admin.from("audit_logs").insert({
      actor_user_id: createdUser.user.id,
      actor_name: displayName,
      actor_email: email,
      action: "insert",
      entity_type: "user",
      entity_id: createdUser.user.id,
      entity_label: displayName,
      summary: `${displayName} concluiu o cadastro autorizado.`,
      metadata: { email, role, authorization_id: authorization.id },
    })
  } catch {
    // Log não deve impedir conclusão do cadastro.
  }

  return res.status(200).json({ ok: true, userId: createdUser.user.id })
}
