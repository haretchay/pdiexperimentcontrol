import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Tipos do banco (snake_case)
 */
type DbExperimentRow = {
  id: string
  number: number
  strain: string
  fungus_id?: string | null
  strain_acronym?: string | null
  strain_variable?: string | null
  strain_observation?: string | null
  status?: string | null
  canceled_at?: string | null
  canceled_by?: string | null
  start_date: string // date => string (YYYY-MM-DD)
  test_count: number
  repetition_count: number
  created_by: string | null
  created_at: string
}

type DbTestPhotoRow = {
  id: string
  test_id: string
  day: number
  storage_path: string
  created_at: string
  kind: "single" | "merged" | string | null
  photo_index: number | null
}

type DbTestRow = {
  [key: string]: any
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

  temp1_chamber: number | null
  temp1_rice: number | null
  temp2_chamber: number | null
  temp2_rice: number | null
  temp3_chamber: number | null
  temp3_rice: number | null
  temp4_chamber: number | null
  temp4_rice: number | null
  temp5_chamber: number | null
  temp5_rice: number | null
  temp6_chamber: number | null
  temp6_rice: number | null
  temp7_chamber: number | null
  temp7_rice: number | null
  temp8_chamber: number | null
  temp8_rice: number | null
  temp9_chamber: number | null
  temp9_rice: number | null
  temp10_chamber: number | null
  temp10_rice: number | null
  temp11_chamber: number | null
  temp11_rice: number | null
  temp12_chamber: number | null
  temp12_rice: number | null
  temp13_chamber: number | null
  temp13_rice: number | null
  temp14_chamber: number | null
  temp14_rice: number | null

  wet_weight: number | null
  dry_weight: number | null
  extracted_conidium_weight: number | null

  date_7_day: string | null
  date_14_day: string | null

  annotations_7_day: Record<string, unknown> | null
  annotations_14_day: Record<string, unknown> | null
  discard_contaminations?: Record<string, unknown> | null

  created_by: string | null
  created_at: string
  updated_at: string

  test_photos?: DbTestPhotoRow[] | null
}

/**
 * Tipos usados na UI (camelCase)
 */
export type Experiment = {
  id: string
  number: number
  strain: string
  fungusId: string | null
  strainAcronym: string | null
  strainVariable: string | null
  strainObservation: string | null
  status: string
  canceledAt: string | null
  canceledBy: string | null
  startDate: string
  testCount: number
  repetitionCount: number
  createdBy: string | null
  createdAt: string
}

export type TestPhoto = {
  id: string
  testId: string
  day: number
  storagePath: string
  createdAt: string
  kind: "single" | "merged" | string | null
  photoIndex: number | null
}

export type Test = {
  [key: string]: any
  id: string
  experimentId: string
  repetitionNumber: number
  testNumber: number
  testType: string | null

  unit: string | null
  requisition: string | null

  testLot: string | null
  matrixLot: string | null
  strain: string | null
  mpLot: string | null

  averageHumidity: number | null
  bozo: number | null
  sensorial: number | null
  quantity: number | null

  temp7Chamber: number | null
  temp14Chamber: number | null
  temp7Rice: number | null
  temp14Rice: number | null

  wetWeight: number | null
  dryWeight: number | null
  extractedConidiumWeight: number | null

  date7Day: string | null
  date14Day: string | null

  annotations7Day: Record<string, unknown> | null
  annotations14Day: Record<string, unknown> | null

  createdBy: string | null
  createdAt: string
  updatedAt: string

  testPhotos: TestPhoto[]
}

export type ExperimentWithTests = Experiment & {
  tests: Test[]
}

const TEMPERATURE_DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const
const RICE_PERIODS = ["Morning", "Afternoon"] as const
const RICE_SLOTS = [1, 2, 3] as const

