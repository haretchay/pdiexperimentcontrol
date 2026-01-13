import { createClient } from "@/lib/supabase/server"
import { getExperiments, type Experiment as DbExperiment } from "@/lib/supabase/experiments"
import { ExperimentsPageClient } from "@/components/experiments/experiments-page-client"

export type UIExperiment = {
  id: string
  number: string
  strain: string
  startDate: string
  testCount: number
  repetitionCount: number
  totalTests: number
  testTypes?: string[]
}

function mapDbToUI(exp: DbExperiment): UIExperiment {
  const testCount = exp.testCount ?? 0
  const repetitionCount = exp.repetitionCount ?? 0

  return {
    id: exp.id,
    number: String(exp.number).padStart(3, "0"),
    strain: exp.strain,
    startDate: exp.startDate,
    testCount,
    repetitionCount,
    totalTests: testCount * repetitionCount,
    testTypes: [],
  }
}

export default async function ExperimentsPage() {
  const supabase = createClient()
  const experiments = await getExperiments(supabase)

  const uiExperiments = (experiments ?? []).map(mapDbToUI)

  return <ExperimentsPageClient initialExperiments={uiExperiments} />
}
