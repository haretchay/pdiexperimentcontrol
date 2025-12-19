"use client"

import { useEffect } from "react"

interface PageTitleProps {
  title: string
}

export function PageTitle({ title }: PageTitleProps) {
  useEffect(() => {
    // Atualizar o título na barra superior
    const titleElement = document.getElementById("page-title")
    if (titleElement) {
      titleElement.textContent = title
    }

    return () => {
      // Limpar o título quando o componente for desmontado
      if (titleElement) {
        titleElement.textContent = ""
      }
    }
  }, [title])

  // Este componente não renderiza nada visível
  return null
}