function mapTemperatureFields(row: DbTestRow): Record<string, number | null> {
  const values: Record<string, number | null> = {}

  for (const day of TEMPERATURE_DAYS) {
    values[`temp${day}Chamber`] = row[`temp${day}_chamber`] ?? null
    values[`temp${day}Rice`] = row[`temp${day}_rice`] ?? null

    for (const period of RICE_PERIODS) {
      const periodColumn = period === "Morning" ? "morning" : "afternoon"

      for (const slot of RICE_SLOTS) {
        values[`temp${day}Rice${period}T${slot}`] = row[`temp${day}_rice_${periodColumn}_t${slot}`] ?? null
      }
    }
  }

  return values
}

function mapExperiment(row: DbExperimentRow): Experiment {
  return {
    id: row.id,
    number: row.number,
    strain: row.strain,
    fungusId: row.fungus_id ?? null,
    strainAcronym: row.strain_acronym ?? null,
    strainVariable: row.strain_variable ?? null,
    strainObservation: row.strain_observation ?? null,
    status: row.status ?? "active",
    canceledAt: row.canceled_at ?? null,
    canceledBy: row.canceled_by ?? null,
    startDate: row.start_date,
    testCount: row.test_count,
    repetitionCount: row.repetition_count,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

function mapTest(row: DbTestRow): Test {
  return {
    id: row.id,
    experimentId: row.experiment_id,
    repetitionNumber: row.repetition_number,
    testNumber: row.test_number,
    testType: row.test_type,

    unit: row.unit,
    requisition: row.requisition,

    testLot: row.test_lot,
    matrixLot: row.matrix_lot,
    strain: row.strain,
    mpLot: row.mp_lot,

    averageHumidity: row.average_humidity,
    bozo: row.bozo,
    sensorial: row.sensorial,
    quantity: row.quantity,

    temp7Chamber: row.temp7_chamber,
    temp14Chamber: row.temp14_chamber,
    temp7Rice: row.temp7_rice,
    temp14Rice: row.temp14_rice,

    wetWeight: row.wet_weight,
    dryWeight: row.dry_weight,
    extractedConidiumWeight: row.extracted_conidium_weight,

    date7Day: row.date_7_day,
    date14Day: row.date_14_day,

    annotations7Day: row.annotations_7_day,
    annotations14Day: row.annotations_14_day,

    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    ...mapTemperatureFields(row),

    testPhotos: (row.test_photos ?? []).map((photo) => ({
      id: photo.id,
      testId: photo.test_id,
      day: photo.day,
      storagePath: photo.storage_path,
      createdAt: photo.created_at,
      kind: photo.kind,
      photoIndex: photo.photo_index,
    })),
  }
}

/**
 * Retorna o próximo número de experimento (MAX(number)+1)
 */
export async function getNextExperimentNumber(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("experiments")
    .select("number")
    .order("number", { ascending: false })
    .limit(1)

  if (error) throw error
  const last = data?.[0]?.number ?? 0
  return Number(last) + 1
}

/**
 * Lista de experimentos
 */
export async function getExperiments(supabase: SupabaseClient): Promise<Experiment[]> {
  try {
    const { data, error } = await supabase.from("experiments").select("*").order("number", { ascending: false })

    if (error) {
      console.error("[Experiments] Error fetching experiments:", error)
      return []
    }
    const rows = (data ?? []) as unknown as DbExperimentRow[]
    return rows.map(mapExperiment)
  } catch (err) {
    console.error("[Experiments] Exception fetching experiments:", err)
    return []
  }
}

/**
 * Busca um experimento pelo UUID (id)
 */
export async function getExperimentById(supabase: SupabaseClient, id: string): Promise<Experiment | null> {
  try {
    // NOTE:
    // `.single()` throws a 406 (PGRST116) when 0 rows are returned.
    // That becomes a noisy "Cannot coerce the result to a single JSON object" error.
    // `.maybeSingle()` returns `data=null` with `error=null` when 0 rows match.
    const { data, error } = await supabase.from("experiments").select("*").eq("id", id).maybeSingle()

    if (error) {
      console.error("[Experiments] Error fetching experiment by id:", error)
      return null
    }
    if (!data) return null
    return mapExperiment(data as unknown as DbExperimentRow)
  } catch (err) {
    console.error("[Experiments] Exception fetching experiment by id:", err)
    return null
  }
}

/**
 * Lista testes de um experimento
 */
export async function getTestsByExperiment(supabase: SupabaseClient, experimentId: string): Promise<Test[]> {
  try {
    const { data, error } = await supabase
      .from("tests")
      .select("*")
      .eq("experiment_id", experimentId)
      .order("repetition_number", { ascending: true })
      .order("test_number", { ascending: true })

    if (error) {
      console.error("[Experiments] Error fetching tests:", error)
      return []
    }
    const rows = (data ?? []) as unknown as DbTestRow[]
    return rows.map(mapTest)
  } catch (err) {
    console.error("[Experiments] Exception fetching tests:", err)
    return []
  }
}

/**
 * Cria experimento
 * (Se você já faz isso direto na página, pode deixar essa função só para uso futuro.)
 */
export async function createExperiment(
  supabase: SupabaseClient,
  input: {
    number: number
    strain: string
    startDate: string
    testCount: number
    repetitionCount: number
    createdBy?: string | null
  },
): Promise<Experiment> {
  const payload = {
    number: input.number,
    strain: input.strain,
    start_date: input.startDate,
    test_count: input.testCount,
    repetition_count: input.repetitionCount,
    created_by: input.createdBy ?? null,
  }

  const { data, error } = await supabase.from("experiments").insert(payload).select("*").single()
  if (error) throw error
  return mapExperiment(data as unknown as DbExperimentRow)
}

/**
 * Cancela/inativa experimento sem remover registros do banco.
 */
export async function cancelExperiment(supabase: SupabaseClient, experimentId: string) {
  if (typeof window !== "undefined") {
    const res = await fetch(`/api/experiments/${experimentId}/cancel`, { method: "POST" })
    if (!res.ok) {
      const msg = await res.text().catch(() => "")
      throw new Error(msg || `Falha ao cancelar experimento (${res.status})`)
    }
    return
  }

  const { error } = await supabase
    .from("experiments")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("id", experimentId)
  if (error) throw error
}

/**
 * Reativa experimento cancelado.
 */
export async function restoreExperiment(supabase: SupabaseClient, experimentId: string) {
  if (typeof window !== "undefined") {
    const res = await fetch(`/api/experiments/${experimentId}/restore`, { method: "POST" })
    if (!res.ok) {
      const msg = await res.text().catch(() => "")
      throw new Error(msg || `Falha ao reativar experimento (${res.status})`)
    }
    return
  }

  const { error } = await supabase
    .from("experiments")
    .update({ status: "active", canceled_at: null, canceled_by: null })
    .eq("id", experimentId)
  if (error) throw error
}

/**
 * Mantém compatibilidade com chamadas antigas: agora a lixeira apenas cancela/inativa.
 */
export async function deleteExperiment(supabase: SupabaseClient, experimentId: string) {
  return cancelExperiment(supabase, experimentId)
}

/**
 * Lista experimentos já com os testes (1 chamada só).
 * Útil para dashboard para evitar N+1 queries.
 */
export async function getExperimentsWithTests(supabase: SupabaseClient): Promise<ExperimentWithTests[]> {
  try {
    const { data, error } = await supabase
      .from("experiments")
      .select(`
        id,
        number,
        strain,
        fungus_id,
        strain_acronym,
        strain_variable,
        strain_observation,
        status,
        canceled_at,
        canceled_by,
        start_date,
        test_count,
        repetition_count,
        created_by,
        created_at,
        tests (
          *,
          test_photos (
            id,
            test_id,
            day,
            storage_path,
            created_at,
            kind,
            photo_index
          )
        )
      `)
      .order("number", { ascending: false })

    if (error) {
      console.error("[Experiments] Error fetching experiments with tests:", error)
      return []
    }

    const rows = (data ?? []) as any[]
    return rows.map((row) => {
      const exp = mapExperiment(row as any)
      const tests = (row.tests ?? []) as any[]
      return {
        ...exp,
        tests: tests.map(mapTest),
      }
    })
  } catch (err) {
    console.error("[Experiments] Exception fetching experiments with tests:", err)
    return []
  }
}
