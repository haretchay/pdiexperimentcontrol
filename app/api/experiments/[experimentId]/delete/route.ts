import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST /api/experiments/:experimentId/delete
// - apaga test_photos + tests + experiment
// - remove arquivos do bucket test-photos (best-effort)

export async function POST(_req: Request, ctx: { params: { experimentId: string } }) {
  const experimentId = ctx.params.experimentId
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    // 1) pega testes do experimento (para limpar storage)
    const { data: tests, error: testsErr } = await supabase
      .from("tests")
      .select("id, created_by")
      .eq("experiment_id", experimentId)

    if (testsErr) throw testsErr

    const testIds = (tests ?? []).map((t: any) => String(t.id)).filter(Boolean)

    // 2) remove arquivos do bucket (best-effort)
    for (const t of tests ?? []) {
      const testId = String(t.id)
      if (!testId) continue

      const ownerId = (t.created_by ? String(t.created_by) : user.id).trim()
      const folder = `${ownerId}/${testId}`

      const { data: objects, error: listErr } = await supabase.storage.from("test-photos").list(folder, { limit: 1000 })
      if (listErr || !objects?.length) continue

      const paths = objects
        .filter((o: any) => typeof o?.name === "string" && o.name.length)
        .map((o: any) => `${folder}/${o.name}`)

      if (paths.length) {
        await supabase.storage.from("test-photos").remove(paths)
      }
    }

    // 3) apaga registros do banco (ordem segura)
    if (testIds.length) {
      const { error: delPhotosErr } = await supabase.from("test_photos").delete().in("test_id", testIds)
      if (delPhotosErr) throw delPhotosErr
    }

    const { error: delTestsErr } = await supabase.from("tests").delete().eq("experiment_id", experimentId)
    if (delTestsErr) throw delTestsErr

    const { error: delExpErr } = await supabase.from("experiments").delete().eq("id", experimentId)
    if (delExpErr) throw delExpErr

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "delete_failed" }, { status: 500 })
  }
}
