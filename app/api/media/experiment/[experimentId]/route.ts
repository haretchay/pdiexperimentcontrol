import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function isRateLimitError(err: unknown) {
  const status = (err as any)?.status
  const msg = String((err as any)?.message ?? err ?? "")
  return (
    status === 429 ||
    msg.includes("Too Many") ||
    msg.includes("Too many") ||
    msg.includes("rate limit") ||
    msg.includes("Unexpected token 'T'")
  )
}

async function signedUrlOrNull(supabase: any, path: string) {
  try {
    const { data, error } = await supabase.storage.from("test-photos").createSignedUrl(path, 60 * 60)
    if (error || !data?.signedUrl) return null
    return data.signedUrl as string
  } catch {
    return null
  }
}

/**
 * GET /api/media/experiment/:experimentId
 * Retorna a lista de testes do experimento, com 2 imagens mescladas (7º e 14º) quando existirem.
 */
export async function GET(_req: Request, { params }: { params: { experimentId: string } }) {
  const experimentId = params.experimentId
  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError && isRateLimitError(authError)) return NextResponse.json({ error: "rate_limit" }, { status: 429 })
  if (!authData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

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
  const byTestDay = new Map<string, any>()
  for (const p of photos ?? []) {
    const key = `${p.test_id}|${p.day}`
    if (!byTestDay.has(key)) byTestDay.set(key, p)
  }

  const result = await Promise.all(
    (tests ?? []).map(async (t: any) => {
      const p7 = byTestDay.get(`${t.id}|7`)
      const p14 = byTestDay.get(`${t.id}|14`)

      const url7 = p7?.storage_path ? await signedUrlOrNull(supabase, p7.storage_path) : null
      const url14 = p14?.storage_path ? await signedUrlOrNull(supabase, p14.storage_path) : null

      return {
        id: t.id,
        repetitionNumber: t.repetition_number,
        testNumber: t.test_number,
        strain: t.strain ?? null,
        date7Day: t.date_7_day ?? null,
        date14Day: t.date_14_day ?? null,
        merged: {
          day7: p7
            ? {
                storagePath: p7.storage_path,
                url: url7,
                createdAt: p7.created_at,
              }
            : null,
          day14: p14
            ? {
                storagePath: p14.storage_path,
                url: url14,
                createdAt: p14.created_at,
              }
            : null,
        },
      }
    })
  )

  return NextResponse.json({ tests: result })
}
