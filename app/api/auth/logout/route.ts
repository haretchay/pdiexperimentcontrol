import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/pdi/audit-log"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.id) {
      await writeAuditLog(supabase, {
        actorUserId: user.id,
        action: "logout",
        entityType: "auth",
        entityId: user.id,
        entityLabel: user.email ?? "Usuário",
        actorEmail: user.email ?? null,
        summary: `Logout realizado por ${user.email ?? "usuário"}`,
        metadata: { email: user.email ?? null },
        request: req,
      })
    }

    await supabase.auth.signOut()
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro inesperado ao sair." },
      { status: 500 }
    )
  }
}
