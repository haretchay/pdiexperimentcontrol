import { NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

// This route must be dynamic because it relies on cookies for auth.
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
    }

    const dbClient = createAdminClient() ?? supabase
    const experimentId = params.id

    const { data: experiment, error: expErr } = await dbClient
      .from("experiments")
      .select("id, number, repetition_count, test_count, start_date, strain")
      .eq("id", experimentId)
      .maybeSingle()

    if (expErr) {
      console.error("[api/experiments/detail] experiment error", expErr)
      return NextResponse.json({ error: expErr.message }, { status: 500 })
    }

    if (!experiment) {
      // When RLS blocks or the id doesn't exist, supabase returns 0 rows.
      // We respond with 404 so the UI can show a friendly message.
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    const { data: tests, error: testsErr } = await dbClient
      .from("tests")
      .select(`
        *,
        test_photos (
          day,
          storage_path,
          created_at,
          kind,
          photo_index
        )
      `)
      .eq("experiment_id", experimentId)
      .order("repetition_number", { ascending: true })
      .order("test_number", { ascending: true })

    if (testsErr) {
      console.error("[api/experiments/detail] tests error", testsErr)
      return NextResponse.json({ error: testsErr.message }, { status: 500 })
    }

    return NextResponse.json({ experiment, tests: tests ?? [] })
  } catch (e) {
    console.error("[api/experiments/detail] unexpected", e)
    return NextResponse.json({ error: "unexpected" }, { status: 500 })
  }
}
