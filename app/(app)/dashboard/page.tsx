import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { DashboardClient } from "@/components/dashboard/dashboard-client"
import { getExperimentsWithTests, type Test } from "@/lib/supabase/experiments"

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

type TestStatus = "Pendente" | "Inserir Fotos" | "Em andamento" | "Concluído"

type UITest = {
  id: string
  repetitionNumber: number
  testNumber: number
  status: TestStatus
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

function isFilled(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value === "string") return value.trim() !== ""
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null
}

function getTestStatus(test: Test): TestStatus {
  const fields: Array<keyof Test> = [
    "unit",
    "requisition",
    "testLot",
    "matrixLot",
    "strain",
    "mpLot",
    "averageHumidity",
    "bozo",
    "sensorial",
    "quantity",
    "testType",
    "date7Day",
    "date14Day",
    "temp7Chamber",
    "temp7Rice",
    "temp14Chamber",
    "temp14Rice",
    "wetWeight",
    "dryWeight",
    "extractedConidiumWeight",
  ]

  const allFieldsFilled = fields.every((field) => isFilled(test[field]))
  const activityFields = fields.filter((field) => field !== "strain")
  const hasAnyFieldFilled = activityFields.some((field) => isFilled(test[field]))

  const hasPhoto7 = (test.testPhotos ?? []).some((photo) => photo.day === 7 && isFilled(photo.storagePath))
  const hasPhoto14 = (test.testPhotos ?? []).some((photo) => photo.day === 14 && isFilled(photo.storagePath))
  const hasAnyPhoto = hasPhoto7 || hasPhoto14

  if (!hasAnyFieldFilled && !hasAnyPhoto) return "Pendente"
  if (allFieldsFilled && hasPhoto7 && hasPhoto14) return "Concluído"
  if (!hasAnyPhoto) return "Inserir Fotos"
  return "Em andamento"
}

function toOptionalNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // Garante que a página continua protegida por sessão, mas permite usar service role
  // somente para leitura agregada quando a variável SUPABASE_SERVICE_ROLE_KEY existir.
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) {
    return <DashboardClient experiments={[]} experimentData={[]} />
  }

  const dbClient = createAdminClient() ?? supabase
  const rows = await getExperimentsWithTests(dbClient)

  const experimentData: ExperimentData[] = rows.map((row) => {
    const testsWithStatus = (row.tests ?? []).map((test) => ({ test, status: getTestStatus(test) }))
    const visibleTests = testsWithStatus.filter((item) => item.status !== "Pendente")

    const testsData: UITest[] = visibleTests.map(({ test, status }) => ({
      id: test.id,
      repetitionNumber: test.repetitionNumber,
      testNumber: test.testNumber,
      status,
      averageHumidity: toOptionalNumber(test.averageHumidity),
      bozo: toOptionalNumber(test.bozo),
      sensorial: toOptionalNumber(test.sensorial),
      temp7Chamber: toOptionalNumber(test.temp7Chamber),
      temp14Chamber: toOptionalNumber(test.temp14Chamber),
      temp7Rice: toOptionalNumber(test.temp7Rice),
      temp14Rice: toOptionalNumber(test.temp14Rice),
      createdAt: test.updatedAt ?? test.createdAt,
    }))

    return {
      id: row.id,
      number: row.number,
      strain: row.strain,
      startDate: row.startDate,
      testsData,
      completedTests: visibleTests.filter((item) => item.status === "Concluído").length,
    }
  })

  const experiments: UIExperiment[] = rows.map((row) => {
    const matchingData = experimentData.find((item) => item.id === row.id)
    const nonPendingCount = matchingData?.testsData.length ?? 0

    return {
      id: row.id,
      number: row.number,
      strain: row.strain,
      startDate: row.startDate,
      testCount: row.testCount,
      repetitionCount: row.repetitionCount,
      // No dashboard, pendentes não entram em gráficos/percentuais.
      totalTests: nonPendingCount,
    }
  })

  return <DashboardClient experiments={experiments as any} experimentData={experimentData as any} />
}
