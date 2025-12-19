import type React from "react"
import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { AuthProvider } from "@/components/auth-provider"
import { DatabaseActions } from "@/components/database-actions"
import { ThemeSelector } from "@/components/theme-selector"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { createClient } from "@/lib/supabase/server"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
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
