import type { NextApiRequest, NextApiResponse } from "next"

import { createAdminClient } from "@/lib/supabase/admin"

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

function isValidEmail(email: string) {
  return /^\S+@\S+\.\S+$/.test(email)
}

function noStore(res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
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
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: "Informe um e-mail válido." })
  }

  const { data: authorization, error } = await admin
    .from("user_invitations")
    .select("id, email, full_name, role, status, accepted_at, revoked_at, created_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return res.status(500).json({ ok: false, error: error.message || "Erro ao validar e-mail autorizado." })
  }

  if (!authorization) {
    return res.status(403).json({ ok: false, error: "Este e-mail não está autorizado para cadastro. Solicite liberação ao administrador." })
  }

  if (authorization.status === "accepted" || authorization.accepted_at) {
    return res.status(409).json({ ok: false, error: "Este e-mail já foi cadastrado. Acesse pelo login." })
  }

  if (authorization.status === "revoked" || authorization.revoked_at) {
    return res.status(403).json({ ok: false, error: "A autorização deste e-mail foi removida. Solicite uma nova liberação ao administrador." })
  }

  if (authorization.status !== "pending") {
    return res.status(403).json({ ok: false, error: "Este e-mail não possui uma autorização pendente para cadastro." })
  }

  return res.status(200).json({
    ok: true,
    authorization: {
      email: authorization.email,
      fullName: authorization.full_name,
      role: authorization.role,
    },
  })
}
