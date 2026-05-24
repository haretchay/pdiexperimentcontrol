import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { DashboardClient } from "@/components/dashboard/dashboard-client"
import { getExperimentsWithTests, type Test } from "@/lib/supabase/experiments"

export const runtime = "nodejs"

export type TestStatus = "Pendente" | "Inserir Fotos" | "Em andamento" | "Concluído"

export type UIDashboardTest = {
  id: string
  experimentId: string
  experimentNumber: number
  experimentStrain: string
  startDate: string
  repetitionNumber: number
  testNumber: number
  status: TestStatus
  dataProgressPct: number
  filledFields: number
  requiredFields: number
  photos7Count: number
  photos14Count: number
  unit?: string
  averageHumidity?: number
  bozo?: number
  sensorial?: number
  quantity?: number
  wetWeight?: number
  dryWeight?: number
  extractedConidiumWeight?: number
  chamberTemperatureAvg?: number
  riceTemperatureAvg?: number
  updatedAt: string
  viewHref: string
  editHref: string
}

export type UIDashboardExperiment = {
  id: string
  number: number
  strain: string
  startDate: string
  testCount: number
  repetitionCount: number
  totalTests: number
  completedTests: number
  inProgressTests: number
  insertPhotosTests: number
  pendingTests: number
  dataProgressPct: number
  mediaProgressPct: number
  units: string[]
  testsData: UIDashboardTest[]
}

const TEMPERATURE_DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const
const RICE_PERIODS = ["Morning", "Afternoon"] as const
const RICE_SLOTS = [1, 2, 3] as const

const REQUIRED_TEMPERATURE_FIELDS = TEMPERATURE_DAYS.flatMap((day) => [
  `temp${day}Chamber`,
  ...RICE_PERIODS.flatMap((period) => RICE_SLOTS.map((slot) => `temp${day}Rice${period}T${slot}`)),
])

const REQUIRED_TEST_FIELDS = [
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
  ...REQUIRED_TEMPERATURE_FIELDS,
  "wetWeight",
  "dryWeight",
  "extractedConidiumWeight",
]

function isFilled(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value === "string") return value.trim() !== ""
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null
}

function safeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function pct(count: number, total: number): number {
  if (!Number.isFinite(count) || !Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((count / total) * 100)))
}

function average(values: Array<number | undefined>): number | undefined {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (valid.length === 0) return undefined
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10
}

function getStoragePaths(test: Test, day: 7 | 14): string[] {
  return (test.testPhotos ?? [])
    .filter((photo) => photo.day === day && typeof photo.storagePath === "string" && photo.storagePath.trim() !== "")
    .map((photo) => photo.storagePath)
}

function getFilledRequiredCount(test: Test): number {
  return REQUIRED_TEST_FIELDS.filter((field) => isFilled(test[field])).length
}

function getTestStatus(test: Test): TestStatus {
  const allFieldsFilled = REQUIRED_TEST_FIELDS.every((field) => isFilled(test[field]))
  const activityFields = REQUIRED_TEST_FIELDS.filter((field) => field !== "strain")
  const hasAnyFieldFilled = activityFields.some((field) => isFilled(test[field]))
  const hasPhoto7 = getStoragePaths(test, 7).length > 0
  const hasPhoto14 = getStoragePaths(test, 14).length > 0
  const hasAnyPhoto = hasPhoto7 || hasPhoto14

  if (!hasAnyFieldFilled && !hasAnyPhoto) return "Pendente"
  if (allFieldsFilled && hasPhoto7 && hasPhoto14) return "Concluído"
  if (!hasAnyPhoto) return "Inserir Fotos"
  return "Em andamento"
}

function getChamberAverage(test: Test): number | undefined {
  return average(TEMPERATURE_DAYS.map((day) => safeNumber(test[`temp${day}Chamber`])))
}

function getRiceAverage(test: Test): number | undefined {
  const values: Array<number | undefined> = []

  for (const day of TEMPERATURE_DAYS) {
    for (const period of RICE_PERIODS) {
      for (const slot of RICE_SLOTS) {
        values.push(safeNumber(test[`temp${day}Rice${period}T${slot}`]))
      }
    }
  }

  return average(values)
}

function normalizeUnit(value: string | null | undefined): string | undefined {
  const text = String(value ?? "").trim()
  if (!text) return undefined
  if (text.toLowerCase().includes("salto")) return "Salto"
  if (text.toLowerCase().includes("americana")) return "Americana"
  return text
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()

  if (!auth.user) {
    return <DashboardClient experiments={[]} />
  }

  const dbClient = createAdminClient() ?? supabase
  const rows = await getExperimentsWithTests(dbClient)

  const experiments: UIDashboardExperiment[] = rows.map((row) => {
    const testsData: UIDashboardTest[] = (row.tests ?? []).map((test) => {
      const filledFields = getFilledRequiredCount(test)
      const photos7Count = getStoragePaths(test, 7).length
      const photos14Count = getStoragePaths(test, 14).length
      const unit = normalizeUnit(test.unit)

      return {
        id: test.id,
        experimentId: row.id,
        experimentNumber: row.number,
        experimentStrain: test.strain ?? row.strain,
        startDate: row.startDate,
        repetitionNumber: test.repetitionNumber,
        testNumber: test.testNumber,
        status: getTestStatus(test),
        dataProgressPct: pct(filledFields, REQUIRED_TEST_FIELDS.length),
        filledFields,
        requiredFields: REQUIRED_TEST_FIELDS.length,
        photos7Count,
        photos14Count,
        unit,
        averageHumidity: safeNumber(test.averageHumidity),
        bozo: safeNumber(test.bozo),
        sensorial: safeNumber(test.sensorial),
        quantity: safeNumber(test.quantity),
        wetWeight: safeNumber(test.wetWeight),
        dryWeight: safeNumber(test.dryWeight),
        extractedConidiumWeight: safeNumber(test.extractedConidiumWeight),
        chamberTemperatureAvg: getChamberAverage(test),
        riceTemperatureAvg: getRiceAverage(test),
        updatedAt: test.updatedAt ?? test.createdAt,
        viewHref: `/experiments/${row.id}/repetition/${test.repetitionNumber}/test/${test.testNumber}/view`,
        editHref: `/experiments/${row.id}/repetition/${test.repetitionNumber}/test/${test.testNumber}`,
      }
    })

    const totalTests = testsData.length
    const completedTests = testsData.filter((test) => test.status === "Concluído").length
    const inProgressTests = testsData.filter((test) => test.status === "Em andamento").length
    const insertPhotosTests = testsData.filter((test) => test.status === "Inserir Fotos").length
    const pendingTests = testsData.filter((test) => test.status === "Pendente").length
    const expectedPhotos = totalTests * 2
    const actualPhotos = testsData.reduce((sum, test) => sum + Math.min(1, test.photos7Count) + Math.min(1, test.photos14Count), 0)
    const units = Array.from(new Set(testsData.map((test) => test.unit).filter((value): value is string => Boolean(value))))

    return {
      id: row.id,
      number: row.number,
      strain: row.strain,
      startDate: row.startDate,
      testCount: row.testCount,
      repetitionCount: row.repetitionCount,
      totalTests,
      completedTests,
      inProgressTests,
      insertPhotosTests,
      pendingTests,
      dataProgressPct: totalTests > 0 ? Math.round(testsData.reduce((sum, test) => sum + test.dataProgressPct, 0) / totalTests) : 0,
      mediaProgressPct: pct(actualPhotos, expectedPhotos),
      units,
      testsData,
    }
  })

  return <DashboardClient experiments={experiments} />
}
