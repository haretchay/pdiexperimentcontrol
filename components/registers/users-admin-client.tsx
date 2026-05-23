"use client"

import type React from "react"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  Check,
  Clipboard,
  Loader2,
  MailCheck,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface UserInvitationView {
  id: string
  email: string
  full_name: string | null
  role: string
  status: string
  invited_by: string | null
  accepted_user_id: string | null
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export interface ProfileUserView {
  user_id: string
  email: string | null
  full_name: string | null
  role: string
  status: string
  created_at: string
  updated_at: string
}

interface UsersAdminClientProps {
  invitations: UserInvitationView[]
  profiles: ProfileUserView[]
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function getAuthorizationStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Autorizado"
    case "accepted":
      return "Cadastrado"
    case "expired":
      return "Expirado"
    case "revoked":
      return "Removido"
    default:
      return status || "-"
  }
}

function getProfileStatusLabel(status: string) {
  switch (status) {
    case "active":
      return "Ativo"
    case "pending":
      return "Pendente"
    case "blocked":
      return "Bloqueado"
    default:
      return status || "-"
  }
}

function getRoleLabel(role: string) {
  return role === "admin" ? "Admin" : "Usuário"
}

function StatusBadge({ status }: { status: string }) {
  const statusClass = {
    pending: "border-blue-200 bg-blue-50 text-blue-700",
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
    expired: "border-slate-200 bg-slate-50 text-slate-600",
    revoked: "border-rose-200 bg-rose-50 text-rose-700",
    blocked: "border-rose-200 bg-rose-50 text-rose-700",
  }[status]

  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", statusClass)}>
      {status === "active" || status === "blocked" ? getProfileStatusLabel(status) : getAuthorizationStatusLabel(status)}
    </Badge>
  )
}

export function UsersAdminClient({ invitations, profiles }: UsersAdminClientProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("user")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [signUpUrl, setSignUpUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const stats = useMemo(() => {
    const authorized = invitations.filter((item) => item.status === "pending").length
    const registered = invitations.filter((item) => item.status === "accepted").length
    const activeUsers = profiles.filter((profile) => profile.status === "active").length
    const admins = profiles.filter((profile) => profile.role === "admin" && profile.status === "active").length

    return { authorized, registered, activeUsers, admins }
  }, [invitations, profiles])

  async function handleCreateAuthorization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setSignUpUrl(null)
    setCopied(false)
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, role }),
      })
      const payload = (await response.json().catch(() => ({}))) as any

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Não foi possível autorizar o cadastro.")
      }

      setSignUpUrl(payload.signUpUrl || `${window.location.origin}/auth/sign-up`)
      setSuccess("E-mail autorizado com sucesso. O usuário já pode acessar a tela de cadastro e criar a senha.")
      setEmail("")
      setFullName("")
      setRole("user")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível autorizar o cadastro.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCopySignUpUrl() {
    const url = signUpUrl || `${window.location.origin}/auth/sign-up`

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o link manualmente.")
    }
  }

  async function handleRevokeAuthorization(id: string) {
    setError(null)
    setSuccess(null)
    setRevokingId(id)

    try {
      const response = await fetch(`/api/admin/invitations/${id}/revoke`, { method: "POST" })
      const payload = (await response.json().catch(() => ({}))) as any

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Não foi possível remover a autorização.")
      }

      setSuccess("Autorização removida com sucesso.")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível remover a autorização.")
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-800 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white/80">
              <ShieldCheck className="h-4 w-4" />
              Cadastro liberado por e-mail autorizado
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Usuários</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              Cadastre previamente o e-mail do usuário. Depois, ele acessa a página pública de cadastro, informa o e-mail autorizado e cria a própria senha.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">Usuários ativos</p>
              <p className="mt-2 text-2xl font-bold">{stats.activeUsers}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">Admins</p>
              <p className="mt-2 text-2xl font-bold">{stats.admins}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">Autorizados</p>
              <p className="mt-2 text-2xl font-bold">{stats.authorized}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">Cadastrados</p>
              <p className="mt-2 text-2xl font-bold">{stats.registered}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card className="border-blue-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Autorizar novo cadastro
            </CardTitle>
            <CardDescription>
              O usuário só conseguirá criar conta se o e-mail estiver cadastrado aqui como autorizado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateAuthorization}>
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Ex.: Maria Silva"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail autorizado</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="usuario@empresa.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Função</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                  <Check className="h-4 w-4" />
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              {signUpUrl && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
                  <Label className="text-xs uppercase tracking-wide text-blue-700">Página pública de cadastro</Label>
                  <div className="mt-2 flex gap-2">
                    <Input readOnly value={signUpUrl} className="bg-white text-xs" />
                    <Button type="button" variant="outline" onClick={handleCopySignUpUrl} className="shrink-0">
                      {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-blue-800/75">
                    Esse link é sempre o mesmo. A segurança fica no e-mail previamente autorizado, não em token.
                  </p>
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full bg-gradient-to-r from-blue-600 to-purple-700 font-semibold hover:from-blue-700 hover:to-purple-800"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Autorizando...
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    Autorizar cadastro
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-purple-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MailCheck className="h-5 w-5 text-purple-600" />
              E-mails autorizados recentes
            </CardTitle>
            <CardDescription>Controle quem está autorizado, quem já concluiu o cadastro e autorizações removidas.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-2xl border">
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="sticky top-0 z-10 bg-gradient-to-r from-blue-50 to-purple-50 text-left text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Usuário</th>
                      <th className="px-4 py-3 font-semibold">Função</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Autorizado em</th>
                      <th className="px-4 py-3 font-semibold">Cadastro concluído</th>
                      <th className="px-4 py-3 text-right font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invitations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                          Nenhum e-mail autorizado ainda.
                        </td>
                      </tr>
                    ) : (
                      invitations.map((authorization) => (
                        <tr key={authorization.id} className="bg-white odd:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{authorization.full_name || "Sem nome"}</div>
                            <div className="text-xs text-muted-foreground">{authorization.email}</div>
                          </td>
                          <td className="px-4 py-3">{getRoleLabel(authorization.role)}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={authorization.status} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatDate(authorization.created_at)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatDate(authorization.accepted_at)}</td>
                          <td className="px-4 py-3 text-right">
                            {authorization.status === "pending" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={revokingId === authorization.id}
                                onClick={() => handleRevokeAuthorization(authorization.id)}
                                className="border-rose-200 text-rose-700 hover:bg-rose-50"
                              >
                                {revokingId === authorization.id ? (
                                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <XCircle className="mr-2 h-3.5 w-3.5" />
                                )}
                                Remover
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Users className="h-5 w-5 text-slate-700" />
            Usuários cadastrados
          </CardTitle>
          <CardDescription>Lista dos perfis ativos ou pendentes já registrados no sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-2xl border">
            <div className="overflow-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Usuário</th>
                    <th className="px-4 py-3 font-semibold">E-mail</th>
                    <th className="px-4 py-3 font-semibold">Função</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Criado em</th>
                    <th className="px-4 py-3 font-semibold">Atualizado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {profiles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                        Nenhum perfil encontrado.
                      </td>
                    </tr>
                  ) : (
                    profiles.map((profile) => (
                      <tr key={profile.user_id} className="bg-white odd:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <UserCog className="h-4 w-4 text-slate-500" />
                            {profile.full_name || "Sem nome"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{profile.email || "-"}</td>
                        <td className="px-4 py-3">{getRoleLabel(profile.role)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={profile.status} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(profile.created_at)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(profile.updated_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
