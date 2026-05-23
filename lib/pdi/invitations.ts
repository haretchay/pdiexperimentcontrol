import "server-only"

import { createHash, randomBytes } from "crypto"

export const INVITATION_TOKEN_BYTES = 32
export const INVITATION_DEFAULT_EXPIRES_DAYS = 7
export const INVITATION_MAX_EXPIRES_DAYS = 30

export const INVITATION_ROLES = ["user", "admin"] as const
export type InvitationRole = (typeof INVITATION_ROLES)[number]

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isInvitationRole(value: unknown): value is InvitationRole {
  return typeof value === "string" && (INVITATION_ROLES as readonly string[]).includes(value)
}

export function createInvitationToken() {
  return randomBytes(INVITATION_TOKEN_BYTES).toString("base64url")
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function getInvitationExpiresAt(days: number) {
  const safeDays = Number.isFinite(days)
    ? Math.min(Math.max(Math.floor(days), 1), INVITATION_MAX_EXPIRES_DAYS)
    : INVITATION_DEFAULT_EXPIRES_DAYS

  const date = new Date()
  date.setDate(date.getDate() + safeDays)
  return date.toISOString()
}

const DEFAULT_PRODUCTION_APP_URL = "https://pdiexperimentcontrol.vercel.app"

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/$/, "")
}

export function getAppBaseUrl(request?: Request) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL

  if (configured) return normalizeBaseUrl(configured)

  // Em produção, não usamos VERCEL_URL nem a origem da requisição, pois eles podem
  // apontar para deploy preview/protected deployment da Vercel, exigindo login.
  if (process.env.NODE_ENV === "production") {
    return DEFAULT_PRODUCTION_APP_URL
  }

  if (request) return new URL(request.url).origin

  return DEFAULT_PRODUCTION_APP_URL
}

export function buildInvitationUrl(token: string, request?: Request) {
  const baseUrl = getAppBaseUrl(request)
  return `${baseUrl}/auth/cadastro-convite?token=${encodeURIComponent(token)}`
}

export function formatInvitationDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
