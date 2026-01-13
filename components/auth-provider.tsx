"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // singleton client no browser
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let mounted = true

    // Sessão inicial (1x)
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return
        setUser(session?.user ?? null)
        setLoading(false)
      })
      .catch((e) => {
        // AbortError pode acontecer em navegação/hot reload
        if (e?.name !== "AbortError") console.error("[AuthProvider] getSession error:", e)
        if (!mounted) return
        setUser(null)
        setLoading(false)
      })

    // Mudanças de auth (filtrar eventos para não dar refresh toda hora)
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      setUser(session?.user ?? null)
      setLoading(false)

      // Só refresca em eventos relevantes (evita storm de requests)
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.refresh()
      }
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [supabase, router])

  const signOut = async () => {
    await supabase.auth.signOut()
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
