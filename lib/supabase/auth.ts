import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

function isRateLimitError(err: unknown) {
  const status = (err as any)?.status
  const msg = String((err as any)?.message ?? err ?? "")

  return (
    status === 429 ||
    msg.includes("Too Many") ||
    msg.includes("Too many") ||
    msg.includes("rate limit") ||
    msg.includes("Unexpected token 'T'")
  )
}

export const getServerUser = cache(async () => {
  const supabase = createClient()

  try {
    const { data, error } = await supabase.auth.getUser()
    return {
      supabase,
      user: data.user ?? null,
      error: error ?? null,
      rateLimited: error ? isRateLimitError(error) : false,
    }
  } catch (err) {
    return {
      supabase,
      user: null,
      error: err as any,
      rateLimited: isRateLimitError(err),
    }
  }
})

export const getServerProfile = cache(async (userId: string) => {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("profiles")
    .select("status, role")
    .eq("user_id", userId)
    .maybeSingle()

  return { supabase, profile: data ?? null, error: error ?? null }
})

/**
 * Proteção “definitiva” para o grupo (app):
 * - garante usuário logado
 * - garante profile.status === "active"
 * - evita loops em caso de 429 (rate limit)
 */
export const requireActiveUser = cache(async () => {
  const { user, error, rateLimited, supabase } = await getServerUser()

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

  const { profile, error: profileError } = await getServerProfile(user.id)

  if (profileError) {
    console.error("[auth] profile error:", profileError)
  }

  if (!profile || profile.status !== "active") {
    redirect("/auth/blocked")
  }

  return { ok: true as const, supabase, user, profile }
})
