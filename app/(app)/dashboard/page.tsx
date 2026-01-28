import { createClient } from "@/lib/supabase/server"
import { DashboardClient } from "@/components/dashboard/dashboard-client"

export const runtime = "nodejs"

function isRateLimitError(err: unknown) {
  const msg = String((err as any)?.message ?? err ?? "")
  const status = (err as any)?.status

  return (
    status === 429 ||
    msg.includes("Too Many") ||
    msg.includes("Too many") ||
    msg.includes("rate limit") ||
    msg.includes("Unexpected token 'T'")
  )
}

type DbTestRow = {
  id: string
  repetition_number: number
  test_number: number

  average_humidity: number | null
  bozo: number | null
  sensorial: number | null

  temp7_chamber: number | null
  temp14_chamber: number | null
  temp7_rice: number | null
  temp14_rice: number | null

  created_at: string
}

type DbExperimentRow = {
  id: string
  number: number
  strain: string
  start_date: string
  test_count: number
  repetition_count: number
  tests?: DbTestRow[] | null
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // Autenticação já é tratada no app/(app)/layout.tsx via requireActiveUser().
  // Aqui focamos em carregar dados com o mínimo de chamadas possível (evita 429).

  let experiments: any[] = []
  let experimentData: any[] = []

  try {
    const { data, error } = await supabase
      .from("experiments")
      .select(
        `
        id,
        number,
        strain,
        start_date,
        test_count,
        repetition_count,
        tests (
          id,
          repetition_number,
          test_number,
          average_humidity,
          bozo,
          sensorial,
          temp7_chamber,
          temp14_chamber,
          temp7_rice,
          temp14_rice,
          created_at
        )
      `,
      )
      .order("number", { ascending: false })

    if (error) throw error

    const rows = (data ?? []) as unknown as DbExperimentRow[]

    experiments = rows.map((row) => ({
      id: row.id,
      number: row.number,
      strain: row.strain,
      startDate: row.start_date,
      testCount: row.test_count,
      repetitionCount: row.repetition_count,
      totalTests: (row.test_count ?? 0) * (row.repetition_count ?? 0),
    }))

    experimentData = rows.map((row) => {
      const tests = (row.tests ?? []) as DbTestRow[]
      const testsData = tests.map((t) => ({
        id: t.id,
        repetitionNumber: t.repetition_number,
        testNumber: t.test_number,
        averageHumidity: t.average_humidity ?? undefined,
        bozo: t.bozo ?? undefined,
        sensorial: t.sensorial ?? undefined,
        temp7Chamber: t.temp7_chamber ?? undefined,
        temp14Chamber: t.temp14_chamber ?? undefined,
        temp7Rice: t.temp7_rice ?? undefined,
        temp14Rice: t.temp14_rice ?? undefined,
        createdAt: t.created_at,
      }))

      return {
        id: row.id,
        number: row.number,
        strain: row.strain,
        startDate: row.start_date,
        testsData,
        completedTests: testsData.length,
      }
    })
  } catch (error) {
    console.error("[dashboard] Error loading data:", error)

    if (isRateLimitError(error)) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-semibold">Muitas requisições ao Supabase</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você atingiu temporariamente o limite de requisições (429). Aguarde alguns segundos e recarregue.
          </p>
        </div>
      )
    }
  }

  return <DashboardClient experiments={experiments} experimentData={experimentData} />
}
