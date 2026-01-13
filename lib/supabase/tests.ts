import type { SupabaseClient } from "@supabase/supabase-js"

export type ExperimentRow = {
  number: number
  strain: string
  start_date: string
  test_count: number
  repetition_count: number
}

export type TestRow = {
  id: string
  experiment_id: string
  repetition_number: number
  test_number: number
  test_type: string | null
  unit: string | null
  requisition: string | null
  strain: string | null
  date_7_day: string | null
  date_14_day: string | null
  created_at: string
  experiments?: ExperimentRow | null
}

export async function getAllTests(supabase: SupabaseClient) {
  try {
    const { data, error } = await supabase
      .from("tests")
      .select(
        `
        id,
        experiment_id,
        repetition_number,
        test_number,
        test_type,
        unit,
        requisition,
        strain,
        date_7_day,
        date_14_day,
        created_at,
        experiments (
          number,
          strain,
          start_date,
          test_count,
          repetition_count
        )
      `,
      )
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Supabase query error:", error)
      return []
    }

    const raw = (data ?? []) as unknown as Array<
      Omit<TestRow, "experiments"> & { experiments?: ExperimentRow[] | ExperimentRow | null }
    >

    // Normaliza para sempre ficar ExperimentRow | null
    return raw.map((row) => {
      const exp = row.experiments
      const normalized = Array.isArray(exp) ? (exp[0] ?? null) : (exp ?? null)
      return { ...row, experiments: normalized }
    }) as TestRow[]
  } catch (error) {
    console.error("[v0] Error fetching tests:", error)
    return []
  }
}
