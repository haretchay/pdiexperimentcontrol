import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

function isRateLimitError(err: unknown) {
  const status = (err as any)?.status
  const msg = String((err as any)?.message ?? err ?? "")
  const name = (err as any)?.name ?? ""

  return (
    status === 429 ||
    name === "AbortError" ||
    msg.includes("Too Many") ||
    msg.includes("Too many") ||
    msg.includes("rate limit") ||
    msg.includes("Unexpected token 'T'") ||
    msg.includes("signal is aborted")
  )
}

/**
 * Obtém (supabase client + user + profile) em UMA única instância de client.
 * Isso reduz chamadas duplicadas e ajuda a evitar 429.
 */
export const getServerAuth = cache(async () => {
  const supabase = await createClient()

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError && isRateLimitError(authError)) {
      return { supabase, user: null, profile: null, error: authError, rateLimited: true }
    }

    const user = authData.user ?? null
    if (!user) {
      return { supabase, user: null, profile: null, error: authError ?? null, rateLimited: false }
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("status, role")
      .eq("user_id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("[auth] profile error:", profileError)
    }

    return { supabase, user, profile: profile ?? null, error: authError ?? null, rateLimited: false }
  } catch (err) {
    console.error("[auth] Exception in getServerAuth:", err)
    return { supabase, user: null, profile: null, error: err as any, rateLimited: isRateLimitError(err) }
  }
})

/**
 * Compat: retorna apenas o usuário (reaproveita getServerAuth)
 */
export const getServerUser = cache(async () => {
  const { supabase, user, error, rateLimited } = await getServerAuth()
  return { supabase, user, error, rateLimited }
})

/**
 * Proteção "definitiva" para o grupo (app):
 * - garante usuário logado
 * - garante profile.status === "active"
 * - evita loops em caso de 429 (rate limit)
 */
export const requireActiveUser = cache(async () => {
  const { user, profile, error, rateLimited, supabase } = await getServerAuth()

  if (rateLimited) {
    // Não redireciona (evita loop). Quem chamar decide o que renderizar.
    return { ok: false as const, reason: "rate_limit" as const, supabase }
  }

  if (error) {
    console.error("[auth] getUser error:", error)
  }

  if (!user) {
    redirect("/auth/login")
  }

  if (!profile || profile.status !== "active") {
    redirect("/auth/blocked")
  }

  return { ok: true as const, supabase, user, profile }
})
