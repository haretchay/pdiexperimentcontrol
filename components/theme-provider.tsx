"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

type NextThemesProps = React.ComponentProps<typeof NextThemesProvider>
type ThemeProviderProps = NextThemesProps & { children: React.ReactNode }

/**
 * Centraliza a configuração do next-themes.
 * Importante: precisamos declarar explicitamente os temas customizados (neutral/pink),
 * senão o provider pode ignorar mudanças para nomes fora da lista padrão.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      // garante que os temas customizados sejam aplicados corretamente
      themes={["light", "dark", "neutral", "pink"]}
      // chave dedicada (evita conflito com outras apps no mesmo domínio)
      storageKey="pdie-theme"
      // evita flicker em transições quando alternar tema
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
