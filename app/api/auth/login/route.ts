import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

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

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro inesperado ao autenticar." },
      { status: 500 }
    )
  }
}
