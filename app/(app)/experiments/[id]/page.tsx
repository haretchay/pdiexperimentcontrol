"use client"

import type { MouseEvent } from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Edit,
  Eye,
  FlaskConical,
  Image as ImageIcon,
  Layers3,
  LockKeyhole,
  Share2,
  Sparkles,
  Thermometer,
  TrendingUp,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExportExperimentQRCodesButton } from "@/components/experiments/qr-export-buttons"

import { useIsMobile } from "@/hooks/use-mobile"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

type StatusVariant = "default" | "secondary" | "destructive" | "outline" | "warning" | "info" | "success"

type DbExperimentRow = {
  id: string
  number: number
  repetition_count: number
  test_count: number
  start_date: string
  strain: string
}

type DbTestPhotoRow = {
  day: number
  storage_path: string
  created_at?: string | null
  kind?: "single" | "merged" | null
  photo_index?: number | null
}

type DbTestRow = {
  [key: string]: unknown
  id: string
  experiment_id: string
  repetition_number: number
  test_number: number

  unit: string | null
  requisition: string | null
  test_type: string | null
  test_lot: string | null
  matrix_lot: string | null
  strain: string | null
  mp_lot: string | null

  average_humidity: number | null
  bozo: number | null
  sensorial: number | null
  quantity: number | null

  temp7_chamber: number | null
  temp14_chamber: number | null
  temp7_rice: number | null
  temp14_rice: number | null

  wet_weight: number | null
  dry_weight: number | null
  extracted_conidium_weight: number | null

  date_7_day: string | null
  date_14_day: string | null

  annotations_7_day: any
  annotations_14_day: any

  test_photos?: DbTestPhotoRow[] | null
}

type ExperimentUI = {
  id: string
  number: number
  repetitionCount: number
  testCount: number
  testTypes: string[] // (por enquanto vazio; o tipo real do teste vem de tests.test_type)
  startDate: string
  strain: string
  totalTests: number
}

type TestSummary = {
  id: number
  number: number
  completed: boolean
  testType: string
  status: string
  variant: StatusVariant
}

type Repetition = {
  id: number
  number: number
  tests: TestSummary[]
  completed: boolean
  unlocked: boolean
}

const TEMPERATURE_DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const
const RICE_PERIODS = ["Morning", "Afternoon"] as const
const RICE_SLOTS = [1, 2, 3] as const

const REQUIRED_TEMPERATURE_FIELDS = TEMPERATURE_DAYS.flatMap((day) => [
  `temp${day}Chamber`,
  ...RICE_PERIODS.flatMap((period) => RICE_SLOTS.map((slot) => `temp${day}Rice${period}T${slot}`)),
])

type TestDataRecord = {
  [key: string]: unknown
  testUuid: string

  unit?: string
  requisition?: string
  testLot?: string
  matrixLot?: string
  strain?: string
  mpLot?: string

  averageHumidity?: number
  bozo?: number
  sensorial?: number
  quantity?: number

  testType?: string

  date7Day?: string
  date14Day?: string

  temp7Chamber?: number
  temp7Rice?: number
  temp14Chamber?: number
  temp14Rice?: number

  wetWeight?: number
  dryWeight?: number
  extractedConidiumWeight?: number

  photos7DayPaths?: string[]
  photos14DayPaths?: string[]
}

function isFieldFilled(testData: TestDataRecord, field: string): boolean {
  const value = testData[field]

  if (typeof value === "number") return !Number.isNaN(value)
  if (typeof value === "string") return value.trim() !== ""
  if (Array.isArray(value)) return value.length > 0

  return value !== undefined && value !== null
}

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

const getTestStatus = (testData: TestDataRecord | null | undefined): { status: string; variant: StatusVariant } => {
  if (!testData) return { status: "Pendente", variant: "warning" }

  const allFieldsFilled = REQUIRED_TEST_FIELDS.every((field) => isFieldFilled(testData, field))
  const activityFields = REQUIRED_TEST_FIELDS.filter((field) => field !== "strain")
  const hasAnyFieldFilled = activityFields.some((field) => isFieldFilled(testData, field))
  const hasPhoto7 = Array.isArray(testData.photos7DayPaths) && testData.photos7DayPaths.length > 0
  const hasPhoto14 = Array.isArray(testData.photos14DayPaths) && testData.photos14DayPaths.length > 0
  const hasAnyPhoto = hasPhoto7 || hasPhoto14
  const hasBothPhotos = hasPhoto7 && hasPhoto14

  if (!hasAnyFieldFilled && !hasAnyPhoto) return { status: "Pendente", variant: "warning" }
  if (allFieldsFilled && hasBothPhotos) return { status: "Concluído", variant: "default" }
  if (!hasAnyPhoto) return { status: "Inserir Fotos", variant: "warning" }

  return { status: "Em andamento", variant: "info" }
}

function safeNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isNaN(v) ? undefined : v
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."))
    return Number.isNaN(n) ? undefined : n
  }
  return undefined
}

function mapTemperatureFieldsFromRow(row: DbTestRow): Record<string, number | undefined> {
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

function pct(count: number, total: number): number {
  if (!Number.isFinite(count) || !Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((count / total) * 100)))
}

function formatExperimentNumber(value: number | string): string {
  const raw = String(value ?? "")
  return raw.padStart(3, "0")
}

function formatDateBR(value: string | null | undefined): string {
  if (!value) return "--/--/----"
  const [year, month, day] = String(value).slice(0, 10).split("-")
  if (!year || !month || !day) return "--/--/----"
  return `${day}/${month}/${year}`
}

function normalizeUnitLabel(value: string | undefined): string | null {
  const normalized = String(value ?? "").trim()
  if (!normalized) return null
  const lower = normalized.toLowerCase()
  if (lower.includes("salto")) return "Salto"
  if (lower.includes("americana")) return "Americana"
  return normalized
}

function getFilledRequiredCount(testData: TestDataRecord | null | undefined): number {
  if (!testData) return 0
  return REQUIRED_TEST_FIELDS.filter((field) => isFieldFilled(testData, field)).length
}

function getTestDataPct(testData: TestDataRecord | null | undefined): number {
  return pct(getFilledRequiredCount(testData), REQUIRED_TEST_FIELDS.length)
}

function getStatusBadgeClasses(variant: StatusVariant): string {
  if (variant === "default" || variant === "success") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
  }
  if (variant === "warning") {
    return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
  }
  if (variant === "info") {
    return "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
  }
  if (variant === "destructive") {
    return "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
  }
  return "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200"
}

function getStatusDotClasses(variant: StatusVariant): string {
  if (variant === "default" || variant === "success") return "bg-emerald-500"
  if (variant === "warning") return "bg-amber-500"
  if (variant === "info") return "bg-blue-500"
  if (variant === "destructive") return "bg-red-500"
  return "bg-slate-400"
}

function getStatusIcon(variant: StatusVariant) {
  if (variant === "default" || variant === "success") return <CheckCircle2 className="h-3.5 w-3.5" />
  if (variant === "warning") return <AlertTriangle className="h-3.5 w-3.5" />
  if (variant === "info") return <Clock3 className="h-3.5 w-3.5" />
  return <ClipboardList className="h-3.5 w-3.5" />
}

