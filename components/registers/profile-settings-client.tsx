"use client"

import type React from "react"

import { useState } from "react"
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, UserRound } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ProfileSettingsClientProps {
  email: string
  initialFullName: string
  role: string
  status: string
}

function roleLabel(role: string) {
  return role === "admin" ? "Admin" : "Usuário"
}

function statusLabel(status: string) {
  if (status === "active") return "Ativo"
  if (status === "blocked") return "Bloqueado"
  if (status === "pending") return "Pendente"
  return status || "-"
}

export function ProfileSettingsClient({ email, initialFullName, role, status }: ProfileSettingsClientProps) {
  const [fullName, setFullName] = useState(initialFullName)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [repeatNewPassword, setRepeatNewPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showRepeatPassword, setShowRepeatPassword] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const willChangePassword = Boolean(currentPassword || newPassword || repeatNewPassword)

    if (willChangePassword) {
      if (!currentPassword) {
        setError("Informe a senha atual para alterar a senha.")
        return
      }

      if (newPassword.length < 6) {
        setError("A nova senha precisa ter pelo menos 6 caracteres.")
        return
      }

      if (newPassword !== repeatNewPassword) {
        setError("A repetição da nova senha não confere.")
        return
      }

      if (currentPassword === newPassword) {
        setError("A nova senha deve ser diferente da senha atual.")
        return
      }
    }

    setIsSaving(true)

    try {
      const response = await fetch("/api/pdi/update-own-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, currentPassword, newPassword, repeatNewPassword }),
      })
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string }

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Não foi possível atualizar seu cadastro.")
      }

      setSuccess(willChangePassword ? "Cadastro e senha atualizados com sucesso." : "Cadastro atualizado com sucesso.")
      setCurrentPassword("")
      setNewPassword("")
      setRepeatNewPassword("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar seu cadastro.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-800 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white/80">
              <ShieldCheck className="h-4 w-4" /> Cadastro pessoal
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Meu Cadastro</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              Atualize seus dados básicos e altere sua senha com confirmação da senha atual.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[520px]">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">E-mail</p>
              <p className="mt-2 break-all text-sm font-semibold">{email}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">Função</p>
              <p className="mt-2 text-lg font-bold">{roleLabel(role)}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">Status</p>
              <p className="mt-2 text-lg font-bold">{statusLabel(status)}</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Card className="rounded-2xl border-blue-100/80 shadow-sm dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserRound className="h-5 w-5 text-blue-600" /> Dados do usuário
            </CardTitle>
            <CardDescription>Seu e-mail é usado no login e não pode ser alterado nesta tela.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profileEmail">E-mail</Label>
              <Input id="profileEmail" type="email" value={email} disabled className="bg-slate-50" autoComplete="username" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Seu nome completo"
                autoComplete="name"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-purple-100/80 shadow-sm dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <KeyRound className="h-5 w-5 text-purple-600" /> Alterar senha
            </CardTitle>
            <CardDescription>
              Para alterar a senha, informe a senha atual, a nova senha e repita a nova senha.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Senha atual</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Informe sua senha atual"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowCurrentPassword((value) => !value)}
                  aria-label={showCurrentPassword ? "Ocultar senha atual" : "Mostrar senha atual"}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowNewPassword((value) => !value)}
                    aria-label={showNewPassword ? "Ocultar nova senha" : "Mostrar nova senha"}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="repeatNewPassword">Repetir nova senha</Label>
                <div className="relative">
                  <Input
                    id="repeatNewPassword"
                    type={showRepeatPassword ? "text" : "password"}
                    value={repeatNewPassword}
                    onChange={(event) => setRepeatNewPassword(event.target.value)}
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Confirme a nova senha"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowRepeatPassword((value) => !value)}
                    aria-label={showRepeatPassword ? "Ocultar repetição da senha" : "Mostrar repetição da senha"}
                  >
                    {showRepeatPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {success ? (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="submit"
              disabled={isSaving}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Salvar alterações
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
