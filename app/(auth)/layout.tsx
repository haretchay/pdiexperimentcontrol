import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Se NÃO está logado, pode acessar login/cadastro normalmente
  if (!user) {
    return <main className="min-h-svh w-full">{children}</main>
  }

  // Se está logado, checa perfil.
  // Se estiver bloqueado/inativo, NÃO redireciona (para permitir /auth/blocked abrir sem loop).
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!profile || profile.status !== "active") {
    return <main className="min-h-svh w-full">{children}</main>
  }

  // Usuário ativo logado não deve ver telas de auth
  redirect("/dashboard")
}
