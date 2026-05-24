import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { DashboardClient } from "@/components/dashboard/dashboard-client"
import { getExperimentsWithTests, type Test } from "@/lib/supabase/experiments"

export const runtime = "nodejs"

type UIExperiment = {
  id: string
  number: number
  strain: string
  fungusId: string | null
  fungusName: string
  startDate: string
  testCount: number
  repetitionCount: number
  totalTests: number
}

type FungusInfo = {
  id: string
  scientificName: string
  optimalTemperature: number | null
  minTemperature: number | null
  maxTemperature: number | null
}

type TemperatureDay = {
  day: number
  chamber?: number
  rice?: number
}

type TestStatus = "Pendente" | "Inserir Fotos" | "Em andamento" | "Concluído"

type UITest = {
  id: string
  repetitionNumber: number
  testNumber: number
  status: TestStatus
  unit?: string
  wetWeight?: number
  dryWeight?: number
  extractedConidiumWeight?: number
  averageHumidity?: number
  bozo?: number
  sensorial?: number
  temperatureDays: TemperatureDay[]
  avgRiceTemperature?: number
  avgChamberTemperature?: number
  createdAt: string
}

type ExperimentData = {
  id: string
  number: number
  strain: string
  fungusId: string | null
  fungusName: string
  fungusOptimalTemperature: number | null
  fungusMinTemperature: number | null
  fungusMaxTemperature: number | null
  startDate: string
  testsData: UITest[]
  completedTests: number
}

type DbFungusRow = {
  id: string
  scientific_name: string
  optimal_temperature: number | null
  min_temperature: number | null
  max_temperature: number | null
}

const TEMPERATURE_DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const
const RICE_PERIODS = ["Morning", "Afternoon"] as const
const RICE_SLOTS = [1, 2, 3] as const

function isFilled(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value === "string") return value.trim() !== ""
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null
}

function toOptionalNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function average(values: Array<number | null | undefined>): number | undefined {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (valid.length === 0) return undefined
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10
}

function getRiceAverageForDay(test: Test, day: number): number | undefined {
  const readings: Array<number | null | undefined> = []

  for (const period of RICE_PERIODS) {
    for (const slot of RICE_SLOTS) {
      readings.push(test[`temp${day}Rice${period}T${slot}`])
    }
  }

  return average(readings) ?? toOptionalNumber(test[`temp${day}Rice`])
}

function getTemperatureDays(test: Test): TemperatureDay[] {
  return TEMPERATURE_DAYS.map((day) => ({
    day,
    chamber: toOptionalNumber(test[`temp${day}Chamber`]),
    rice: getRiceAverageForDay(test, day),
  }))
}

function getTestStatus(test: Test): TestStatus {
  const baseFields: Array<keyof Test> = [
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
    "wetWeight",
    "dryWeight",
    "extractedConidiumWeight",
  ]

  const temperatureFields = TEMPERATURE_DAYS.flatMap((day) => [
    `temp${day}Chamber`,
    `temp${day}RiceMorningT1`,
    `temp${day}RiceAfternoonT1`,
  ]) as Array<keyof Test>

  const requiredFields = [...baseFields, ...temperatureFields]
  const allFieldsFilled = requiredFields.every((field) => isFilled(test[field]))
  const hasAnyFieldFilled = requiredFields.some((field) => isFilled(test[field]))

  const hasPhoto7 = (test.testPhotos ?? []).some((photo) => photo.day === 7 && isFilled(photo.storagePath))
  const hasPhoto14 = (test.testPhotos ?? []).some((photo) => photo.day === 14 && isFilled(photo.storagePath))
  const hasAnyPhoto = hasPhoto7 || hasPhoto14

  if (!hasAnyFieldFilled && !hasAnyPhoto) return "Pendente"
  if (allFieldsFilled && hasPhoto7 && hasPhoto14) return "Concluído"
  if (!hasAnyPhoto) return "Inserir Fotos"
  return "Em andamento"
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()

  if (!auth.user) {
    return <DashboardClient experiments={[]} experimentData={[]} fungi={[]} />
  }

  const dbClient = createAdminClient() ?? supabase
  const [rows, fungiResult] = await Promise.all([
    getExperimentsWithTests(dbClient),
    dbClient.from("fungi").select("id, scientific_name, optimal_temperature, min_temperature, max_temperature").order("scientific_name", { ascending: true }),
  ])

  const fungi: FungusInfo[] = ((fungiResult.data ?? []) as DbFungusRow[]).map((fungus) => ({
    id: fungus.id,
    scientificName: fungus.scientific_name,
    optimalTemperature: toOptionalNumber(fungus.optimal_temperature) ?? null,
    minTemperature: toOptionalNumber(fungus.min_temperature) ?? null,
    maxTemperature: toOptionalNumber(fungus.max_temperature) ?? null,
  }))

  const fungiById = new Map(fungi.map((fungus) => [fungus.id, fungus]))

  const experimentData: ExperimentData[] = rows.map((row) => {
    const fungus = row.fungusId ? fungiById.get(row.fungusId) : undefined

    const testsWithStatus = (row.tests ?? []).map((test) => ({ test, status: getTestStatus(test) }))

    const testsData: UITest[] = testsWithStatus.map(({ test, status }) => {
      const temperatureDays = getTemperatureDays(test)
      const avgRiceTemperature = average(temperatureDays.map((item) => item.rice))
      const avgChamberTemperature = average(temperatureDays.map((item) => item.chamber))

      return {
        id: test.id,
        repetitionNumber: test.repetitionNumber,
        testNumber: test.testNumber,
        status,
        unit: test.unit ?? undefined,
        wetWeight: toOptionalNumber(test.wetWeight),
        dryWeight: toOptionalNumber(test.dryWeight),
        extractedConidiumWeight: toOptionalNumber(test.extractedConidiumWeight),
        averageHumidity: toOptionalNumber(test.averageHumidity),
        bozo: toOptionalNumber(test.bozo),
        sensorial: toOptionalNumber(test.sensorial),
        temperatureDays,
        avgRiceTemperature,
        avgChamberTemperature,
        createdAt: test.updatedAt ?? test.createdAt,
      }
    })

    return {
      id: row.id,
      number: row.number,
      strain: row.strain,
      fungusId: row.fungusId,
      fungusName: fungus?.scientificName ?? "Sem fungo vinculado",
      fungusOptimalTemperature: fungus?.optimalTemperature ?? null,
      fungusMinTemperature: fungus?.minTemperature ?? null,
      fungusMaxTemperature: fungus?.maxTemperature ?? null,
      startDate: row.startDate,
      testsData,
      completedTests: testsWithStatus.filter((item) => item.status === "Concluído").length,
    }
  })

  const experiments: UIExperiment[] = rows.map((row) => {
    const matchingData = experimentData.find((item) => item.id === row.id)
    const fungus = row.fungusId ? fungiById.get(row.fungusId) : undefined

    return {
      id: row.id,
      number: row.number,
      strain: row.strain,
      fungusId: row.fungusId,
      fungusName: fungus?.scientificName ?? "Sem fungo vinculado",
      startDate: row.startDate,
      testCount: row.testCount,
      repetitionCount: row.repetitionCount,
      totalTests: matchingData?.testsData.length ?? 0,
    }
  })

  return <DashboardClient experiments={experiments} experimentData={experimentData} fungi={fungi} />
}
