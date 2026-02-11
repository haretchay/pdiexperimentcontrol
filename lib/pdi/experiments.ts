import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * ATENÇÃO (legacy):
 * Este arquivo existia com um schema antigo (user_id, start_date snake_case, etc.).
 * Para evitar imports acidentais quebrando o sistema, mantemos wrappers compatíveis
 * apontando para as funções oficiais em lib/supabase/experiments.ts.
 */

import {
  getExperiments,
  createExperiment as createExperimentOfficial,
  type Experiment,
} from "@/lib/supabase/experiments"

export async function listExperiments(supabase: SupabaseClient): Promise<Experiment[]> {
  return await getExperiments(supabase)
}

export async function createExperiment(
  supabase: SupabaseClient,
  input: {
    number: number
    start_date?: string
    strain?: string
    repetition_count: number
    test_count: number
  },
) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error("Not authenticated")

  const startDate = input.start_date ?? new Date().toISOString().slice(0, 10)

  return await createExperimentOfficial(supabase, {
    number: input.number,
    strain: input.strain ?? "N/A",
    startDate,
    testCount: input.test_count,
    repetitionCount: input.repetition_count,
    createdBy: auth.user.id,
  })
}
