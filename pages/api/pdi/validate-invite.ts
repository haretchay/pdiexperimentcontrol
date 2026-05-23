import type { NextApiRequest, NextApiResponse } from "next"

import { validateInvitationToken } from "@/lib/pdi/invitation-accept-service"

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

function setHeaders(res: NextApiResponse) {
  res.setHeader("Allow", "GET, OPTIONS")
  for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
    res.setHeader(key, value)
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  setHeaders(res)

  if (req.method === "OPTIONS") {
    return res.status(204).end()
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Método não permitido. Esta rota aceita GET." })
  }

  const token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token
  const result = await validateInvitationToken(token)

  if (!result.ok) {
    return res.status(result.status).json({ ok: false, error: result.error })
  }

  return res.status(200).json({ ok: true, invitation: result.invitation })
}
