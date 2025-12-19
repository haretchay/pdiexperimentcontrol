"use client"
import { FlaskConical, ImageIcon, LayoutDashboard, Repeat, TestTube, Database, LogOut } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"

export function AppSidebar() {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  // Usar o hook useSidebar do componente shadcn/ui
  const { user, signOut } = useAuth()

  const routes = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      active: pathname === "/dashboard",
    },
    {
      href: "/experiments",
      label: "Experimentos",
      icon: FlaskConical,
      active: pathname === "/experiments" || pathname.startsWith("/experiments/"),
    },
    {
      href: "/repetitions",
      label: "Repetições",
      icon: Repeat,
      active: pathname === "/repetitions",
    },
    {
      href: "/tests",
      label: "Testes",
      icon: TestTube,
      active: pathname === "/tests",
    },
    {
      href: "/media",
      label: "Mídias",
      icon: ImageIcon,
      active: pathname === "/media",
    },
    {
      href: "/registers",
      label: "Cadastros",
      icon: Database,
      active: pathname === "/registers",
    },
  ]

  return (
    <Sidebar>
      <SidebarHeader className="flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-indigo-900/80 to-purple-900/80 rounded-lg p-3 shadow-lg w-full border border-indigo-700/30">
          <div className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 64 64"
              fill="none"
              className="mr-2"
            >
              <defs>
                <linearGradient id="petriGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#93C5FD" />
                  <stop offset="100%" stopColor="#D8B4FE" />
                </linearGradient>
                <linearGradient id="fungusGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#A5F3FC" />
                  <stop offset="100%" stopColor="#93C5FD" />
                </linearGradient>
                <linearGradient id="fungusGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#C4B5FD" />
                  <stop offset="100%" stopColor="#F0ABFC" />
                </linearGradient>
              </defs>

              {/* Placa de Petri Principal */}
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="rgba(255,255,255,0.1)"
                stroke="url(#petriGradient)"
                strokeWidth="2"
              />
              <circle
                cx="32"
                cy="32"
                r="24"
                fill="rgba(255,255,255,0.05)"
                stroke="url(#petriGradient)"
                strokeWidth="1"
              />

              {/* Colônias de Fungos na Placa Principal */}
              <path
                d="M28 24c3.5 0 6.5-2 6.5-5.5 0-3.5-3-5.5-6.5-5.5S21.5 15 21.5 18.5c0 3.5 3 5.5 6.5 5.5z"
                fill="url(#fungusGradient1)"
                opacity="0.8"
              />
              <path
                d="M24 36c-3.5 0-7 1.5-7 5 0 2.5 3.5 5 7 5s7-2.5 7-5c0-3.5-3.5-5-7-5z"
                fill="url(#fungusGradient2)"
                opacity="0.8"
              />
              <path
                d="M40 36c-3.5 0-7 1.5-7 5 0 2.5 3.5 5 7 5s7-2.5 7-5c0-3.5-3.5-5-7-5z"
                fill="url(#fungusGradient1)"
                opacity="0.8"
              />

              {/* Placa de Petri Secundária (Menor, Sobreposta) */}
              <circle
                cx="48"
                cy="20"
                r="12"
                fill="rgba(255,255,255,0.1)"
                stroke="url(#petriGradient)"
                strokeWidth="1.5"
              />
              <circle
                cx="48"
                cy="20"
                r="10"
                fill="rgba(255,255,255,0.05)"
                stroke="url(#petriGradient)"
                strokeWidth="0.75"
              />

              {/* Colônia de Fungo na Placa Secundária */}
              <path
                d="M48 20c2 0 3.5-1 3.5-3 0-2-1.5-3-3.5-3s-3.5 1-3.5 3c0 2 1.5 3 3.5 3z"
                fill="url(#fungusGradient2)"
                opacity="0.8"
              />

              {/* Placa de Petri Terciária (Menor, Sobreposta) */}
              <circle
                cx="16"
                cy="16"
                r="10"
                fill="rgba(255,255,255,0.1)"
                stroke="url(#petriGradient)"
                strokeWidth="1.5"
              />
              <circle
                cx="16"
                cy="16"
                r="8"
                fill="rgba(255,255,255,0.05)"
                stroke="url(#petriGradient)"
                strokeWidth="0.75"
              />

              {/* Colônia de Fungo na Placa Terciária */}
              <path
                d="M16 16c1.5 0 3-1 3-2.5 0-1.5-1.5-2.5-3-2.5s-3 1-3 2.5c0 1.5 1.5 2.5 3 2.5z"
                fill="url(#fungusGradient1)"
                opacity="0.8"
              />
            </svg>
            <div className="flex flex-col">
              <h1
                className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-purple-200"
                style={{ textShadow: "0 0 8px rgba(148, 163, 184, 0.3)" }}
              >
                Intellig Apps
              </h1>
              <span className="text-xs font-medium text-white">PDI - Test Control</span>
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {routes.map((route) => (
            <SidebarMenuItem key={route.href}>
              <SidebarMenuButton
                asChild
                isActive={route.active}
                onClick={() => {
                  if (isMobile) {
                    // Fechar o sidebar no modo móvel
                    setOpenMobile(false)
                  }
                }}
              >
                <Link href={route.href}>
                  <route.icon className="h-5 w-5" />
                  <span>{route.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4">
        {user && (
          <div className="space-y-2">
            <div className="text-xs text-white/70 truncate">{user.email}</div>
            <Button variant="ghost" size="sm" className="w-full justify-start text-white/70" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        )}
        <div className="text-xs text-center text-white/70">© {new Date().getFullYear()} Intellig Apps</div>
      </SidebarFooter>
    </Sidebar>
  )
}
