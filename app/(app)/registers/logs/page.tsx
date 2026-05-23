import { ShieldAlert } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireActiveUser } from "@/lib/supabase/auth"
import { LogsPageClient, type AuditLogRow } from "./logs-page-client"

export const dynamic = "force-dynamic"

type AuditLogSelect = {
  id: string
  created_at: string
  actor_user_id: string | null
  actor_name: string | null
  actor_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  entity_label: string | null
  summary: string
  changes: unknown
  metadata: unknown
  ip_address: string | null
  user_agent: string | null
}

const SELECT_COLUMNS =
  "id, created_at, actor_user_id, actor_name, actor_email, action, entity_type, entity_id, entity_label, summary, changes, metadata, ip_address, user_agent"

function normalizeAuditLog(row: AuditLogSelect): AuditLogRow {
  return {
    id: row.id,
    created_at: row.created_at,
    actor_user_id: row.actor_user_id,
    actor_name: row.actor_name,
    actor_email: row.actor_email,
    action: row.action as AuditLogRow["action"],
    entity_type: row.entity_type as AuditLogRow["entity_type"],
    entity_id: row.entity_id,
    entity_label: row.entity_label,
    summary: row.summary,
    changes: row.changes && typeof row.changes === "object" && !Array.isArray(row.changes) ? (row.changes as Record<string, any>) : {},
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? (row.metadata as Record<string, any>) : {},
    ip_address: row.ip_address,
    user_agent: row.user_agent,
  }
}

export default async function LogsPage() {
  const auth = await requireActiveUser()

  if (!auth.ok) {
    return null
  }

  const role = String((auth.profile as any)?.role ?? "").toLowerCase()
  const isAdmin = role === "admin"
  const db = createAdminClient() ?? auth.supabase

  let query = db
    .from("audit_logs")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(isAdmin ? 500 : 300)

  if (!isAdmin) {
    query = query.eq("actor_user_id", auth.user.id)
  }

  const { data, error } = await query

  if (error) {
    console.error("[logs] Erro ao carregar logs:", error)

    return (
      <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
        <Card className="rounded-2xl border-amber-200 bg-amber-50/70 shadow-sm dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <ShieldAlert className="h-5 w-5" /> Não foi possível carregar os logs
            </CardTitle>
            <CardDescription className="text-amber-700 dark:text-amber-300">
              Verifique as policies da tabela audit_logs ou a variável SUPABASE_SERVICE_ROLE_KEY.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-amber-800 dark:text-amber-200">{error.message}</CardContent>
        </Card>
      </div>
    )
  }

  const logs = ((data ?? []) as unknown as AuditLogSelect[]).map(normalizeAuditLog)

  return (
    <LogsPageClient
      logs={logs}
      viewerMode={isAdmin ? "admin" : "own"}
      currentUserLabel={(auth.profile as any)?.full_name || auth.user.email || "meu usuário"}
    />
  )
}
