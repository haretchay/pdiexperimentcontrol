"use client"

import type React from "react"

import { Fragment, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  Check,
  Clipboard,
  Clock,
  KeyRound,
  Loader2,
  MailPlus,
  ShieldCheck,
  UserCog,
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

function getInvitationStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Pendente"
    case "accepted":
      return "Aceito"
    case "expired":
      return "Expirado"
    case "revoked":
      return "Revogado"
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

function StatusBadge({ status }: { status: string }) {
  const statusClass = {
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
    expired: "border-slate-200 bg-slate-50 text-slate-600",
    revoked: "border-rose-200 bg-rose-50 text-rose-700",
    blocked: "border-rose-200 bg-rose-50 text-rose-700",
  }[status]

  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", statusClass)}>
      {status === "active" || status === "blocked" ? getProfileStatusLabel(status) : getInvitationStatusLabel(status)}
    </Badge>
  )
}

export function UsersAdminClient({ invitations, profiles }: UsersAdminClientProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("user")
  const [expiresDays, setExpiresDays] = useState("7")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [copyingInvitationId, setCopyingInvitationId] = useState<string | null>(null)
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(null)
  const [expandedInvitationId, setExpandedInvitationId] = useState<string | null>(null)
  const [generatedInviteUrls, setGeneratedInviteUrls] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)

  const stats = useMemo(() => {
    const pending = invitations.filter((item) => item.status === "pending").length
    const accepted = invitations.filter((item) => item.status === "accepted").length
    const activeUsers = profiles.filter((profile) => profile.status === "active").length
    const admins = profiles.filter((profile) => profile.role === "admin" && profile.status === "active").length

    return { pending, accepted, activeUsers, admins }
  }, [invitations, profiles])

  async function handleCreateInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setInviteUrl(null)
    setCopied(false)
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, role, expiresDays: Number(expiresDays) || 7 }),
      })
      const payload = (await response.json().catch(() => ({}))) as any

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Não foi possível criar o convite.")
      }

      setInviteUrl(payload.inviteUrl)
      setSuccess("Convite criado com sucesso. Copie o link e envie ao usuário autorizado.")
      setEmail("")
      setFullName("")
      setRole("user")
      setExpiresDays("7")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o convite.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCopyInvitation() {
    if (!inviteUrl) return

    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o link manualmente.")
    }
  }

  async function handleCopyExistingInvitation(invitation: UserInvitationView) {
    setError(null)
    setSuccess(null)
    setCopyingInvitationId(invitation.id)

    try {
      const response = await fetch(`/api/admin/invitations/${invitation.id}/link`, { method: "POST" })
      const payload = (await response.json().catch(() => ({}))) as any

      if (!response.ok || !payload?.ok || typeof payload?.inviteUrl !== "string") {
        throw new Error(payload?.error || "Não foi possível gerar o link do convite.")
      }

      setGeneratedInviteUrls((current) => ({ ...current, [invitation.id]: payload.inviteUrl }))
      await navigator.clipboard.writeText(payload.inviteUrl)
      setCopiedInvitationId(invitation.id)
      setSuccess("Link do convite copiado. Se havia um link anterior pendente, ele foi substituído por este novo link.")
      window.setTimeout(() => setCopiedInvitationId(null), 2200)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível copiar o link do convite.")
    } finally {
      setCopyingInvitationId(null)
    }
  }

  function toggleInvitationOptions(id: string) {
    setExpandedInvitationId((current) => (current === id ? null : id))
  }

  async function handleRevokeInvitation(id: string) {
    setError(null)
    setSuccess(null)
    setRevokingId(id)

    try {
      const response = await fetch(`/api/admin/invitations/${id}/revoke`, { method: "POST" })
      const payload = (await response.json().catch(() => ({}))) as any

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Não foi possível revogar o convite.")
      }

      setSuccess("Convite revogado com sucesso.")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível revogar o convite.")
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
              Cadastro protegido por convite
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Usuários</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              Envie links individuais para liberar novos acessos. O e-mail do convite fica travado no cadastro, o link expira
              e só pode ser usado uma vez.
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
              <p className="text-xs uppercase tracking-wide text-white/60">Pendentes</p>
              <p className="mt-2 text-2xl font-bold">{stats.pending}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">Aceitos</p>
              <p className="mt-2 text-2xl font-bold">{stats.accepted}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card className="border-blue-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MailPlus className="h-5 w-5 text-blue-600" />
              Enviar novo convite
            </CardTitle>
            <CardDescription>
              Crie um link seguro para o e-mail autorizado. Links pendentes anteriores do mesmo e-mail serão revogados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateInvitation}>
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

              <div className="grid gap-4 sm:grid-cols-2">
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

                <div className="space-y-2">
                  <Label htmlFor="expiresDays">Validade do convite</Label>
                  <Select value={expiresDays} onValueChange={setExpiresDays}>
                    <SelectTrigger id="expiresDays">
                      <SelectValue placeholder="Validade do convite" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 dia</SelectItem>
                      <SelectItem value="3">3 dias</SelectItem>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="15">15 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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

              {inviteUrl && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
                  <Label className="text-xs uppercase tracking-wide text-blue-700">Link do convite</Label>
                  <div className="mt-2 flex gap-2">
                    <Input readOnly value={inviteUrl} className="bg-white text-xs" />
                    <Button type="button" variant="outline" onClick={handleCopyInvitation} className="shrink-0">
                      {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                    </Button>
                  </div>
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
                    Criando convite...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Gerar link de cadastro
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-purple-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Clock className="h-5 w-5 text-purple-600" />
              Convites recentes
            </CardTitle>
            <CardDescription>Controle convites pendentes, aceitos, expirados e revogados.</CardDescription>
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
                      <th className="px-4 py-3 font-semibold">Validade</th>
                      <th className="px-4 py-3 font-semibold">Criado</th>
                      <th className="px-4 py-3 text-right font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invitations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                          Nenhum convite criado ainda.
                        </td>
                      </tr>
                    ) : (
                      invitations.map((invitation) => {
                        const isExpanded = expandedInvitationId === invitation.id
                        const generatedInviteUrl = generatedInviteUrls[invitation.id]

                        return (
                          <Fragment key={invitation.id}>
                            <tr className="bg-white odd:bg-slate-50/60">
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => toggleInvitationOptions(invitation.id)}
                                  className="group text-left"
                                  title="Clique para abrir as opções do convite"
                                >
                                  <div className="font-semibold text-slate-900 underline-offset-4 transition-colors group-hover:text-blue-700 group-hover:underline">
                                    {invitation.full_name || "Sem nome"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{invitation.email}</div>
                                </button>
                              </td>
                              <td className="px-4 py-3 capitalize">{invitation.role}</td>
                              <td className="px-4 py-3">
                                <StatusBadge status={invitation.status} />
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">{formatDate(invitation.expires_at)}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{formatDate(invitation.created_at)}</td>
                              <td className="px-4 py-3 text-right">
                                {invitation.status === "pending" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={revokingId === invitation.id}
                                    onClick={() => handleRevokeInvitation(invitation.id)}
                                    className="border-rose-200 text-rose-700 hover:bg-rose-50"
                                  >
                                    {revokingId === invitation.id ? (
                                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <XCircle className="mr-2 h-3.5 w-3.5" />
                                    )}
                                    Revogar
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr className="bg-blue-50/70">
                                <td colSpan={6} className="px-4 py-3">
                                  <div className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
                                    {invitation.status === "pending" ? (
                                      <div className="space-y-3">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                          <div>
                                            <p className="text-sm font-semibold text-slate-900">Opções do convite</p>
                                            <p className="text-xs text-muted-foreground">
                                              Copie uma nova via do link para enviar ao usuário. Por segurança, o link anterior deste convite será substituído.
                                            </p>
                                          </div>
                                          <Button
                                            type="button"
                                            size="sm"
                                            disabled={copyingInvitationId === invitation.id}
                                            onClick={() => handleCopyExistingInvitation(invitation)}
                                            className="bg-gradient-to-r from-blue-600 to-purple-700 font-semibold text-white hover:from-blue-700 hover:to-purple-800"
                                          >
                                            {copyingInvitationId === invitation.id ? (
                                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                            ) : copiedInvitationId === invitation.id ? (
                                              <Check className="mr-2 h-3.5 w-3.5" />
                                            ) : (
                                              <Clipboard className="mr-2 h-3.5 w-3.5" />
                                            )}
                                            {copiedInvitationId === invitation.id ? "Link copiado" : "Copiar link de envio"}
                                          </Button>
                                        </div>

                                        {generatedInviteUrl && (
                                          <div className="flex flex-col gap-2 sm:flex-row">
                                            <Input readOnly value={generatedInviteUrl} className="bg-slate-50 text-xs" />
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() => navigator.clipboard.writeText(generatedInviteUrl)}
                                              className="shrink-0"
                                            >
                                              <Clipboard className="mr-2 h-3.5 w-3.5" />
                                              Copiar novamente
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">
                                        Este convite não está pendente. O link só pode ser copiado para convites pendentes.
                                      </p>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })
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
                        <td className="px-4 py-3 capitalize">{profile.role}</td>
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
