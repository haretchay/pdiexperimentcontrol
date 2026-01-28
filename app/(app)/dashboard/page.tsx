import { createClient } from "@/lib/supabase/server"
import { DashboardClient } from "@/components/dashboard/dashboard-client"
import { getExperimentsWithTests } from "@/lib/supabase/experiments"

export const runtime = "nodejs"

type UIExperiment = {
  id: string
  number: number
  strain: string
  startDate: string
  testCount: number
  repetitionCount: number
  totalTests: number
}

type UITest = {
  id: string
  repetitionNumber: number
  testNumber: number
  averageHumidity?: number
  bozo?: number
  sensorial?: number
  temp7Chamber?: number
  temp14Chamber?: number
  temp7Rice?: number
  temp14Rice?: number
  createdAt: string
}

type ExperimentData = {
  id: string
  number: number
  strain: string
  startDate: string
  testsData: UITest[]
  completedTests: number
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // Autenticação já é garantida em app/(app)/layout.tsx (requireActiveUser).
  // Aqui reduzimos chamadas: 1 query trazendo experiments + tests.

  const rows = await getExperimentsWithTests(supabase)

  const experiments: UIExperiment[] = rows.map((row) => ({
    id: row.id,
    number: row.number,
    strain: row.strain,
    startDate: row.startDate,
    testCount: row.testCount,
    repetitionCount: row.repetitionCount,
    totalTests: (row.testCount ?? 0) * (row.repetitionCount ?? 0),
  }))

  const experimentData: ExperimentData[] = rows.map((row) => {
    const testsData: UITest[] = (row.tests ?? []).map((t) => ({
      id: t.id,
      repetitionNumber: t.repetitionNumber,
      testNumber: t.testNumber,
      averageHumidity: t.averageHumidity ?? undefined,
      bozo: t.bozo ?? undefined,
      sensorial: t.sensorial ?? undefined,
      temp7Chamber: t.temp7Chamber ?? undefined,
      temp14Chamber: t.temp14Chamber ?? undefined,
      temp7Rice: t.temp7Rice ?? undefined,
      temp14Rice: t.temp14Rice ?? undefined,
      createdAt: t.createdAt,
    }))

    return {
      id: row.id,
      number: row.number,
      strain: row.strain,
      startDate: row.startDate,
      testsData,
      completedTests: testsData.length,
    }
  })

  return <DashboardClient experiments={experiments as any} experimentData={experimentData as any} />
}
