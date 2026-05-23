"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Lock, Mail, ShieldCheck, User } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AuthorizedEmailPayload {
  ok: boolean
  error?: string
  authorization?: {
    email: string
    fullName: string | null
    role: string
  }
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function getRoleLabel(role: string) {
  return role === "admin" ? "Admin" : "Usuário"
}

export default function SignUpPage() {
  const router = useRouter()
  const [step, setStep] = useState<"email" | "password">("email")
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("user")
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  async function handleCheckEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsChecking(true)

    try {
      const normalizedEmail = normalizeEmail(email)
      const response = await fetch("/api/pdi/check-authorized-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      })
      const payload = (await response.json().catch(() => ({}))) as AuthorizedEmailPayload

      if (!response.ok || !payload.ok || !payload.authorization) {
        throw new Error(payload.error || "Este e-mail não está autorizado para cadastro.")
      }

      setEmail(payload.authorization.email)
      setFullName(payload.authorization.fullName ?? "")
      setRole(payload.authorization.role || "user")
      setStep("password")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível validar o e-mail.")
    } finally {
      setIsChecking(false)
    }
  }

  async function handleCreateAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password !== repeatPassword) {
      setError("As senhas não conferem.")
      return
    }

    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.")
      return
    }

    setIsCreating(true)

    try {
      const response = await fetch("/api/pdi/register-authorized-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(email), fullName, password, repeatPassword }),
      })
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string }

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Não foi possível concluir o cadastro.")
      }

      router.push("/auth/sign-up-success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir o cadastro.")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center justify-center">
        <Card className="w-full max-w-2xl overflow-hidden border-white/20 bg-white/10 text-white shadow-2xl backdrop-blur-md">
          <div className="h-2 bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-300" />
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 shadow-lg ring-1 ring-white/20">
              <ShieldCheck className="h-8 w-8 text-blue-100" />
            </div>
            <CardTitle className="text-3xl">Cadastro autorizado</CardTitle>
            <CardDescription className="text-base text-white/75">
              Informe seu e-mail. O cadastro só será liberado se o administrador já tiver autorizado esse e-mail no sistema.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {step === "email" ? (
              <form onSubmit={handleCheckEmail} className="space-y-5">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-5">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20">
                      <Mail className="h-5 w-5 text-blue-100" />
                    </div>
                    <div>
                      <h2 className="font-semibold">Primeira etapa: validar e-mail</h2>
                      <p className="mt-1 text-sm leading-6 text-white/75">
                        O administrador cadastra previamente o e-mail autorizado. Depois disso, o usuário pode criar a própria senha nesta tela.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">
                    E-mail autorizado
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-12 border-white/20 bg-white pl-9 text-slate-950"
                      placeholder="usuario@empresa.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={isChecking}
                  className="h-12 w-full bg-gradient-to-r from-blue-500 to-purple-600 text-base font-semibold hover:from-blue-600 hover:to-purple-700"
                >
                  {isChecking ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                  Validar e-mail
                </Button>
              </form>
            ) : (
              <form onSubmit={handleCreateAccount} className="space-y-5">
                <div className="grid gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-white/55">E-mail autorizado</p>
                    <p className="flex items-center gap-2 font-semibold">
                      <Mail className="h-4 w-4 text-blue-100" />
                      {email}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-white/55">Perfil</p>
                    <p className="font-semibold">{getRoleLabel(role)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-white">
                    Nome completo
                  </Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="h-12 border-white/20 bg-white pl-9 text-slate-950"
                      placeholder="Seu nome completo"
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-white">
                      Senha
                    </Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="password"
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="h-12 border-white/20 bg-white pl-9 text-slate-950"
                        placeholder="Mínimo 6 caracteres"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="repeatPassword" className="text-white">
                      Repetir senha
                    </Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="repeatPassword"
                        type="password"
                        required
                        minLength={6}
                        value={repeatPassword}
                        onChange={(event) => setRepeatPassword(event.target.value)}
                        className="h-12 border-white/20 bg-white pl-9 text-slate-950"
                        placeholder="Confirme sua senha"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setStep("email")
                      setPassword("")
                      setRepeatPassword("")
                      setError(null)
                    }}
                    className="h-12 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Trocar e-mail
                  </Button>

                  <Button
                    type="submit"
                    disabled={isCreating}
                    className="h-12 bg-gradient-to-r from-blue-500 to-purple-600 text-base font-semibold hover:from-blue-600 hover:to-purple-700"
                  >
                    {isCreating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                    Criar minha conta
                  </Button>
                </div>
              </form>
            )}

            <div className="text-center text-sm text-white/70">
              Já possui conta?{" "}
              <Link href="/auth/login" className="font-medium text-white underline underline-offset-4">
                Entrar
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
