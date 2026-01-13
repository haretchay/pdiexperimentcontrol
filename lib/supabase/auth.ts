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

export const getServerUser = cache(async () => {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase.auth.getUser()
    if (error && isRateLimitError(error)) {
      return {
        supabase,
        user: null,
        error,
        rateLimited: true,
      }
    }
    return {
      supabase,
      user: data.user ?? null,
      error: error ?? null,
      rateLimited: false,
    }
  } catch (err) {
    console.error("[auth] Exception in getServerUser:", err)
    return {
      supabase,
      user: null,
      error: err as any,
      rateLimited: isRateLimitError(err),
    }
  }
})

export const getServerProfile = cache(async (userId: string) => {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase.from("profiles").select("status, role").eq("user_id", userId).maybeSingle()

    return { supabase, profile: data ?? null, error: error ?? null }
  } catch (err) {
    console.error("[auth] Exception in getServerProfile:", err)
    return { supabase, profile: null, error: err as any }
  }
})

/**
 * Proteção "definitiva" para o grupo (app):
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
