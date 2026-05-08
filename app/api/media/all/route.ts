import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
export const dynamic = "force-dynamic"

/**
 * Lista TODAS as fotos mescladas (kind='merged') do bucket test-photos.
 * A página de mídias faz filtro/ordenação no client.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    // RLS / auth: se não estiver autenticado, a query falha.
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) {
      return NextResponse.json({ photos: [], error: "not_authenticated" }, { status: 401 })
    }

    // Prefer the admin client (service role) so "Mídias" can show photos from all users
    // even when RLS on test_photos / storage.objects is restrictive.
    // If the service key isn't configured, we fall back to the regular server client
    // and you must rely on permissive RLS policies for reads.
    const dbClient = admin ?? supabase

    const { data, error } = await dbClient
      .from("test_photos")
      .select(
        `
          id,
          day,
          kind,
          storage_path,
          created_at,
          test:tests (
            id,
            repetition_number,
            test_number,
            strain,
            unit,
            test_lot,
            matrix_lot,
            date_7_day,
            date_14_day,
            wet_weight,
            dry_weight,
            extracted_conidium_weight,
            experiment:experiments (
              id,
              number,
              strain,
              start_date
            )
          )
        `
      )
      .eq("kind", "merged")
      .order("created_at", { ascending: false })
      .limit(2000)

    if (error) {
      console.error("[media/all] list error:", error)
      return NextResponse.json({ photos: [], error: error.message }, { status: 400 })
    }

    // Assina URLs (quando o objeto existir). Se não existir, marca como missing.
    const out: any[] = []
    for (const row of data ?? []) {
      const storagePath = (row as any).storage_path as string
      const createdAt = (row as any).created_at as string
      const day = (row as any).day as 7 | 14

      let url: string | null = null
      let missing = false
      try {
        const storageClient = (admin ?? supabase).storage
        const signed = await storageClient
          .from("test-photos")
          .createSignedUrl(storagePath, 60 * 60)
        if (signed.error) {
          missing = true
        } else {
          url = signed.data?.signedUrl ?? null
        }
      } catch {
        missing = true
      }

      const test = (row as any).test
      const experiment = test?.experiment

      if (!test || !experiment) {
        // Se faltou join, pula para evitar quebrar o front.
        continue
      }

      out.push({
        id: String((row as any).id),
        day,
        storagePath,
        url,
        missing,
        createdAt,
        experiment: {
          id: String(experiment.id),
          number: Number(experiment.number),
          strain: experiment.strain ?? null,
          startDate: experiment.start_date ?? null,
        },
        test: {
          id: String(test.id),
          repetitionNumber: Number(test.repetition_number),
          testNumber: Number(test.test_number),
          strain: test.strain ?? null,
          unit: test.unit ?? null,
          testLot: test.test_lot ?? null,
          matrixLot: test.matrix_lot ?? null,
          date7Day: test.date_7_day ?? null,
          date14Day: test.date_14_day ?? null,
          wetWeight: test.wet_weight ?? null,
          dryWeight: test.dry_weight ?? null,
          extractedConidiumWeight: test.extracted_conidium_weight ?? null,
        },
      })
    }

    return NextResponse.json({ photos: out })
  } catch (e: any) {
    console.error("[media/all] unexpected:", e)
    return NextResponse.json({ photos: [], error: e?.message ?? "unknown_error" }, { status: 500 })
  }
}
