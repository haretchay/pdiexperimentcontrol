import type { NextApiRequest, NextApiResponse } from "next"

import { acceptInvitation } from "@/lib/pdi/invitation-accept-service"

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

function getValue(value: unknown) {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : ""
  return typeof value === "string" ? value : ""
}

function buildRedirectUrl(token: string, error: string) {
  const safeToken = encodeURIComponent(token.trim())
  const safeError = encodeURIComponent(error)
  return safeToken ? `/auth/convite/${safeToken}?error=${safeError}` : `/auth/login?inviteError=${safeError}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setHeaders(res)

  if (req.method === "OPTIONS") {
    return res.status(204).end()
  }

  if (req.method !== "POST") {
    return res.status(405).send("Método não permitido. Esta rota aceita POST.")
  }

  const token = getValue(req.body?.token)
  const password = getValue(req.body?.password)
  const repeatPassword = getValue(req.body?.repeatPassword)

  const result = await acceptInvitation({ token, password, repeatPassword })

  if (!result.ok) {
    res.writeHead(303, { Location: buildRedirectUrl(token, result.error) })
    return res.end()
  }

  res.writeHead(303, { Location: result.redirectTo || "/auth/login?registered=1" })
  return res.end()
}
