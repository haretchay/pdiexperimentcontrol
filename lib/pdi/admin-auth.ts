import "server-only"

import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function requireAdminForRoute() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Usuário não autenticado." }, { status: 401 }),
    }
  }

  const admin = createAdminClient()
  if (!admin) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          ok: false,
          error: "SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.",
        },
        { status: 500 },
      ),
    }
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, status")
    .eq("user_id", user.id)
    .maybeSingle()

  if (profileError) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Não foi possível validar a permissão do usuário." },
        { status: 500 },
      ),
    }
  }

  if (!profile || profile.status !== "active" || profile.role !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Apenas usuários admin podem executar esta ação." },
        { status: 403 },
      ),
    }
  }

  return { ok: true as const, admin, user, profile }
}