export default function ExperimentDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const experimentId = params?.id ?? "" // uuid (string)

  const supabase = useMemo(() => createClient(), [])

  const [experiment, setExperiment] = useState<ExperimentUI | null>(null)
  const [repetitions, setRepetitions] = useState<Repetition[]>([])
  const [testData, setTestData] = useState<Record<string, TestDataRecord>>({})

  const isMobile = useIsMobile()
  const { toast } = useToast()
  const [isSharing, setIsSharing] = useState(false)

  // Backwards-compatible alias: some old bundles referenced `testInfoByKey`.
  // Keeping this avoids runtime crashes if a stale chunk is served.
  const testInfoByKey = useMemo(() => testData ?? {}, [testData])

  // Lista achatada de testes (rep/test) para exportação de QR Codes do experimento.
  // Ordem estável: Rep 1..N, Teste 1..N. Usa fallback para cepa/lotes quando faltarem dados no teste.
  const qrTests = useMemo(() => {
    if (!experiment) return []

    const items: {
      repetitionNumber: number
      testNumber: number
      strain: string | null
      testLot: string | null
      matrixLot: string | null
    }[] = []

    for (let rep = 1; rep <= experiment.repetitionCount; rep++) {
      for (let test = 1; test <= experiment.testCount; test++) {
        const key = `${rep}_${test}`
        const info = testData[key]

        items.push({
          repetitionNumber: rep,
          testNumber: test,
          strain: (info?.strain ?? experiment.strain) ?? null,
          testLot: info?.testLot ?? null,
          matrixLot: info?.matrixLot ?? null,
        })
      }
    }

    return items
  }, [experiment, testData])


  useEffect(() => {
    let cancelled = false

    if (!experimentId) {
      router.push("/experiments")
      return () => {
        cancelled = true
      }
    }

    async function load() {
      try {
        // IMPORTANT:
        // This page is a client component. In production we may have a cookie-based session
        // (server) but no localStorage session (browser), which makes direct Supabase client
        // reads return 0 rows under RLS and `.single()` explodes with PGRST116.
        // Solution: fetch initial data from a server route that reads cookies.
        const res = await fetch(`/api/experiments/${experimentId}/detail`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        })

        if (!res.ok) {
          let msg = `Erro ao carregar experimento (${res.status})`
          try {
            const j = await res.json()
            if (j?.error) msg = String(j.error)
          } catch {
            // ignore
          }
          throw new Error(msg)
        }

        const payload = (await res.json()) as {
          experiment: DbExperimentRow | null
          tests: DbTestRow[]
        }

        if (!payload?.experiment) throw new Error("Experimento não encontrado")

        const expRow = payload.experiment

        const expUI: ExperimentUI = {
          id: expRow.id,
          number: expRow.number,
          repetitionCount: expRow.repetition_count,
          testCount: expRow.test_count,
          testTypes: [], // por enquanto não vem de experiments
          startDate: expRow.start_date,
          strain: expRow.strain,
          totalTests: expRow.repetition_count * expRow.test_count,
        }

        // 2) Tests + fotos
        const rows = (payload.tests ?? []) as DbTestRow[]

        // 3) Map rep_test
        const map: Record<string, TestDataRecord> = {}

        for (const t of rows) {
          const key = `${t.repetition_number}_${t.test_number}`

          const photos = (t.test_photos ?? []) as DbTestPhotoRow[]
          const photos7 = photos.filter((p) => p.day === 7).map((p) => p.storage_path)
          const photos14 = photos.filter((p) => p.day === 14).map((p) => p.storage_path)

          map[key] = {
            testUuid: t.id,
            unit: t.unit ?? undefined,
            requisition: t.requisition ?? undefined,
            testLot: t.test_lot ?? undefined,
            matrixLot: t.matrix_lot ?? undefined,
            strain: t.strain ?? undefined,
            mpLot: t.mp_lot ?? undefined,

            averageHumidity: safeNumber(t.average_humidity),
            bozo: safeNumber(t.bozo),
            sensorial: safeNumber(t.sensorial),
            quantity: safeNumber(t.quantity),

            testType: t.test_type ?? undefined,

            date7Day: t.date_7_day ?? undefined,
            date14Day: t.date_14_day ?? undefined,

            temp7Chamber: safeNumber(t.temp7_chamber),
            temp7Rice: safeNumber(t.temp7_rice),
            temp14Chamber: safeNumber(t.temp14_chamber),
            temp14Rice: safeNumber(t.temp14_rice),

            ...mapTemperatureFieldsFromRow(t),

            wetWeight: safeNumber(t.wet_weight),
            dryWeight: safeNumber(t.dry_weight),
            extractedConidiumWeight: safeNumber(t.extracted_conidium_weight),

            photos7DayPaths: photos7,
            photos14DayPaths: photos14,
          }
        }

        // 4) Calcula status por repetição com as mesmas regras dos cartões:
        // Pendente = sem dados e sem fotos; Inserir Fotos = dados sem fotos;
        // Em andamento = possui foto parcial; Concluído = todos os campos + fotos 7º e 14º dia.
        const repetitionsWithAllTestsDone: number[] = []

        for (let rep = 1; rep <= expUI.repetitionCount; rep++) {
          let allDone = true

          for (let test = 1; test <= expUI.testCount; test++) {
            const key = `${rep}_${test}`
            const info = map[key]
            const status = getTestStatus(info).status

            if (status !== "Concluído") {
              allDone = false
              break
            }
          }

          if (allDone) repetitionsWithAllTestsDone.push(rep)
        }

        const reps: Repetition[] = []
        for (let rep = 1; rep <= expUI.repetitionCount; rep++) {
          const isRepCompleted = repetitionsWithAllTestsDone.includes(rep)

          const testsForRep: TestSummary[] = []
          for (let test = 1; test <= expUI.testCount; test++) {
            const key = `${rep}_${test}`
            const info = map[key]

            // prioridade: tests.test_type
            const label = info?.testType ? info.testType : `Teste #${test}`

            const { status, variant } = getTestStatus(info)

            testsForRep.push({
              id: test,
              number: test,
              completed: status === "Concluído",
              testType: label,
              status,
              variant,
            })
          }

          const isUnlocked = rep === 1 || repetitionsWithAllTestsDone.includes(rep - 1)

          reps.push({
            id: rep,
            number: rep,
            tests: testsForRep,
            completed: isRepCompleted,
            unlocked: isUnlocked,
          })
        }

        if (cancelled) return

        setExperiment(expUI)
        setTestData(map)
        setRepetitions(reps)
      } catch (err: any) {
        console.error(err)
        toast({
          title: "Erro ao carregar experimento",
          description: err?.message ?? "Tente novamente.",
          variant: "destructive",
        })
        router.push("/experiments")
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [experimentId, router, supabase, toast])

  const experimentStats = useMemo(() => {
    const base = {
      total: experiment?.totalTests ?? 0,
      completed: 0,
      inProgress: 0,
      needsPhotos: 0,
      pending: 0,
      completedPct: 0,
      activePct: 0,
      dataPct: 0,
      photoPct: 0,
      testsWithBothPhotos: 0,
      photos7: 0,
      photos14: 0,
      repetitionsCompleted: 0,
      repetitionsUnlocked: 0,
      units: [] as string[],
      testTypes: [] as string[],
    }

    if (!experiment) return base

    const units = new Set<string>()
    const testTypes = new Set<string>()
    let filledFields = 0
    let possibleFields = 0

    for (let rep = 1; rep <= experiment.repetitionCount; rep++) {
      for (let test = 1; test <= experiment.testCount; test++) {
        const key = `${rep}_${test}`
        const info = testData[key]
        const { status } = getTestStatus(info)

        if (status === "Concluído") base.completed += 1
        else if (status === "Em andamento") base.inProgress += 1
        else if (status === "Inserir Fotos") base.needsPhotos += 1
        else base.pending += 1

        const photos7Count = info?.photos7DayPaths?.length ?? 0
        const photos14Count = info?.photos14DayPaths?.length ?? 0
        base.photos7 += photos7Count
        base.photos14 += photos14Count
        if (photos7Count > 0 && photos14Count > 0) base.testsWithBothPhotos += 1

        filledFields += getFilledRequiredCount(info)
        possibleFields += REQUIRED_TEST_FIELDS.length

        const unit = normalizeUnitLabel(info?.unit)
        if (unit) units.add(unit)
        if (info?.testType) testTypes.add(info.testType)
      }
    }

    base.repetitionsCompleted = repetitions.filter((repetition) => repetition.completed).length
    base.repetitionsUnlocked = repetitions.filter((repetition) => repetition.unlocked).length
    base.completedPct = pct(base.completed, base.total)
    base.activePct = pct(base.completed + base.inProgress + base.needsPhotos, base.total)
    base.dataPct = pct(filledFields, possibleFields)
    base.photoPct = pct(base.testsWithBothPhotos, base.total)
    base.units = Array.from(units)
    base.testTypes = Array.from(testTypes)

    return base
  }, [experiment, repetitions, testData])

  const handleCardClick = (repetitionId: number, testId: number) => {
    router.push(`/experiments/${experimentId}/repetition/${repetitionId}/test/${testId}/view`)
  }

  const handleEditClick = (e: MouseEvent, repetitionId: number, testId: number) => {
    e.stopPropagation()
    router.push(`/experiments/${experimentId}/repetition/${repetitionId}/test/${testId}`)
  }

  const handleShareTestPhotos = async (e: MouseEvent, repetitionId: number, testId: number) => {
    e.stopPropagation()
    try {
      setIsSharing(true)

      if (!navigator.share) {
        toast({
          title: "Compartilhamento não suportado",
          description: "Seu dispositivo não suporta compartilhamento de arquivos.",
          variant: "destructive",
        })
        return
      }

      if (!experiment) {
        toast({
          title: "Experimento não carregado",
          description: "Tente novamente em alguns instantes.",
          variant: "destructive",
        })
        return
      }

      const key = `${repetitionId}_${testId}`
      const info = testData[key]
      if (!info?.testUuid) {
        toast({
          title: "Teste não encontrado",
          description: "Não foi possível encontrar os dados deste teste.",
          variant: "destructive",
        })
        return
      }

      const paths7 = info.photos7DayPaths ?? []
      const paths14 = info.photos14DayPaths ?? []
      if (paths7.length === 0 && paths14.length === 0) {
        toast({
          title: "Sem fotos",
          description: "Este teste não possui fotos para compartilhar.",
          variant: "destructive",
        })
        return
      }

      const shareComposite = window.confirm(
        "Deseja compartilhar fotos compostas com legenda? OK = composta | Cancelar = simples",
      )

      async function signedUrl(path: string) {
        const { data, error } = await supabase.storage.from("test-photos").createSignedUrl(path, 60 * 60)
        if (error) throw error
        return data.signedUrl
      }

      type CaptionInfo = {
        experimentNumber: number
        repetitionNumber: number
        testNumber: number
        strain?: string
        day: 7 | 14
        unit?: string
        testLot?: string
        matrixLot?: string
        date?: string
        temperature?: { chamber?: number; rice?: number }
        photoIndex: number
      }

      const allPhotos: Array<{ url: string; testInfo: CaptionInfo }> = []

      for (let i = 0; i < paths7.length; i++) {
        allPhotos.push({
          url: await signedUrl(paths7[i]),
          testInfo: {
            experimentNumber: experiment.number,
            repetitionNumber: repetitionId,
            testNumber: testId,
            strain: info.strain ?? experiment.strain,
            day: 7,
            unit: info.unit,
            testLot: info.testLot,
            matrixLot: info.matrixLot,
            date: info.date7Day ? new Date(info.date7Day).toLocaleDateString("pt-BR") : undefined,
            temperature: { chamber: info.temp7Chamber, rice: info.temp7Rice },
            photoIndex: i + 1,
          },
        })
      }

      for (let i = 0; i < paths14.length; i++) {
        allPhotos.push({
          url: await signedUrl(paths14[i]),
          testInfo: {
            experimentNumber: experiment.number,
            repetitionNumber: repetitionId,
            testNumber: testId,
            strain: info.strain ?? experiment.strain,
            day: 14,
            unit: info.unit,
            testLot: info.testLot,
            matrixLot: info.matrixLot,
            date: info.date14Day ? new Date(info.date14Day).toLocaleDateString("pt-BR") : undefined,
            temperature: { chamber: info.temp14Chamber, rice: info.temp14Rice },
            photoIndex: i + 1,
          },
        })
      }

      const createImageWithCaption = async (
        photoData: { url: string; testInfo: CaptionInfo },
        isComposite: boolean,
      ): Promise<Blob> => {
        return new Promise<Blob>((resolve, reject) => {
          const { url, testInfo } = photoData
          const img = new window.Image()
          img.crossOrigin = "anonymous"
          img.onload = () => {
            try {
              const canvas = document.createElement("canvas")
              const ctx = canvas.getContext("2d")
              if (!ctx) return reject(new Error("Não foi possível obter contexto do canvas"))

              const captionHeight = 120
              const padding = 10

              if (!isComposite) {
                const size = Math.max(img.width, img.height)
                canvas.width = size
                canvas.height = size + captionHeight

                ctx.fillStyle = "#000000"
                ctx.fillRect(0, 0, canvas.width, canvas.height)

                const offsetX = (size - img.width) / 2
                const offsetY = (size - img.height) / 2
                ctx.drawImage(img, offsetX, offsetY, img.width, img.height)

                ctx.fillStyle = "#FFFFFF"
                ctx.font = "bold 14px Arial"

                let y = size + 20
                ctx.fillText(
                  `Exp #${testInfo.experimentNumber} - Rep #${testInfo.repetitionNumber} - Teste #${testInfo.testNumber}`,
                  padding,
                  y,
                )
                y += 20
                ctx.fillText(
                  `Dia: ${testInfo.day}º - Cepa: ${testInfo.strain || "N/A"} - Foto ${testInfo.photoIndex}`,
                  padding,
                  y,
                )
                y += 20
                ctx.fillText(
                  `Data: ${testInfo.date || "N/A"} - Unidade: ${testInfo.unit === "americana" ? "Americana" : "Salto"}`,
                  padding,
                  y,
                )
                y += 20
                ctx.fillText(
                  `Lote Teste: ${testInfo.testLot || "N/A"} - Lote Matriz: ${testInfo.matrixLot || "N/A"}`,
                  padding,
                  y,
                )
                y += 20
                ctx.fillText(
                  `Temp. Câmara: ${testInfo.temperature?.chamber ?? "N/A"} ºC - Temp. Arroz: ${testInfo.temperature?.rice ?? "N/A"} ºC`,
                  padding,
                  y,
                )
              } else {
                canvas.width = img.width
                canvas.height = img.height + captionHeight

                ctx.fillStyle = "#000000"
                ctx.fillRect(0, 0, canvas.width, canvas.height)

                ctx.drawImage(img, 0, 0, img.width, img.height)

                ctx.fillStyle = "#FFFFFF"
                ctx.font = "bold 14px Arial"

                let y = img.height + 20
                ctx.fillText(
                  `Experimento #${testInfo.experimentNumber} - Repetição #${testInfo.repetitionNumber} - Teste #${testInfo.testNumber}`,
                  padding,
                  y,
                )
                y += 20
                ctx.fillText(
                  `Dia: ${testInfo.day}º - Cepa: ${testInfo.strain || "N/A"} - Foto ${testInfo.photoIndex}`,
                  padding,
                  y,
                )
                y += 20
                ctx.fillText(
                  `Data: ${testInfo.date || "N/A"} - Unidade: ${testInfo.unit === "americana" ? "Americana" : "Salto"}`,
                  padding,
                  y,
                )
                y += 20
                ctx.fillText(
                  `Lote Teste: ${testInfo.testLot || "N/A"} - Lote Matriz: ${testInfo.matrixLot || "N/A"}`,
                  padding,
                  y,
                )
                y += 20
                ctx.fillText(
                  `Temp. Câmara: ${testInfo.temperature?.chamber ?? "N/A"} ºC - Temp. Arroz: ${testInfo.temperature?.rice ?? "N/A"} ºC`,
                  padding,
                  y,
                )
              }

              canvas.toBlob(
                (blob) => {
                  if (!blob) return reject(new Error("Falha ao converter canvas para blob"))
                  resolve(blob)
                },
                "image/jpeg",
                0.9,
              )
            } catch (err) {
              reject(err instanceof Error ? err : new Error("Erro ao gerar imagem"))
            }
          }
          img.onerror = () => reject(new Error("Falha ao carregar imagem"))
          img.src = url
        })
      }

      toast({ title: "Preparando imagens", description: "Gerando arquivos para compartilhamento..." })

      const files: File[] = []
      for (let i = 0; i < allPhotos.length; i++) {
        const photo = allPhotos[i]
        const blob = await createImageWithCaption(photo, shareComposite)
        files.push(
          new File(
            [blob],
            `Exp${photo.testInfo.experimentNumber}_Rep${photo.testInfo.repetitionNumber}_Test${photo.testInfo.testNumber}_Dia${photo.testInfo.day}_Foto${photo.testInfo.photoIndex}.jpg`,
            { type: "image/jpeg" },
          ),
        )
      }

      await navigator.share({
        files,
        title: `Fotos do Teste #${testId} - Repetição #${repetitionId}`,
        text: `Experimento #${experiment.number} - Repetição #${repetitionId} - Teste #${testId}`,
      })

      toast({ title: "Compartilhado", description: `${files.length} foto(s) enviada(s).` })
    } catch (err: any) {
      console.error(err)
      if (err?.name !== "AbortError") {
        toast({
          title: "Erro ao compartilhar",
          description: err?.message ?? "Tente novamente.",
          variant: "destructive",
        })
      }
    } finally {
      setIsSharing(false)
    }
  }

  if (!experiment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/70 px-3 py-6 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/30">
        <div className="mx-auto flex min-h-[60vh] w-full max-w-7xl items-center justify-center">
          <Card className="w-full max-w-md border-blue-100 shadow-lg dark:border-blue-950">
            <CardContent className="flex items-center gap-3 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                <FlaskConical className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-50">Carregando experimento...</p>
                <p className="text-sm text-muted-foreground">Buscando repetições, testes e mídias.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const completedWidth = experimentStats.completedPct
  const inProgressWidth = pct(experimentStats.inProgress, experimentStats.total)
  const needsPhotosWidth = pct(experimentStats.needsPhotos, experimentStats.total)
  const hasSecondaryProgress = inProgressWidth > 0 || needsPhotosWidth > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/70 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/30">
      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href="/experiments">
            <Button variant="ghost" size="sm" className="rounded-full border border-slate-200 bg-white/80 shadow-sm hover:bg-white dark:border-slate-800 dark:bg-slate-950/80">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>

        <Card className="mb-5 overflow-hidden border-0 bg-white shadow-xl shadow-blue-950/5 dark:bg-slate-950">
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 p-[1px]">
            <div className="rounded-t-lg bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 px-4 py-5 text-white sm:px-6 lg:px-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/20">
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      Visão geral do experimento
                    </Badge>
                    <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/20">
                      {experimentStats.completed}/{experimentStats.total} testes concluídos
                    </Badge>
                  </div>

                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                    Experimento #{formatExperimentNumber(experiment.number)}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-blue-50">
                    <span className="inline-flex items-center gap-1.5">
                      <FlaskConical className="h-4 w-4" />
                      Cepa: <strong className="font-semibold text-white">{experiment.strain}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" />
                      Início: <strong className="font-semibold text-white">{formatDateBR(experiment.startDate)}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Layers3 className="h-4 w-4" />
                      {experiment.repetitionCount} repetição(ões) × {experiment.testCount} teste(s)
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <ExportExperimentQRCodesButton
                    experimentId={experiment.id}
                    experimentNumber={experiment.number}
                    experimentStrain={experiment.strain}
                    tests={qrTests}
                  />
                </div>
              </div>
            </div>
          </div>

          <CardContent className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.25fr_0.75fr] lg:p-6">
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 dark:border-blue-950 dark:from-blue-950/30 dark:to-slate-950">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-200">Progresso concluído</p>
                  <p className="mt-1 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                    {experimentStats.completedPct}%
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-900/20">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>

              <div className="h-4 overflow-hidden rounded-full bg-slate-200 shadow-inner dark:bg-slate-800">
                <div className="flex h-full w-full">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${completedWidth}%` }} />
                  <div className="h-full bg-blue-500 transition-all" style={{ width: `${inProgressWidth}%` }} />
                  <div className="h-full bg-amber-400 transition-all" style={{ width: `${needsPhotosWidth}%` }} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Concluído</span>
                {hasSecondaryProgress && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />Em andamento</span>}
                {needsPhotosWidth > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Inserir fotos</span>}
                <span className="ml-auto font-medium text-slate-700 dark:text-slate-200">{experimentStats.completed} de {experimentStats.total}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dados preenchidos</p>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <span className="text-3xl font-black text-slate-950 dark:text-white">{experimentStats.dataPct}%</span>
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mídias completas</p>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <span className="text-3xl font-black text-slate-950 dark:text-white">{experimentStats.photoPct}%</span>
                  <ImageIcon className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Card className="border-emerald-100 bg-white shadow-sm dark:border-emerald-950 dark:bg-slate-950">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Concluídos</p>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-300">{experimentStats.completed}</p>
            </CardContent>
          </Card>

          <Card className="border-blue-100 bg-white shadow-sm dark:border-blue-950 dark:bg-slate-950">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Em andamento</p>
                <Clock3 className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-blue-700 dark:text-blue-300">{experimentStats.inProgress}</p>
            </CardContent>
          </Card>

          <Card className="border-amber-100 bg-white shadow-sm dark:border-amber-950 dark:bg-slate-950">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inserir fotos</p>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-amber-700 dark:text-amber-300">{experimentStats.needsPhotos}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pendentes</p>
                <ClipboardList className="h-4 w-4 text-slate-500" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-100">{experimentStats.pending}</p>
            </CardContent>
          </Card>

          <Card className="border-purple-100 bg-white shadow-sm dark:border-purple-950 dark:bg-slate-950">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Repetições</p>
                <Layers3 className="h-4 w-4 text-purple-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-purple-700 dark:text-purple-300">
                {experimentStats.repetitionsCompleted}/{experiment.repetitionCount}
              </p>
            </CardContent>
          </Card>

          <Card className="border-cyan-100 bg-white shadow-sm dark:border-cyan-950 dark:bg-slate-950">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fotos 7º/14º</p>
                <ImageIcon className="h-4 w-4 text-cyan-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-cyan-700 dark:text-cyan-300">
                {experimentStats.photos7}/{experimentStats.photos14}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-5 grid gap-3 lg:grid-cols-3">
          <Card className="border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                <Thermometer className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Temperaturas monitoradas</p>
                <p className="text-xs text-muted-foreground">14 dias de câmara + manhã/tarde do arroz.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-200">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Unidades com testes</p>
                <p className="truncate text-xs text-muted-foreground">
                  {experimentStats.units.length > 0 ? experimentStats.units.join(" • ") : "Ainda sem unidade informada"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                <Eye className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Acesso rápido</p>
                <p className="text-xs text-muted-foreground">Clique no card para visualizar. Use “Editar” para preencher.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="repetition-1" className="w-full">
          <div className="mb-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
            <TabsList className="h-auto w-max gap-2 bg-transparent p-0">
              {repetitions.map((repetition) => (
                <TabsTrigger
                  key={repetition.id}
                  value={`repetition-${repetition.id}`}
                  disabled={!repetition.unlocked}
                  className="rounded-xl border border-transparent px-4 py-2 data-[state=active]:border-blue-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md dark:data-[state=active]:border-blue-900"
                >
                  <span className="flex items-center gap-2">
                    {!repetition.unlocked ? <LockKeyhole className="h-4 w-4" /> : <Layers3 className="h-4 w-4" />}
                    Repetição {repetition.number}
                    {repetition.completed && <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {repetitions.map((repetition) => {
            const repetitionCompleted = repetition.tests.filter((test) => test.completed).length
            const repetitionProgress = pct(repetitionCompleted, repetition.tests.length)

            return (
              <TabsContent key={repetition.id} value={`repetition-${repetition.id}`} className="m-0 w-full p-0">
                {!repetition.unlocked ? (
                  <Card className="border-amber-200 bg-amber-50/70 shadow-sm dark:border-amber-950 dark:bg-amber-950/20">
                    <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200">
                        <LockKeyhole className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">Repetição bloqueada</p>
                        <p className="text-sm text-muted-foreground">Esta repetição será liberada após a conclusão da repetição anterior.</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/85">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h2 className="text-lg font-bold text-slate-950 dark:text-white">Repetição {repetition.number}</h2>
                          <p className="text-sm text-muted-foreground">{repetitionCompleted} de {repetition.tests.length} teste(s) concluído(s)</p>
                        </div>
                        <div className="flex min-w-[220px] items-center gap-3">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-500" style={{ width: `${repetitionProgress}%` }} />
                          </div>
                          <span className="w-10 text-right text-sm font-bold text-slate-800 dark:text-slate-100">{repetitionProgress}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {repetition.tests.map((test) => {
                        const key = `${repetition.id}_${test.id}`
                        const info = testData[key]
                        const dataPct = getTestDataPct(info)
                        const filledCount = getFilledRequiredCount(info)
                        const photos7 = info?.photos7DayPaths?.length ?? 0
                        const photos14 = info?.photos14DayPaths?.length ?? 0
                        const unitLabel = normalizeUnitLabel(info?.unit)

                        return (
                          <Card
                            key={test.id}
                            className="group cursor-pointer overflow-hidden border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-950/10 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-900"
                            onClick={() => handleCardClick(repetition.id, test.id)}
                          >
                            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/80 p-4 dark:border-slate-800 dark:from-slate-900 dark:to-blue-950/30">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="mb-2 flex items-center gap-2">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-sm font-black text-white shadow-md">
                                      {test.number}
                                    </span>
                                    <div className="min-w-0">
                                      <CardTitle className="truncate text-base font-bold text-slate-950 dark:text-white">
                                        Teste #{test.number}
                                      </CardTitle>
                                      <CardDescription className="truncate text-xs">
                                        {test.testType || "Tipo de teste não informado"}
                                      </CardDescription>
                                    </div>
                                  </div>

                                  <Badge variant="outline" className={`${getStatusBadgeClasses(test.variant)} gap-1.5`}>
                                    {getStatusIcon(test.variant)}
                                    {test.status}
                                  </Badge>
                                </div>

                                <span className={`mt-1 h-3 w-3 rounded-full ${getStatusDotClasses(test.variant)} shadow-sm`} />
                              </div>
                            </CardHeader>

                            <CardContent className="space-y-4 p-4">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/70">
                                  <p className="text-muted-foreground">Unidade</p>
                                  <p className="mt-0.5 truncate font-semibold text-slate-900 dark:text-slate-100">{unitLabel ?? "-"}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/70">
                                  <p className="text-muted-foreground">Req.</p>
                                  <p className="mt-0.5 truncate font-semibold text-slate-900 dark:text-slate-100">{info?.requisition ?? "-"}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/70">
                                  <p className="text-muted-foreground">Lote teste</p>
                                  <p className="mt-0.5 truncate font-semibold text-slate-900 dark:text-slate-100">{info?.testLot ?? "-"}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/70">
                                  <p className="text-muted-foreground">Lote matriz</p>
                                  <p className="mt-0.5 truncate font-semibold text-slate-900 dark:text-slate-100">{info?.matrixLot ?? "-"}</p>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span className="font-medium text-slate-700 dark:text-slate-200">Dados do teste</span>
                                  <span className="text-muted-foreground">{filledCount}/{REQUIRED_TEST_FIELDS.length}</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${dataPct}%` }} />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-blue-800 dark:border-blue-950 dark:bg-blue-950/30 dark:text-blue-200">
                                  <span>Fotos 7º dia</span>
                                  <strong>{photos7}</strong>
                                </div>
                                <div className="flex items-center justify-between rounded-xl border border-purple-100 bg-purple-50 px-3 py-2 text-purple-800 dark:border-purple-950 dark:bg-purple-950/30 dark:text-purple-200">
                                  <span>Fotos 14º dia</span>
                                  <strong>{photos14}</strong>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                  <Eye className="h-3.5 w-3.5" />
                                  Clique para visualizar
                                </div>

                                <div className="flex items-center gap-2">
                                  {isMobile && info && (
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      onClick={(e) => handleShareTestPhotos(e, repetition.id, test.id)}
                                      className="h-9 w-9 rounded-xl"
                                      disabled={isSharing}
                                    >
                                      <Share2 className="h-4 w-4" />
                                      <span className="sr-only">Compartilhar</span>
                                    </Button>
                                  )}

                                  <Button
                                    size="sm"
                                    onClick={(e) => handleEditClick(e, repetition.id, test.id)}
                                    className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 font-bold text-white shadow-md shadow-blue-950/20 hover:from-blue-700 hover:to-purple-700"
                                  >
                                    <Edit className="mr-1 h-4 w-4" />
                                    Editar
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>
            )
          })}
        </Tabs>
      </div>
    </div>
  )
}
