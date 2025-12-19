"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface MainNavProps {
  className?: string
}

export function MainNav({ className }: MainNavProps) {
  const pathname = usePathname()

  const routes = [
    {
      href: "/experiments",
      label: "Experimentos",
      active: pathname === "/experiments" || pathname.startsWith("/experiments/"),
    },
    {
      href: "/repetitions",
      label: "Repetições",
      active: pathname === "/repetitions",
    },
    {
      href: "/tests",
      label: "Testes",
      active: pathname === "/tests",
    },
    {
      href: "/media",
      label: "Mídias",
      active: pathname === "/media",
    },
    {
      href: "/dashboard",
      label: "Dashboard",
      active: pathname === "/dashboard",
    },
  ]

  return (
    <nav className={cn("flex items-center space-x-4 lg:space-x-6", className)}>
      {routes.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            route.active ? "text-primary" : "text-muted-foreground",
          )}
        >
          {route.label}
        </Link>
      ))}
    </nav>
  )
}
