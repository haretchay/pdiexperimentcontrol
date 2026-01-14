import type React from "react"

import { AppSidebar } from "@/components/app-sidebar"
import ClientAuthGate from "@/components/auth/client-auth-gate"
import { AuthProvider } from "@/components/auth-provider"
import { DatabaseActions } from "@/components/database-actions"
import { ThemeSelector } from "@/components/theme-selector"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

export const runtime = "nodejs"

// ✅ IMPORTANTe:
// Não fazemos mais redirect server-side com requireActiveUser aqui.
// No preview do v0, o SSR pode não enxergar os cookies de sessão,
// enquanto o client enxerga a sessão no localStorage, criando loop
// /auth/login -> /dashboard. O ClientAuthGate resolve isso no client.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <div className="flex h-full">
          <AppSidebar />

          <div className="flex-1 flex flex-col min-h-screen w-full max-w-full overflow-hidden">
            <header className="border-b bg-background sticky top-0 z-10">
              <div className="flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <div className="font-semibold">Dashboard</div>
                </div>

                <div className="flex items-center gap-2">
                  <DatabaseActions />
                  <ThemeSelector />
                </div>
              </div>
            </header>

            <main className="flex-1 w-full max-w-full overflow-hidden">
              <ClientAuthGate>{children}</ClientAuthGate>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AuthProvider>
  )
}
