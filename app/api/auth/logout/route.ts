import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

export async function POST() {
  try {
    const supabase = createClient()
    await supabase.auth.signOut()
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro inesperado ao sair." },
      { status: 500 }
    )
  }
}
