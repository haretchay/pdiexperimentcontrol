"use client"

import { useMemo, useState } from "react"
import { Activity, Clock3, Database, FileClock, Filter, LogIn, LogOut, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type AuditLogRow = {
  id: string
  created_at: string
  actor_user_id: string | null
  actor_name: string | null
  actor_email: string | null
  action: "insert" | "update" | "delete" | "login" | "logout"
  entity_type: "experiment" | "test" | "media" | "auth" | "user" | "invitation" | "system"
  entity_id: string | null
  entity_label: string | null
  summary: string
  changes: Record<string, any> | null
  metadata: Record<string, any> | null
  ip_address: string | null
  user_agent: string | null
}

type Props = {
  logs: AuditLogRow[]
}

const actionLabels: Record<AuditLogRow["action"], string> = {
  insert: "Criação",
  update: "Edição",
  delete: "Exclusão",
  login: "Login",
  logout: "Logout",
}

const entityLabels: Record<AuditLogRow["entity_type"], string> = {
  experiment: "Experimento",
  test: "Teste",
  media: "Mídia",
  auth: "Acesso",
  user: "Usuário",
  invitation: "Autorização",
  system: "Sistema",
}

const actionBadgeClass: Record<AuditLogRow["action"], string> = {
  insert: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
  update: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300",
  delete: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300",
  login: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300",
  logout: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300",
}

function formatDateTimeBR(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--/--/---- --:--"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function getActionIcon(action: AuditLogRow["action"]) {
  if (action === "insert") return Plus
  if (action === "update") return Pencil
  if (action === "delete") return Trash2
  if (action === "login") return LogIn
  if (action === "logout") return LogOut
  return Activity
}

function getChangedFields(log: AuditLogRow) {
  if (!log.changes || typeof log.changes !== "object") return []
  return Object.keys(log.changes).filter(Boolean)
}

function getActor(log: AuditLogRow) {
  return log.actor_name || log.actor_email || "Usuário não identificado"
}

function formatChangeValue(value: unknown) {
  if (value === null || value === undefined) return "vazio"
  if (typeof value === "string") return value.trim() || "vazio"
  if (typeof value === "number" || typeof value === "boolean") return String(value)

  try {
    const json = JSON.stringify(value)
    return json.length > 120 ? `${json.slice(0, 117)}...` : json
  } catch {
    return String(value)
  }
}

export function LogsPageClient({ logs }: Props) {
  const [query, setQuery] = useState("")
  const [action, setAction] = useState<"all" | AuditLogRow["action"]>("all")
  const [entityType, setEntityType] = useState<"all" | AuditLogRow["entity_type"]>("all")

  const stats = useMemo(() => {
    const total = logs.length
    const updates = logs.filter((log) => log.action === "update").length
    const inserts = logs.filter((log) => log.action === "insert").length
    const deletes = logs.filter((log) => log.action === "delete").length
    const access = logs.filter((log) => log.action === "login" || log.action === "logout").length

    return { total, updates, inserts, deletes, access }
  }, [logs])

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return logs.filter((log) => {
      if (action !== "all" && log.action !== action) return false
      if (entityType !== "all" && log.entity_type !== entityType) return false

      if (!normalizedQuery) return true

      const haystack = [
        log.summary,
        log.entity_label,
        log.actor_name,
        log.actor_email,
        log.ip_address,
        actionLabels[log.action],
        entityLabels[log.entity_type],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [action, entityType, logs, query])

  return (
    <div className="w-full space-y-5 px-4 py-4 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-800 p-5 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
              <FileClock className="mr-2 h-3.5 w-3.5" /> Auditoria do sistema
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">Logs do Sistema</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/80">
              Histórico de criações, edições, exclusões, logins e logouts. As edições mostram somente os campos alterados.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5 lg:min-w-[580px]">
            <div className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur">
              <div className="text-white/70">Total</div>
              <div className="text-xl font-bold">{stats.total}</div>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur">
              <div className="text-white/70">Criados</div>
              <div className="text-xl font-bold">{stats.inserts}</div>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur">
              <div className="text-white/70">Editados</div>
              <div className="text-xl font-bold">{stats.updates}</div>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur">
              <div className="text-white/70">Excluídos</div>
              <div className="text-xl font-bold">{stats.deletes}</div>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur">
              <div className="text-white/70">Acessos</div>
              <div className="text-xl font-bold">{stats.access}</div>
            </div>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl border-slate-200/80 shadow-sm dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5 text-blue-600" /> Filtros
          </CardTitle>
          <CardDescription>Use os filtros para localizar rapidamente uma alteração, usuário ou item do sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por usuário, ação, experimento, teste, mídia ou IP..."
                className="pl-9"
              />
            </div>
            <Select value={action} onValueChange={(value) => setAction(value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="insert">Criação</SelectItem>
                <SelectItem value="update">Edição</SelectItem>
                <SelectItem value="delete">Exclusão</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityType} onValueChange={(value) => setEntityType(value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="experiment">Experimento</SelectItem>
                <SelectItem value="test">Teste</SelectItem>
                <SelectItem value="media">Mídia</SelectItem>
                <SelectItem value="auth">Acesso</SelectItem>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="invitation">Autorização</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200/80 shadow-sm dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5 text-purple-600" /> Histórico
          </CardTitle>
          <CardDescription>
            Exibindo {filteredLogs.length} de {logs.length} registro(s) carregados.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="border-y bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Quando</th>
                  <th className="px-4 py-3 font-semibold">Usuário</th>
                  <th className="px-4 py-3 font-semibold">Ação</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Registro</th>
                  <th className="px-4 py-3 font-semibold">Alterações</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      Nenhum log encontrado para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const Icon = getActionIcon(log.action)
                    const changedFields = getChangedFields(log)

                    return (
                      <tr key={log.id} className="border-b transition-colors odd:bg-white even:bg-slate-50/70 hover:bg-blue-50/60 dark:odd:bg-background dark:even:bg-slate-950/20 dark:hover:bg-blue-950/20">
                        <td className="whitespace-nowrap px-4 py-3 align-top">
                          <div className="flex items-center gap-2 font-medium">
                            <Clock3 className="h-4 w-4 text-muted-foreground" /> {formatDateTimeBR(log.created_at)}
                          </div>
                          {log.ip_address ? <div className="mt-1 text-xs text-muted-foreground">IP: {log.ip_address}</div> : null}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-2 font-medium">
                            <UserRound className="h-4 w-4 text-muted-foreground" /> {getActor(log)}
                          </div>
                          {log.actor_email && log.actor_email !== log.actor_name ? (
                            <div className="mt-1 text-xs text-muted-foreground">{log.actor_email}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge variant="outline" className={actionBadgeClass[log.action]}>
                            <Icon className="mr-1 h-3.5 w-3.5" /> {actionLabels[log.action]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge variant="secondary">{entityLabels[log.entity_type]}</Badge>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{log.summary}</div>
                          {log.entity_label ? <div className="mt-1 text-xs text-muted-foreground">{log.entity_label}</div> : null}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {changedFields.length > 0 ? (
                            <div className="max-w-[380px] space-y-2">
                              <div className="flex flex-wrap gap-1.5">
                                {changedFields.slice(0, 8).map((field) => (
                                  <Badge key={field} variant="outline" className="bg-white text-xs dark:bg-slate-950">
                                    {field}
                                  </Badge>
                                ))}
                                {changedFields.length > 8 ? (
                                  <Badge variant="outline" className="bg-white text-xs dark:bg-slate-950">
                                    +{changedFields.length - 8}
                                  </Badge>
                                ) : null}
                              </div>

                              <details className="rounded-lg border bg-white/70 px-2 py-1 text-xs dark:bg-slate-950/60">
                                <summary className="cursor-pointer font-medium text-blue-700 dark:text-blue-300">
                                  Ver valores alterados
                                </summary>
                                <div className="mt-2 space-y-1.5">
                                  {changedFields.map((field) => {
                                    const change = log.changes?.[field] ?? {}
                                    return (
                                      <div key={field} className="rounded-md bg-slate-50 p-2 dark:bg-slate-900">
                                        <div className="font-semibold text-slate-700 dark:text-slate-200">{field}</div>
                                        <div className="mt-1 grid gap-1 text-muted-foreground">
                                          <div>Antes: {formatChangeValue(change.before)}</div>
                                          <div>Depois: {formatChangeValue(change.after)}</div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </details>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Resumo registrado</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
