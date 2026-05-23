"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, KeyRound, Loader2, Lock, Mail, ShieldCheck, XCircle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ValidInvitation {
  email: string
  fullName: string | null
  role: string
  expiresAt: string
}

export default function AcceptInvitationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get("token")?.trim() ?? ""

  const [invitation, setInvitation] = useState<ValidInvitation | null>(null)
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const expiresAt = useMemo(() => {
    if (!invitation?.expiresAt) return "-"
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(invitation.expiresAt))
  }, [invitation?.expiresAt])

  useEffect(() => {
    let mounted = true

    async function validateToken() {
      setIsValidating(true)
      setError(null)

      if (!token) {
        setError("Link de convite inválido. Solicite um novo convite ao administrador.")
        setIsValidating(false)
        return
      }

      try {
        const response = await fetch(`/api/pdi/validate-invite?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        })
        const payload = (await response.json().catch(() => ({}))) as any

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "Não foi possível validar o convite.")
        }

        if (mounted) {
          setInvitation(payload.invitation)
        }
      } catch (err) {
        if (mounted) {
          setInvitation(null)
          setError(err instanceof Error ? err.message : "Não foi possível validar o convite.")
        }
      } finally {
        if (mounted) setIsValidating(false)
      }
    }

    validateToken()

    return () => {
      mounted = false
    }
  }, [token])

  async function submitInvitation(endpoint: string) {
    const response = await fetch(`${endpoint}?v=20260522_405_fix`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({ token, password, repeatPassword }),
      cache: "no-store",
    })

    const payload = (await response.json().catch(() => ({}))) as any
    return { response, payload }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password !== repeatPassword) {
      setError("As senhas não coincidem.")
      return
    }

    setIsSubmitting(true)
    try {
      const endpoints = [
        "/api/pdi/accept-invite",
        "/api/auth/invitations/accept",
        "/api/auth/accept-invitation",
        "/api/auth/accept-invitation-v2",
      ]

      let lastPayload: any = null
      let lastStatus = 0

      for (const endpoint of endpoints) {
        const { response, payload } = await submitInvitation(endpoint)
        lastPayload = payload
        lastStatus = response.status

        if (response.ok && payload?.ok) {
          router.push(payload.redirectTo || "/dashboard")
          router.refresh()
          return
        }

        // 404/405 normalmente indica rota antiga/cacheada no deploy. Tenta a próxima rota.
        if (response.status !== 404 && response.status !== 405) {
          break
        }
      }

      const defaultMessage =
        lastStatus === 404 || lastStatus === 405
          ? "A rota de aceite do convite não aceitou POST no deploy atual. Verifique se os arquivos do hotfix foram publicados."
          : "Não foi possível concluir o cadastro."

      throw new Error(lastPayload?.error || defaultMessage)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir o cadastro.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <Card className="w-full max-w-2xl overflow-hidden border-white/20 bg-white/10 text-white shadow-2xl backdrop-blur-md">
          <div className="h-2 bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-300" />
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 shadow-lg ring-1 ring-white/20">
              <ShieldCheck className="h-8 w-8 text-blue-100" />
            </div>
            <div>
              <CardTitle className="text-3xl font-bold tracking-tight">Cadastro por convite</CardTitle>
              <CardDescription className="mt-2 text-base text-white/75">
                Crie sua senha para acessar o PDI - Test Control.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {isValidating ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-10 text-white/80">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p>Validando convite...</p>
              </div>
            ) : error && !invitation ? (
              <div className="space-y-4 rounded-2xl border border-red-300/40 bg-red-500/15 p-6 text-center">
                <XCircle className="mx-auto h-10 w-10 text-red-100" />
                <p className="font-semibold">{error}</p>
                <Button asChild variant="secondary" className="bg-white text-slate-900 hover:bg-white/90">
                  <Link href="/auth/login">Voltar para o login</Link>
                </Button>
              </div>
            ) : invitation ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-white/55">Usuário autorizado</p>
                    <p className="flex items-center gap-2 font-semibold">
                      <Mail className="h-4 w-4 text-blue-100" />
                      {invitation.email}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-white/55">Perfil</p>
                    <p className="font-semibold capitalize">{invitation.role}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-white/55">Nome</p>
                    <p className="font-semibold">{invitation.fullName || "Não informado"}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-white/55">Validade do convite</p>
                    <p className="font-semibold">{expiresAt}</p>
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
                        className="border-white/20 bg-white text-slate-950 pl-9"
                        placeholder="Mínimo 6 caracteres"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="repeat-password" className="text-white">
                      Repetir senha
                    </Label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="repeat-password"
                        type="password"
                        required
                        minLength={6}
                        value={repeatPassword}
                        onChange={(event) => setRepeatPassword(event.target.value)}
                        className="border-white/20 bg-white text-slate-950 pl-9"
                        placeholder="Confirme sua senha"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 w-full bg-gradient-to-r from-blue-500 to-purple-600 text-base font-semibold shadow-lg hover:from-blue-600 hover:to-purple-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando cadastro...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-5 w-5" />
                      Criar minha conta
                    </>
                  )}
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

