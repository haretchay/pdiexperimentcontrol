"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/client"

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode
  initialUser?: User | null
}) {
  const [user, setUser] = useState<User | null>(initialUser ?? null)
  const [loading, setLoading] = useState(initialUser ? false : true)
  const router = useRouter()

  // singleton client no browser
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let mounted = true

    // Sessão inicial (1x)
    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        const session = data.session
        if (!mounted) return
        setUser(session?.user ?? null)
        setLoading(false)
      })
      .catch((e: unknown) => {
        // AbortError pode acontecer em navegação/hot reload
        const errorName = e instanceof Error ? e.name : ""
        const errorMessage = e instanceof Error ? e.message : String(e ?? "")
        const msg = String(errorMessage)
        if (errorName !== "AbortError") console.error("[AuthProvider] getSession error:", e)

        // Preview/domínios diferentes às vezes ficam com refresh_token antigo no storage.
        // Se não limpamos, o supabase-js tenta refresh em loop e o preview vira "instável".
        if (msg.includes("refresh_token_not_found") || msg.includes("Invalid Refresh Token")) {
          supabase.auth
            .signOut({ scope: "local" as any })
            .catch(() => {})
            .finally(() => {
              if (!mounted) return
              setUser(null)
              setLoading(false)
              router.push("/auth/login")
              router.refresh()
            })
          return
        }

        if (!mounted) return
        setUser(null)
        setLoading(false)
      })

    // Mudanças de auth (filtrar eventos para não dar refresh toda hora)
    const { data } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!mounted) return

      setUser(session?.user ?? null)
      setLoading(false)

      // Só refresca em eventos relevantes (evita storm de requests)
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.refresh()
      }

      if (event === "SIGNED_OUT") {
        router.push("/auth/login")
      }
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [supabase, router])

  const signOut = async () => {
    // Sempre derruba a sessão baseada em cookie (SSR)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // ignore
    }
    // Também derruba a sessão do cliente (localStorage) se existir
    try {
      await supabase.auth.signOut()
    } catch {
      // ignore
    }

    router.push("/auth/login")
    router.refresh()
  }

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
