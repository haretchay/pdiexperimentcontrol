"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

type NextThemesProps = React.ComponentProps<typeof NextThemesProvider>

// Força children (algumas versões do next-themes não tipam children corretamente)
type ThemeProviderProps = NextThemesProps & { children: React.ReactNode }

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
