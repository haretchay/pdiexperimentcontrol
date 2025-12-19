"use client"

import { useState, useEffect } from "react"

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Verificar se estamos no navegador
    if (typeof window !== "undefined") {
      // Função para verificar se é um dispositivo móvel
      const checkMobile = () => {
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
        const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i

        // Verificar se é um dispositivo móvel pelo userAgent ou pela largura da tela
        setIsMobile(mobileRegex.test(userAgent.toLowerCase()) || window.innerWidth < 768)
      }

      // Verificar inicialmente
      checkMobile()

      // Verificar quando a janela for redimensionada
      window.addEventListener("resize", checkMobile)

      // Limpar o event listener
      return () => {
        window.removeEventListener("resize", checkMobile)
      }
    }
  }, [])

  return isMobile
}
