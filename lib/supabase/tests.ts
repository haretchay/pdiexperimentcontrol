import type { SupabaseClient } from "@supabase/supabase-js"

export type ExperimentRow = {
  number: number
  strain: string
  start_date: string
  test_count: number
  repetition_count: number
}

export type TestPhotoRow = {
  day: number
  storage_path: string | null
  created_at?: string | null
  kind?: string | null
  photo_index?: number | null
}

export type TestRow = {
  [key: string]: unknown
  id: string
  experiment_id: string
  repetition_number: number
  test_number: number
  test_type: string | null
  unit: string | null
  requisition: string | null
  test_lot: string | null
  matrix_lot: string | null
  strain: string | null
  mp_lot: string | null
  average_humidity: number | null
  bozo: number | null
  sensorial: number | null
  quantity: number | null
  wet_weight: number | null
  dry_weight: number | null
  extracted_conidium_weight: number | null
  date_7_day: string | null
  date_14_day: string | null
  created_at: string
  updated_at?: string | null
  experiments?: ExperimentRow | null
  test_photos?: TestPhotoRow[] | null
}

export async function getAllTests(supabase: SupabaseClient) {
  try {
    const { data, error } = await supabase
      .from("tests")
      .select(
        `
        *,
        experiments (
          number,
          strain,
          start_date,
          test_count,
          repetition_count
        ),
        test_photos (
          day,
          storage_path,
          created_at,
          kind,
          photo_index
        )
      `,
      )
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[Tests] Supabase query error:", error)
      return []
    }

    const raw = (data ?? []) as unknown as Array<
      Omit<TestRow, "experiments"> & { experiments?: ExperimentRow[] | ExperimentRow | null }
    >

    return raw.map((row) => {
      const exp = row.experiments
      const normalized = Array.isArray(exp) ? (exp[0] ?? null) : (exp ?? null)
      return { ...row, experiments: normalized }
    }) as TestRow[]
  } catch (error) {
    console.error("[Tests] Error fetching tests:", error)
    return []
  }
}
