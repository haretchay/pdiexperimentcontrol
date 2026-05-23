import Link from "next/link"
import { CheckCircle2, KeyRound, Lock, Mail, ShieldCheck, XCircle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { validateInvitationToken } from "@/lib/pdi/invitation-accept-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

type PageProps = {
  searchParams?: {
    token?: string | string[]
    error?: string | string[]
  }
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function decodeError(value: string | undefined) {
  if (!value) return null

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export default async function AcceptInvitationPage({ searchParams }: PageProps) {
  const token = (firstParam(searchParams?.token) ?? "").trim()
  const formError = decodeError(firstParam(searchParams?.error))
  const result = await validateInvitationToken(token)

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
            {!result.ok ? (
              <div className="space-y-4 rounded-2xl border border-red-300/40 bg-red-500/15 p-6 text-center">
                <XCircle className="mx-auto h-10 w-10 text-red-100" />
                <p className="font-semibold">{result.error}</p>
                <Button asChild variant="secondary" className="bg-white text-slate-900 hover:bg-white/90">
                  <Link href="/auth/login">Voltar para o login</Link>
                </Button>
              </div>
            ) : (
              <form action="/api/pdi/accept-invite-form" method="post" className="space-y-5">
                <input type="hidden" name="token" value={token} />

                <div className="grid gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-white/55">Usuário autorizado</p>
                    <p className="flex items-center gap-2 font-semibold">
                      <Mail className="h-4 w-4 text-blue-100" />
                      {result.invitation.email}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-white/55">Perfil</p>
                    <p className="font-semibold capitalize">{result.invitation.role}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-white/55">Nome</p>
                    <p className="font-semibold">{result.invitation.fullName || "Não informado"}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-white/55">Validade do convite</p>
                    <p className="font-semibold">{formatDate(result.invitation.expiresAt)}</p>
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
                        name="password"
                        type="password"
                        required
                        minLength={6}
                        className="border-white/20 bg-white pl-9 text-slate-950"
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
                        name="repeatPassword"
                        type="password"
                        required
                        minLength={6}
                        className="border-white/20 bg-white pl-9 text-slate-950"
                        placeholder="Confirme sua senha"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                </div>

                {formError && (
                  <Alert variant="destructive">
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="h-12 w-full bg-gradient-to-r from-blue-500 to-purple-600 text-base font-semibold shadow-lg hover:from-blue-600 hover:to-purple-700"
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Criar minha conta
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

