"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Eye, EyeOff, Lock, LogIn } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Gradiente do título (mesmo padrão Intellig Apps)
  const logoTitleStyle = useMemo(
    () => ({
      background: "linear-gradient(135deg, #60a5fa 0%, #c084fc 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      textFillColor: "transparent",
      filter: "drop-shadow(0px 0px 6px rgba(255, 255, 255, 0.5))",
      fontWeight: "bold",
    }),
    [],
  )

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push("/dashboard")
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Ocorreu um erro")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 flex items-center justify-center p-4 md:overflow-auto overflow-hidden">
      <Card className="w-full max-w-md shadow-xl bg-transparent border border-white/20 backdrop-blur-md">
        <CardHeader className="text-center">
          <div className="flex flex-col items-center justify-center mb-2">
            {/* Logo (equivalente ao Projeto RF) */}
            <svg
              className="w-32 h-32 drop-shadow-[0_0_18px_rgba(255,255,255,0.25)]"
              viewBox="0 0 120 120"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="60" cy="36" r="10" fill="rgba(255,255,255,0.85)" />
              <circle cx="34" cy="44" r="6" fill="rgba(255,255,255,0.65)" />
              <circle cx="86" cy="44" r="6" fill="rgba(255,255,255,0.65)" />
              <circle cx="46" cy="22" r="5" fill="rgba(255,255,255,0.55)" />
              <circle cx="74" cy="22" r="5" fill="rgba(255,255,255,0.55)" />
              <path
                d="M40 44 L54 36 M80 44 L66 36 M46 22 L56 32 M74 22 L64 32"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M26 74h68a6 6 0 0 1 6 6v18H20V80a6 6 0 0 1 6-6Z"
                fill="rgba(255,255,255,0.12)"
                stroke="rgba(255,255,255,0.25)"
              />
              <path d="M30 82h60" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
              <path d="M30 90h60" stroke="rgba(255,255,255,0.20)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <CardTitle className="text-3xl" style={logoTitleStyle}>
            Intellig Apps
          </CardTitle>
          <CardDescription className="text-base mt-1 text-white/80">Aplicativos Inteligentes</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">
                  E-mail
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">@</span>
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@admin.br"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">
                  Senha
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-500" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-8"
                    autoComplete="current-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Entrando...
                  </span>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" /> Entrar
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center text-white/70 text-sm">
              <p>Projeto PDI - Controle de Testes</p>
            </div>

            <div className="mt-4 text-center text-sm text-white/70">
              Não tem uma conta?{" "}
              <Link href="/auth/sign-up" className="underline underline-offset-4 text-white">
                Cadastre-se
              </Link>
            </div>
          </CardContent>
        <CardFooter className="flex justify-center text-sm text-white/70">Intellig Apps v1.0</CardFooter>
      </Card>
    </div>
  )
}
