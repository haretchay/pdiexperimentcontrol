import { NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Usuário não autenticado." }, { status: 401 })
    }

    const dbClient = createAdminClient() ?? supabase
    const now = new Date().toISOString()

    const { error } = await dbClient
      .from("experiments")
      .update({
        status: "canceled",
        canceled_at: now,
        canceled_by: user.id,
        updated_by: user.id,
        updated_at: now,
      })
      .eq("id", params.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[api/experiments/cancel] unexpected", error)
    return NextResponse.json({ ok: false, error: error?.message ?? "cancel_failed" }, { status: 500 })
  }
}
