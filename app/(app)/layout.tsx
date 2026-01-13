import type React from "react"
import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { AuthProvider } from "@/components/auth-provider"
import { DatabaseActions } from "@/components/database-actions"
import { ThemeSelector } from "@/components/theme-selector"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  // 1) Autenticação
  const { data: authData, error: authError } = await supabase.auth.getUser()
  const user = authData.user

  if (authError) {
    console.error("[app layout] getUser error:", authError)
  }

  if (!user) {
    redirect("/auth/login")
  }

  // 2) Perfil (status/role)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("status, role")
    .eq("user_id", user.id)
    .maybeSingle()

  if (profileError) {
    console.error("[app layout] profile error:", profileError)
  }

  // Se não tiver perfil ou não estiver ativo → bloqueia
  if (!profile || profile.status !== "active") {
    redirect("/auth/blocked")
  }

  return (
    <AuthProvider>
      <SidebarProvider>
        <div className="flex h-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-h-screen w-full max-w-full overflow-hidden">
            <header className="border-b bg-background sticky top-0 z-10">
              <div className="flex h-16 items-center px-4 justify-between">
                <div className="flex items-center">
                  <SidebarTrigger />
                  <div id="page-title" className="ml-4 text-xl font-bold"></div>
                </div>
                <div className="flex items-center gap-2">
                  <DatabaseActions />
                  <ThemeSelector />
                </div>
              </div>
            </header>
            <main className="flex-1 w-full max-w-full overflow-hidden">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </AuthProvider>
  )
}
