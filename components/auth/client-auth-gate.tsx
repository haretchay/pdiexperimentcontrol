"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function ClientAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true

    async function run() {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getSession()

        const hasSession = !!data.session

        // Se não há sessão, vai para login (mas evita loop se já está em /auth)
        if (!hasSession && !pathname.startsWith("/auth")) {
          router.replace("/auth/login")
          return
        }

        if (alive) setReady(true)
      } catch {
        // Em preview instável, não derruba a navegação; apenas mostra loading
        if (alive) setReady(true)
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [router, pathname])

  if (!ready) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Carregando sessão...</div>
      </div>
    )
  }

  return <>{children}</>
}
