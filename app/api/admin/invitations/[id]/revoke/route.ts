import { NextResponse } from "next/server"

import { requireAdminForRoute } from "@/lib/pdi/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdminForRoute()
  if (!auth.ok) return auth.response

  try {
    const id = params.id
    if (!id) {
      return NextResponse.json({ ok: false, error: "Convite inválido." }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { data, error } = await auth.admin
      .from("user_invitations")
      .update({ status: "revoked", revoked_at: now, updated_at: now })
      .eq("id", id)
      .eq("status", "pending")
      .select("id, status, revoked_at, updated_at")
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Erro ao revogar convite." },
        { status: 500 },
      )
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Convite não encontrado ou já não está pendente." },
        { status: 404 },
      )
    }

    return NextResponse.json({ ok: true, invitation: data })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Erro inesperado ao revogar convite." },
      { status: 500 },
    )
  }
}

