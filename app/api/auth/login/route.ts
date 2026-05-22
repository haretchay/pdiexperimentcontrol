import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/pdi/audit-log"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body?.email === "string" ? body.email : ""
    const password = typeof body?.password === "string" ? body.password : ""

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "E-mail e senha são obrigatórios." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      )
    }

    if (data.user?.id) {
      await writeAuditLog(supabase, {
        actorUserId: data.user.id,
        action: "login",
        entityType: "auth",
        entityId: data.user.id,
        entityLabel: data.user.email ?? email,
        actorEmail: data.user.email ?? email,
        summary: `Login realizado por ${data.user.email ?? email}`,
        metadata: { email: data.user.email ?? email },
        request: req,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro inesperado ao autenticar." },
      { status: 500 }
    )
  }
}
