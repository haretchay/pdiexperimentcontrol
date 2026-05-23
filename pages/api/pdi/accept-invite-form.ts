import type { NextApiRequest, NextApiResponse } from "next"

import { acceptInvitation } from "@/lib/pdi/invitation-accept-service"

function getString(value: unknown) {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : ""
  return typeof value === "string" ? value : ""
}

function inviteUrl(token: string, error?: string) {
  const params = new URLSearchParams()
  if (token) params.set("token", token)
  if (error) params.set("error", error)

  const query = params.toString()
  return query ? `/auth/invite?${query}` : "/auth/invite"
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
  res.setHeader("Allow", "POST, OPTIONS")

  if (req.method === "OPTIONS") {
    return res.status(204).end()
  }

  if (req.method !== "POST") {
    return res.redirect(303, "/auth/invite")
  }

  const token = getString(req.body?.token).trim()
  const password = getString(req.body?.password)
  const repeatPassword = getString(req.body?.repeatPassword)

  const result = await acceptInvitation({ token, password, repeatPassword })

  if (!result.ok) {
    return res.redirect(303, inviteUrl(token, result.error))
  }

  return res.redirect(303, result.redirectTo || "/auth/login?registered=1")
}
