import type { NextApiRequest, NextApiResponse } from "next"
import { createHash } from "crypto"

import { createAdminClient } from "@/lib/supabase/admin"

type ApiResponse =
  | {
      ok: true
      invitation: {
        email: string
        fullName: string | null
        role: string
        expiresAt: string
      }
    }
  | { ok: false; error: string }

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

function setBaseHeaders(res: NextApiResponse) {
  res.setHeader("Allow", "GET, OPTIONS")
  for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
    res.setHeader(key, value)
  }
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

function jsonError(res: NextApiResponse<ApiResponse>, message: string, status: number) {
  setBaseHeaders(res)
  return res.status(status).json({ ok: false, error: message })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  setBaseHeaders(res)

  if (req.method === "OPTIONS") return res.status(204).end()

  if (req.method !== "GET") {
    return jsonError(res, "Método não permitido. Use GET para validar o convite.", 405)
  }

  try {
    const admin = createAdminClient()
    if (!admin) {
      return jsonError(res, "SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.", 500)
    }

    const token = typeof req.query.token === "string" ? req.query.token.trim() : ""
    if (!token) return jsonError(res, "Token do convite não informado.", 400)

    const tokenHash = hashInvitationToken(token)
    const db = admin as any

    const { data: invitation, error } = await db
      .from("user_invitations")
      .select("id, email, full_name, role, status, expires_at, accepted_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle()

    if (error) return jsonError(res, error.message || "Erro ao validar convite.", 500)
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

    return res.status(200).json({
      ok: true,
      invitation: {
        email: invitation.email,
        fullName: invitation.full_name,
        role: invitation.role,
        expiresAt: invitation.expires_at,
      },
    })
  } catch (error: any) {
    return jsonError(res, error?.message ?? "Erro inesperado ao validar convite.", 500)
  }
}
