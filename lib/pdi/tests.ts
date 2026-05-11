import type { SupabaseClient } from "@supabase/supabase-js"

export type TestRow = {
  id: string
  experiment_id: string
  repetition_number: number
  test_number: number
  unit: string | null
  requisition: string | null
  test_type: string | null
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

export type EnsureTestRowInput = {
  experimentId: string
  repetitionNumber: number
  testNumber: number
  createdBy: string
  defaultStrain?: string | null
}

export type CreateMissingTestsInput = {
  experimentId: string
  repetitionCount: number
  testCount: number
  createdBy: string
  defaultStrain?: string | null
}

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} inválido.`)
  }
}

/**
 * Garante que exista exatamente uma linha em public.tests para a combinação:
 * experiment_id + repetition_number + test_number.
 *
 * Importante:
 * - Não usa upsert para não sobrescrever dados já preenchidos pelo usuário.
 * - Em caso de corrida entre duas abas, se o insert bater na constraint única,
 *   a função busca novamente a linha criada pela outra requisição.
 */
export async function ensureTestRow(supabase: SupabaseClient, input: EnsureTestRowInput): Promise<TestRow> {
  assertPositiveInteger(input.repetitionNumber, "Número da repetição")
  assertPositiveInteger(input.testNumber, "Número do teste")

  const baseQuery = () =>
    supabase
      .from("tests")
      .select("*")
      .eq("experiment_id", input.experimentId)
      .eq("repetition_number", input.repetitionNumber)
      .eq("test_number", input.testNumber)
      .maybeSingle()

  const { data: existing, error: selectError } = await baseQuery()

  if (selectError) {
    throw new Error(`Erro ao consultar teste existente: ${selectError.message}`)
  }

  if (existing) {
    return existing as TestRow
  }

  const { data: inserted, error: insertError } = await supabase
    .from("tests")
    .insert({
      experiment_id: input.experimentId,
      repetition_number: input.repetitionNumber,
      test_number: input.testNumber,
      strain: input.defaultStrain ?? null,
      created_by: input.createdBy,
    })
    .select("*")
    .single()

  if (!insertError && inserted) {
    return inserted as TestRow
  }

  // 23505 = unique_violation. Pode acontecer se duas abas tentarem criar o mesmo teste ao mesmo tempo.
  if (insertError?.code === "23505") {
    const { data: afterRace, error: afterRaceError } = await baseQuery()

    if (afterRaceError) {
      throw new Error(`Erro ao recuperar teste após conflito de criação: ${afterRaceError.message}`)
    }

    if (afterRace) {
      return afterRace as TestRow
    }
  }

  throw new Error(`Erro ao criar teste automaticamente: ${insertError?.message ?? "erro desconhecido"}`)
}

/**
 * Cria, de forma idempotente, todas as linhas de testes esperadas para um experimento.
 * Requer a constraint/índice único em:
 * (experiment_id, repetition_number, test_number).
 */
export async function createMissingTestsForExperiment(
  supabase: SupabaseClient,
  input: CreateMissingTestsInput,
): Promise<TestRow[]> {
  assertPositiveInteger(input.repetitionCount, "Quantidade de repetições")
  assertPositiveInteger(input.testCount, "Quantidade de testes")

  const rows: Array<{
    experiment_id: string
    repetition_number: number
    test_number: number
    strain: string | null
    created_by: string
  }> = []

  for (let repetition = 1; repetition <= input.repetitionCount; repetition++) {
    for (let test = 1; test <= input.testCount; test++) {
      rows.push({
        experiment_id: input.experimentId,
        repetition_number: repetition,
        test_number: test,
        strain: input.defaultStrain ?? null,
        created_by: input.createdBy,
      })
    }
  }

  if (rows.length === 0) return []

  const { data, error } = await supabase
    .from("tests")
    .upsert(rows, {
      onConflict: "experiment_id,repetition_number,test_number",
      ignoreDuplicates: true,
    })
    .select("*")

  if (error) {
    throw new Error(`Erro ao gerar testes do experimento: ${error.message}`)
  }

  return (data ?? []) as TestRow[]
}

export async function listTestsByExperiment(supabase: SupabaseClient, experimentId: string): Promise<TestRow[]> {
  const { data, error } = await supabase
    .from("tests")
    .select("*")
    .eq("experiment_id", experimentId)
    .order("repetition_number", { ascending: true })
    .order("test_number", { ascending: true })

  if (error) {
    throw new Error(`Erro ao listar testes do experimento: ${error.message}`)
  }

  return (data ?? []) as TestRow[]
}
