import { ShieldAlert } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireActiveUser } from "@/lib/supabase/auth"
import { LogsPageClient, type AuditLogRow } from "./logs-page-client"

export const dynamic = "force-dynamic"

export default async function LogsPage() {
  const auth = await requireActiveUser()

  if (!auth.ok) {
    return null
  }

  const role = String((auth.profile as any)?.role ?? "").toLowerCase()
  if (role !== "admin") {
    return (
      <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
        <Card className="rounded-2xl border-amber-200 bg-amber-50/70 shadow-sm dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <ShieldAlert className="h-5 w-5" /> Acesso restrito
            </CardTitle>
            <CardDescription className="text-amber-700 dark:text-amber-300">
              Somente usuários com função admin podem visualizar os logs do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-amber-800 dark:text-amber-200">
            Essa página contém histórico de alterações, exclusões e acessos ao sistema.
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data, error } = await auth.supabase
    .from("audit_logs")
    .select(
      "id, created_at, actor_user_id, actor_name, actor_email, action, entity_type, entity_id, entity_label, summary, changes, metadata, ip_address, user_agent",
    )
    .order("created_at", { ascending: false })
    .limit(300)

  if (error) {
    console.error("[logs] Erro ao carregar logs:", error)
  }

  return <LogsPageClient logs={((data ?? []) as unknown as AuditLogRow[])} />
}
