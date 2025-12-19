"use client"

import { useState } from "react"

type ToastType = {
  title: string
  description: string
  variant?: "default" | "destructive"
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastType[]>([])

  const toast = (toast: ToastType) => {
    setToasts((prev) => [...prev, toast])

    // Remover o toast após 3 segundos
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t !== toast))
    }, 3000)

    // Mostrar o toast usando alert para esta versão simplificada
    alert(`${toast.title}: ${toast.description}`)
  }

  return { toast, toasts }
}
