import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type AuditAction = "insert" | "update" | "delete" | "login" | "logout"
export type AuditEntityType = "experiment" | "test" | "media" | "auth" | "user" | "invitation" | "system"

type WriteAuditLogInput = {
  actorUserId: string
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string | null
  entityLabel?: string | null
  actorEmail?: string | null
  summary: string
  changes?: Record<string, unknown>
  metadata?: Record<string, unknown>
  request?: Request
}

function getRequestIp(req?: Request) {
  if (!req) return null
  const forwardedFor = req.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null
  return req.headers.get("x-real-ip") || null
}

function getUserAgent(req?: Request) {
  if (!req) return null
  return req.headers.get("user-agent") || null
}

async function getActorSnapshot(supabase: SupabaseClient, userId: string) {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .maybeSingle()

    const profileName = typeof (data as any)?.full_name === "string" ? (data as any).full_name.trim() : ""

    return {
      actorName: profileName || "Usuário",
      actorEmail: null as string | null,
    }
  } catch {
    return {
      actorName: "Usuário",
      actorEmail: null as string | null,
    }
  }
}

/**
 * Registro manual de auditoria para eventos que não passam por triggers de tabelas,
 * como login e logout.
 *
 * A função nunca deve quebrar o fluxo principal do usuário. Em caso de erro,
 * apenas registra no console e retorna false.
 */
export async function writeAuditLog(supabase: SupabaseClient, input: WriteAuditLogInput) {
  try {
    const actor = await getActorSnapshot(supabase, input.actorUserId)

    const { error } = await supabase.from("audit_logs").insert({
      actor_user_id: input.actorUserId,
      actor_name: actor.actorName,
      actor_email: input.actorEmail ?? actor.actorEmail,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      entity_label: input.entityLabel ?? null,
      summary: input.summary,
      changes: input.changes ?? {},
      metadata: input.metadata ?? {},
      ip_address: getRequestIp(input.request),
      user_agent: getUserAgent(input.request),
    })

    if (error) {
      console.error("[audit-log] Falha ao gravar log:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("[audit-log] Erro inesperado ao gravar log:", error)
    return false
  }
}
