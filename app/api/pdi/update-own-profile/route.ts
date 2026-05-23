import { NextResponse } from "next/server"

import { writeAuditLog } from "@/lib/pdi/audit-log"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function formatPasswordError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "A senha atual está incorreta."
  }
  if (lower.includes("password")) {
    return "A nova senha não atende aos requisitos mínimos."
  }
  return message || "Não foi possível atualizar a senha."
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Sessão expirada. Faça login novamente." }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const fullName = normalizeText(body?.fullName)
    const currentPassword = String(body?.currentPassword ?? "")
    const newPassword = String(body?.newPassword ?? "")
    const repeatNewPassword = String(body?.repeatNewPassword ?? "")
    const willChangePassword = Boolean(currentPassword || newPassword || repeatNewPassword)

    if (willChangePassword) {
      if (!currentPassword) {
        return NextResponse.json({ ok: false, error: "Informe a senha atual." }, { status: 400 })
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ ok: false, error: "A nova senha precisa ter pelo menos 6 caracteres." }, { status: 400 })
      }

      if (newPassword !== repeatNewPassword) {
        return NextResponse.json({ ok: false, error: "A repetição da nova senha não confere." }, { status: 400 })
      }

      if (!user.email) {
        return NextResponse.json({ ok: false, error: "Usuário sem e-mail vinculado." }, { status: 400 })
      }

      const { error: passwordCheckError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })

      if (passwordCheckError) {
        return NextResponse.json({ ok: false, error: formatPasswordError(passwordCheckError.message) }, { status: 400 })
      }
    }

    const admin = createAdminClient()
    const db = admin ?? supabase
    const now = new Date().toISOString()

    const { data: previousProfile } = await db
      .from("profiles")
      .select("full_name, role, status")
      .eq("user_id", user.id)
      .maybeSingle()

    const finalFullName = fullName || (previousProfile as any)?.full_name || user.email || "Usuário"

    const { error: profileError } = await db
      .from("profiles")
      .update({ full_name: finalFullName, updated_at: now })
      .eq("user_id", user.id)

    if (profileError) {
      return NextResponse.json({ ok: false, error: profileError.message || "Erro ao atualizar cadastro." }, { status: 500 })
    }

    if (willChangePassword) {
      if (admin) {
        const { error: updatePasswordError } = await admin.auth.admin.updateUserById(user.id, {
          password: newPassword,
          user_metadata: { full_name: finalFullName },
        })

        if (updatePasswordError) {
          return NextResponse.json(
            { ok: false, error: formatPasswordError(updatePasswordError.message) },
            { status: 400 },
          )
        }
      } else {
        const { error: updatePasswordError } = await supabase.auth.updateUser({ password: newPassword })

        if (updatePasswordError) {
          return NextResponse.json(
            { ok: false, error: formatPasswordError(updatePasswordError.message) },
            { status: 400 },
          )
        }
      }
    } else if (admin) {
      await admin.auth.admin
        .updateUserById(user.id, { user_metadata: { full_name: finalFullName } })
        .catch(() => undefined)
    }

    const changes: Record<string, { before: unknown; after: unknown }> = {}
    const previousFullName = (previousProfile as any)?.full_name ?? null
    if (previousFullName !== finalFullName) {
      changes.full_name = { before: previousFullName, after: finalFullName }
    }
    if (willChangePassword) {
      changes.password = { before: "********", after: "********" }
    }

    await writeAuditLog(db as any, {
      actorUserId: user.id,
      action: "update",
      entityType: "user",
      entityId: user.id,
      entityLabel: finalFullName,
      actorEmail: user.email ?? null,
      summary: willChangePassword
        ? `${finalFullName} atualizou o próprio cadastro e alterou a senha.`
        : `${finalFullName} atualizou o próprio cadastro.`,
      changes,
      metadata: { email: user.email ?? null, self_service: true },
      request,
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Erro inesperado ao atualizar cadastro." },
      { status: 500 },
    )
  }
}
