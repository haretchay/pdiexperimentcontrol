import { createClient } from "@/lib/supabase/server"
import { getExperiments, type Experiment as DbExperiment } from "@/lib/supabase/experiments"
import { RepetitionsPageClient } from "@/components/repetitions/repetitions-page-client"

export type UIRepetition = {
  experimentId: string
  experimentNumber: string
  strain: string
  startDate: string
  repetitionNumber: number
  testCount: number
}

function pad3(n: number) {
  return String(n).padStart(3, "0")
}

export default async function RepetitionsPage() {
  const supabase = await createClient()
  const experiments = await getExperiments(supabase)

  const reps: UIRepetition[] = []

  ;(experiments ?? []).forEach((exp: DbExperiment) => {
    for (let rep = 1; rep <= (exp.repetitionCount ?? 0); rep++) {
      reps.push({
        experimentId: exp.id,
        experimentNumber: pad3(exp.number),
        strain: exp.strain,
        startDate: exp.startDate,
        repetitionNumber: rep,
        testCount: exp.testCount ?? 0,
      })
    }
  })

  // Ordenar por data mais recente (opcional)
  reps.sort((a, b) => (a.startDate < b.startDate ? 1 : -1))

  return <RepetitionsPageClient initialRepetitions={reps} />
}
