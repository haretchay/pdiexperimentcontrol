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

    const admin = createAdminClient()
    const dbClient = admin ?? supabase

    const { data: profile, error: profileError } = await dbClient
      .from("profiles")
      .select("role, status")
      .eq("user_id", user.id)
      .maybeSingle()

    if (profileError) throw profileError

    if (!profile || profile.role !== "admin" || profile.status !== "active") {
      return NextResponse.json({ ok: false, error: "Apenas usuários admin podem reativar experimentos." }, { status: 403 })
    }

    const now = new Date().toISOString()
    const { error } = await dbClient
      .from("experiments")
      .update({
        status: "active",
        canceled_at: null,
        canceled_by: null,
        updated_by: user.id,
        updated_at: now,
      })
      .eq("id", params.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[api/experiments/restore] unexpected", error)
    return NextResponse.json({ ok: false, error: error?.message ?? "restore_failed" }, { status: 500 })
  }
}
