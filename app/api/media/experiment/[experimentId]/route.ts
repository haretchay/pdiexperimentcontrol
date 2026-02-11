import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function isRateLimitError(err: unknown) {
  const status = (err as any)?.status
  const msg = String((err as any)?.message ?? err ?? "")
  return status === 429 || msg.includes("Too Many") || msg.includes("rate limit") || msg.includes("Unexpected token 'T'")
}

async function safeSignedUrl(supabase: any, path: string) {
  try {
    const { data, error } = await supabase.storage.from("test-photos").createSignedUrl(path, 60 * 60)
    if (error || !data?.signedUrl) {
      return { url: null as string | null, missing: true }
    }
    return { url: data.signedUrl as string, missing: false }
  } catch {
    return { url: null as string | null, missing: true }
  }
}

export async function GET(_req: Request, { params }: { params: { experimentId: string } }) {
  const experimentId = params.experimentId
  const supabase = await createClient()

  // auth
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError && isRateLimitError(authError)) return NextResponse.json({ error: "rate_limit" }, { status: 429 })
  if (!authData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  // tests do experimento
  const { data: tests, error: testsError } = await supabase
    .from("tests")
    .select("id, repetition_number, test_number, strain, date_7_day, date_14_day, created_at")
    .eq("experiment_id", experimentId)
    .order("repetition_number", { ascending: true })
    .order("test_number", { ascending: true })

  if (testsError) {
    if (isRateLimitError(testsError)) return NextResponse.json({ error: "rate_limit" }, { status: 429 })
    return NextResponse.json({ error: testsError.message }, { status: 500 })
  }

  const testIds = (tests ?? []).map((t: any) => t.id)
  if (!testIds.length) return NextResponse.json({ tests: [] })

  // fotos mescladas
  const { data: photos, error: photosError } = await supabase
    .from("test_photos")
    .select("id, test_id, day, storage_path, created_at, kind")
    .in("test_id", testIds)
    .eq("kind", "merged")
    .order("created_at", { ascending: false })

  if (photosError) {
    if (isRateLimitError(photosError)) return NextResponse.json({ error: "rate_limit" }, { status: 429 })
    return NextResponse.json({ error: photosError.message }, { status: 500 })
  }

  // pega o merged mais recente por (test_id, day)
  const latest = new Map<string, any>()
  for (const p of photos ?? []) {
    const key = `${p.test_id}|${p.day}`
    if (!latest.has(key)) latest.set(key, p)
  }

  const result = await Promise.all(
    (tests ?? []).map(async (t: any) => {
      const p7 = latest.get(`${t.id}|7`)
      const p14 = latest.get(`${t.id}|14`)

      const s7 = p7?.storage_path ? await safeSignedUrl(supabase, p7.storage_path) : { url: null, missing: false }
      const s14 = p14?.storage_path ? await safeSignedUrl(supabase, p14.storage_path) : { url: null, missing: false }

      return {
        id: t.id,
        repetitionNumber: t.repetition_number,
        testNumber: t.test_number,
        strain: t.strain ?? null,
        date7Day: t.date_7_day ?? null,
        date14Day: t.date_14_day ?? null,
        merged: {
          day7: p7
            ? { storagePath: p7.storage_path, url: s7.url, missing: s7.missing, createdAt: p7.created_at }
            : null,
          day14: p14
            ? { storagePath: p14.storage_path, url: s14.url, missing: s14.missing, createdAt: p14.created_at }
            : null,
        },
      }
    })
  )

  return NextResponse.json({ tests: result })
}
