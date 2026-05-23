import type { NextApiRequest, NextApiResponse } from "next"

import { acceptInvitation } from "@/lib/pdi/invitation-accept-service"

type ApiResponse =
  | { ok: true; signedIn: false; redirectTo: string }
  | { ok: false; error: string }

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

function setHeaders(res: NextApiResponse) {
  res.setHeader("Allow", "POST, OPTIONS")
  for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
    res.setHeader(key, value)
  }
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

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  setHeaders(res)

  if (req.method === "OPTIONS") {
    return res.status(204).end()
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Método não permitido. Esta rota aceita POST para concluir o cadastro por convite.",
    })
  }

  const result = await acceptInvitation(getBody(req))

  if (!result.ok) {
    return res.status(result.status).json({ ok: false, error: result.error })
  }

  return res.status(200).json({ ok: true, signedIn: false, redirectTo: result.redirectTo })
}
