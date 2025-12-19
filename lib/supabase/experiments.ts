import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Tipos do banco (snake_case)
 */
type DbExperimentRow = {
  id: string
  number: number
  strain: string
  start_date: string // date => string (YYYY-MM-DD)
  test_count: number
  repetition_count: number
  created_by: string | null
  created_at: string
}

type DbTestRow = {
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

  temp7_chamber: number | null
  temp14_chamber: number | null
  temp7_rice: number | null
  temp14_rice: number | null

  wet_weight: number | null
  dry_weight: number | null
  extracted_conidium_weight: number | null

  date_7_day: string | null
  date_14_day: string | null

  annotations_7_day: Record<string, unknown> | null
  annotations_14_day: Record<string, unknown> | null

  created_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Tipos usados na UI (camelCase)
 */
export type Experiment = {
  id: string
  number: number
  strain: string
  startDate: string
  testCount: number
  repetitionCount: number
  createdBy: string | null
  createdAt: string
}

export type Test = {
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
}

function mapExperiment(row: DbExperimentRow): Experiment {
  return {
    id: row.id,
    number: row.number,
    strain: row.strain,
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
  }
}

/**
 * Retorna o próximo número de experimento (MAX(number)+1)
 */
export async function getNextExperimentNumber(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.from("experiments").select("number").order("number", { ascending: false }).limit(1)

  if (error) throw error
  const last = data?.[0]?.number ?? 0
  return Number(last) + 1
}

/**
 * Lista de experimentos
 */
export async function getExperiments(supabase: SupabaseClient): Promise<Experiment[]> {
  const { data, error } = await supabase.from("experiments").select("*").order("number", { ascending: false })

  if (error) throw error
  const rows = (data ?? []) as unknown as DbExperimentRow[]
  return rows.map(mapExperiment)
}

/**
 * Busca um experimento pelo UUID (id)
 */
export async function getExperimentById(supabase: SupabaseClient, id: string): Promise<Experiment> {
  const { data, error } = await supabase.from("experiments").select("*").eq("id", id).single()

  if (error) throw error
  return mapExperiment(data as unknown as DbExperimentRow)
}

/**
 * Lista testes de um experimento
 */
export async function getTestsByExperiment(supabase: SupabaseClient, experimentId: string): Promise<Test[]> {
  const { data, error } = await supabase
    .from("tests")
    .select("*")
    .eq("experiment_id", experimentId)
    .order("repetition_number", { ascending: true })
    .order("test_number", { ascending: true })

  if (error) throw error
  const rows = (data ?? []) as unknown as DbTestRow[]
  return rows.map(mapTest)
}

/**
 * Cria experimento
 * (Se você já faz isso direto na página, pode deixar essa função só para uso futuro.)
 */
export async function createExperiment(
  supabase: SupabaseClient,
  input: { number: number; strain: string; startDate: string; testCount: number; repetitionCount: number; createdBy?: string | null },
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
 * Deleta experimento (admin-only no seu RLS)
 */
export async function deleteExperiment(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("experiments").delete().eq("id", id)
  if (error) throw error
}
