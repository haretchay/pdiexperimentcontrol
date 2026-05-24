import { createClient } from "@/lib/supabase/server"
import { getAllTests, type TestPhotoRow, type TestRow } from "@/lib/supabase/tests"
import { TestsPageClient } from "@/components/tests/tests-page-client"

export type TestStatusFilter = "all" | "Pendente" | "Inserir Fotos" | "Em andamento" | "Concluído"
export type TestUnitFilter = "Salto" | "Americana"
export type TestStatusVariant = "pending" | "warning" | "info" | "success"

export type UITestRow = {
  id: string
  experimentId: string
  experimentNumber: string
  experimentStrain: string
  startDate: string
  createdAt: string
  repetitionNumber: number
  testNumber: number
  testType?: string
  unit?: string
  requisition?: string
  date7Day?: string
  date14Day?: string
  status: Exclude<TestStatusFilter, "all">
  statusVariant: TestStatusVariant
  dataProgressPct: number
  filledFields: number
  requiredFields: number
  photos7Count: number
  photos14Count: number
  viewHref: string
  editHref: string
}

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

function pad3(n: number) {
  return String(n).padStart(3, "0")
}

function safeNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isNaN(v) ? undefined : v
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."))
    return Number.isNaN(n) ? undefined : n
  }
  return undefined
}

function isFieldFilled(testData: TestStatusRecord, field: string): boolean {
  const value = testData[field]

  if (typeof value === "number") return !Number.isNaN(value)
  if (typeof value === "string") return value.trim() !== ""
  if (Array.isArray(value)) return value.length > 0

  return value !== undefined && value !== null
}

function getFilledRequiredCount(testData: TestStatusRecord | null | undefined): number {
  if (!testData) return 0
  return REQUIRED_TEST_FIELDS.filter((field) => isFieldFilled(testData, field)).length
}

function pct(count: number, total: number): number {
  if (!Number.isFinite(count) || !Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((count / total) * 100)))
}

function getTestStatus(testData: TestStatusRecord | null | undefined): {
  status: UITestRow["status"]
  variant: TestStatusVariant
} {
  if (!testData) return { status: "Pendente", variant: "pending" }

  const allFieldsFilled = REQUIRED_TEST_FIELDS.every((field) => isFieldFilled(testData, field))
  const activityFields = REQUIRED_TEST_FIELDS.filter((field) => field !== "strain")
  const hasAnyFieldFilled = activityFields.some((field) => isFieldFilled(testData, field))
  const hasPhoto7 = Array.isArray(testData.photos7DayPaths) && testData.photos7DayPaths.length > 0
  const hasPhoto14 = Array.isArray(testData.photos14DayPaths) && testData.photos14DayPaths.length > 0
  const hasAnyPhoto = hasPhoto7 || hasPhoto14
  const hasBothPhotos = hasPhoto7 && hasPhoto14

  if (!hasAnyFieldFilled && !hasAnyPhoto) return { status: "Pendente", variant: "pending" }
  if (allFieldsFilled && hasBothPhotos) return { status: "Concluído", variant: "success" }
  if (!hasAnyPhoto) return { status: "Inserir Fotos", variant: "warning" }

  return { status: "Em andamento", variant: "info" }
}

function getStoragePaths(photos: TestPhotoRow[] | null | undefined, day: 7 | 14): string[] {
  return (photos ?? [])
    .filter((photo) => photo.day === day && typeof photo.storage_path === "string" && photo.storage_path.trim() !== "")
    .map((photo) => String(photo.storage_path))
}

function mapTemperatureFieldsFromRow(row: TestRow): Record<string, number | undefined> {
  const values: Record<string, number | undefined> = {}

  for (const day of TEMPERATURE_DAYS) {
    values[`temp${day}Chamber`] = safeNumber(row[`temp${day}_chamber`])

    for (const period of RICE_PERIODS) {
      const periodColumn = period === "Morning" ? "morning" : "afternoon"

      for (const slot of RICE_SLOTS) {
        values[`temp${day}Rice${period}T${slot}`] = safeNumber(row[`temp${day}_rice_${periodColumn}_t${slot}`])
      }
    }
  }

  return values
}

function mapRow(row: TestRow): UITestRow {
  const expNumber = row.experiments?.number ?? 0
  const photos7DayPaths = getStoragePaths(row.test_photos, 7)
  const photos14DayPaths = getStoragePaths(row.test_photos, 14)

  const statusRecord: TestStatusRecord = {
    unit: row.unit,
    requisition: row.requisition,
    testLot: row.test_lot,
    matrixLot: row.matrix_lot,
    strain: row.strain ?? row.experiments?.strain ?? null,
    mpLot: row.mp_lot,
    averageHumidity: safeNumber(row.average_humidity) ?? null,
    bozo: safeNumber(row.bozo) ?? null,
    sensorial: safeNumber(row.sensorial) ?? null,
    quantity: safeNumber(row.quantity) ?? null,
    testType: row.test_type,
    date7Day: row.date_7_day,
    date14Day: row.date_14_day,
    ...mapTemperatureFieldsFromRow(row),
    wetWeight: safeNumber(row.wet_weight) ?? null,
    dryWeight: safeNumber(row.dry_weight) ?? null,
    extractedConidiumWeight: safeNumber(row.extracted_conidium_weight) ?? null,
    photos7DayPaths,
    photos14DayPaths,
  }

  const filledFields = getFilledRequiredCount(statusRecord)
  const { status, variant } = getTestStatus(statusRecord)

  return {
    id: row.id,
    experimentId: row.experiment_id,
    experimentNumber: pad3(expNumber),
    experimentStrain: row.experiments?.strain ?? row.strain ?? "-",
    startDate: row.experiments?.start_date ?? row.created_at ?? "",
    createdAt: row.created_at,
    repetitionNumber: row.repetition_number,
    testNumber: row.test_number,
    testType: row.test_type ?? undefined,
    unit: row.unit ?? undefined,
    requisition: row.requisition ?? undefined,
    date7Day: row.date_7_day ?? undefined,
    date14Day: row.date_14_day ?? undefined,
    status,
    statusVariant: variant,
    dataProgressPct: pct(filledFields, REQUIRED_TEST_FIELDS.length),
    filledFields,
    requiredFields: REQUIRED_TEST_FIELDS.length,
    photos7Count: photos7DayPaths.length,
    photos14Count: photos14DayPaths.length,
    viewHref: `/experiments/${row.experiment_id}/repetition/${row.repetition_number}/test/${row.test_number}/view`,
    editHref: `/experiments/${row.experiment_id}/repetition/${row.repetition_number}/test/${row.test_number}`,
  }
}

export default async function TestsPage() {
  try {
    const supabase = await createClient()
    const rows = await getAllTests(supabase)
    const items = rows.map(mapRow)

    return <TestsPageClient initialTests={items} />
  } catch (error) {
    console.error("[TestsPage] Error loading tests:", error)
    return <TestsPageClient initialTests={[]} />
  }
}
