import type React from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { AuthProvider } from "@/components/auth-provider"
import { DatabaseActions } from "@/components/database-actions"
import { ThemeSelector } from "@/components/theme-selector"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { requireActiveUser } from "@/lib/supabase/auth"

export const runtime = "nodejs"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const res = await requireActiveUser()

  if (!res.ok && res.reason === "rate_limit") {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Muitas requisições ao Supabase</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Você atingiu temporariamente o limite de requisições (429). Aguarde alguns segundos e recarregue.
        </p>
      </div>
    )
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
