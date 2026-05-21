import { createClient } from "@/lib/supabase/server"
import { getExperimentsWithTests, type ExperimentWithTests, type Test } from "@/lib/supabase/experiments"
import { ExperimentsPageClient } from "@/components/experiments/experiments-page-client"

export type ExperimentUnitFilter = "Salto" | "Americana"

export type UIExperiment = {
  id: string
  number: string
  strain: string
  startDate: string
  testCount: number
  repetitionCount: number
  totalTests: number
  completedTests: number
  inProgressTests: number
  needsPhotosTests: number
  pendingTests: number
  progressCompletedPct: number
  progressInProgressPct: number
  progressActivePct: number
  testTypes?: string[]
  units?: string[]
}

type TestStatus = "Pendente" | "Inserir Fotos" | "Em andamento" | "Concluído"

type TestStatusRecord = {
  [key: string]: unknown

  unit?: string | null
  requisition?: string | null
  testLot?: string | null
  matrixLot?: string | null
  strain?: string | null
  mpLot?: string | null

  averageHumidity?: number | null
  bozo?: number | null
  sensorial?: number | null
  quantity?: number | null

  testType?: string | null

  date7Day?: string | null
  date14Day?: string | null

  wetWeight?: number | null
  dryWeight?: number | null
  extractedConidiumWeight?: number | null

  photos7DayPaths?: string[]
  photos14DayPaths?: string[]
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

function isFieldFilled(testData: TestStatusRecord, field: string): boolean {
  const value = testData[field]

  if (typeof value === "number") return !Number.isNaN(value)
  if (typeof value === "string") return value.trim() !== ""
  if (Array.isArray(value)) return value.length > 0

  return value !== undefined && value !== null
}

function getTestStatus(testData: TestStatusRecord | null | undefined): TestStatus {
  if (!testData) return "Pendente"

  const allFieldsFilled = REQUIRED_TEST_FIELDS.every((field) => isFieldFilled(testData, field))
  const activityFields = REQUIRED_TEST_FIELDS.filter((field) => field !== "strain")
  const hasAnyFieldFilled = activityFields.some((field) => isFieldFilled(testData, field))
  const hasPhoto7 = Array.isArray(testData.photos7DayPaths) && testData.photos7DayPaths.length > 0
  const hasPhoto14 = Array.isArray(testData.photos14DayPaths) && testData.photos14DayPaths.length > 0
  const hasAnyPhoto = hasPhoto7 || hasPhoto14
  const hasBothPhotos = hasPhoto7 && hasPhoto14

  if (!hasAnyFieldFilled && !hasAnyPhoto) return "Pendente"
  if (allFieldsFilled && hasBothPhotos) return "Concluído"
  if (!hasAnyPhoto) return "Inserir Fotos"

  return "Em andamento"
}

function mapTemperatureFields(test: Test): Record<string, unknown> {
  const temperatures: Record<string, unknown> = {}

  for (const day of TEMPERATURE_DAYS) {
    temperatures[`temp${day}Chamber`] = test[`temp${day}Chamber`]

    for (const period of RICE_PERIODS) {
      for (const slot of RICE_SLOTS) {
        temperatures[`temp${day}Rice${period}T${slot}`] = test[`temp${day}Rice${period}T${slot}`]
      }
    }
  }

  return temperatures
}

function mapTestToStatusRecord(test: Test | null | undefined): TestStatusRecord | null {
  if (!test) return null

  return {
    unit: test.unit,
    requisition: test.requisition,
    testLot: test.testLot,
    matrixLot: test.matrixLot,
    strain: test.strain,
    mpLot: test.mpLot,
    averageHumidity: test.averageHumidity,
    bozo: test.bozo,
    sensorial: test.sensorial,
    quantity: test.quantity,
    testType: test.testType,
    date7Day: test.date7Day,
    date14Day: test.date14Day,
    ...mapTemperatureFields(test),
    wetWeight: test.wetWeight,
    dryWeight: test.dryWeight,
    extractedConidiumWeight: test.extractedConidiumWeight,
    photos7DayPaths: test.testPhotos.filter((photo) => photo.day === 7 && Boolean(photo.storagePath)).map((photo) => photo.storagePath),
    photos14DayPaths: test.testPhotos.filter((photo) => photo.day === 14 && Boolean(photo.storagePath)).map((photo) => photo.storagePath),
  }
}

function pct(count: number, total: number): number {
  if (!Number.isFinite(count) || !Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((count / total) * 100)))
}

function normalizeExperimentUnit(value: string | null | undefined): ExperimentUnitFilter | null {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return null
  if (normalized.includes("salto")) return "Salto"
  if (normalized.includes("americana")) return "Americana"
  return null
}

function getExperimentUnits(tests: Test[]): ExperimentUnitFilter[] {
  const units = new Set<ExperimentUnitFilter>()

  for (const test of tests ?? []) {
    const unit = normalizeExperimentUnit(test.unit)
    if (unit) units.add(unit)
  }

  return Array.from(units)
}

function mapDbToUI(exp: ExperimentWithTests): UIExperiment {
  const testCount = exp.testCount ?? 0
  const repetitionCount = exp.repetitionCount ?? 0
  const totalTests = testCount * repetitionCount
  const testsByPosition = new Map<string, Test>()

  for (const test of exp.tests ?? []) {
    testsByPosition.set(`${test.repetitionNumber}_${test.testNumber}`, test)
  }

  let completedTests = 0
  let inProgressTests = 0
  let needsPhotosTests = 0
  let pendingTests = 0

  for (let repetition = 1; repetition <= repetitionCount; repetition++) {
    for (let testNumber = 1; testNumber <= testCount; testNumber++) {
      const test = testsByPosition.get(`${repetition}_${testNumber}`)
      const status = getTestStatus(mapTestToStatusRecord(test))

      if (status === "Concluído") completedTests += 1
      else if (status === "Em andamento") inProgressTests += 1
      else if (status === "Inserir Fotos") needsPhotosTests += 1
      else pendingTests += 1
    }
  }

  const progressCompletedPct = pct(completedTests, totalTests)
  const progressInProgressPct = pct(inProgressTests, totalTests)

  return {
    id: exp.id,
    number: String(exp.number).padStart(3, "0"),
    strain: exp.strain,
    startDate: exp.startDate,
    testCount,
    repetitionCount,
    totalTests,
    completedTests,
    inProgressTests,
    needsPhotosTests,
    pendingTests,
    progressCompletedPct,
    progressInProgressPct,
    progressActivePct: Math.min(100, progressCompletedPct + progressInProgressPct),
    testTypes: [],
    units: getExperimentUnits(exp.tests ?? []),
  }
}

export default async function ExperimentsPage() {
  let experiments: ExperimentWithTests[] = []

  try {
    const supabase = await createClient()
    experiments = await getExperimentsWithTests(supabase)
  } catch (error) {
    console.error("[v0] Error loading experiments:", error)
  }

  const uiExperiments = (experiments ?? []).map(mapDbToUI)

  return <ExperimentsPageClient initialExperiments={uiExperiments} />
}
