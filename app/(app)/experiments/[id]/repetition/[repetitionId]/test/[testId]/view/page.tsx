"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Edit, Camera, Download, Activity, BarChart3, LineChart as LineChartIcon, Table2, Thermometer, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import jsPDF from "jspdf"
import QRCodeLib from "qrcode"
import { PhotoGridDisplay } from "@/components/camera/photo-grid-display"
import { createClient } from "@/lib/supabase/client"
import { SignedUrlCache } from "@/lib/pdi/signed-url-cache"
import { getSignedUrlsForPaths } from "@/lib/pdi/test-photos"
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type PhotoRow = {
  id: string
  test_id: string
  day: 7 | 14
  storage_path: string
  created_at: string
  kind?: "single" | "merged"
  photo_index?: number | null
}

const TEMPERATURE_DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const
const RICE_PERIODS = [
  { key: "morning", label: "Manhã" },
  { key: "afternoon", label: "Tarde" },
] as const
const RICE_SLOTS = [1, 2, 3] as const
const DISCARD_OPTIONS = [
  { key: "penic", label: "Penic.", className: "bg-cyan-700 text-white" },
  { key: "tri", label: "Tri.", className: "bg-emerald-700 text-white" },
  { key: "bac", label: "Bac.", className: "bg-fuchsia-700 text-white" },
  { key: "others", label: "Outros", className: "bg-sky-700 text-white" },
] as const

type TemperatureDay = (typeof TEMPERATURE_DAYS)[number]
type RicePeriod = (typeof RICE_PERIODS)[number]["key"]
type RiceSlot = (typeof RICE_SLOTS)[number]
type DiscardKind = (typeof DISCARD_OPTIONS)[number]["key"]
type DiscardContaminations = Record<string, Partial<Record<DiscardKind, boolean>>>

function toNumberOrUndefined(v: unknown) {
  if (v === "" || v === null || v === undefined) return undefined
  if (typeof v === "number") return Number.isNaN(v) ? undefined : v
  const n = Number(String(v).replace(",", "."))
  return Number.isNaN(n) ? undefined : n
}

function averageTemperature(values: unknown[]) {
  const numbers: number[] = []

  for (const value of values) {
    const numberValue = toNumberOrUndefined(value)
    if (numberValue !== undefined) numbers.push(numberValue)
  }

  if (numbers.length === 0) return undefined

  const total = numbers.reduce((sum, value) => sum + value, 0)
  return Math.round((total / numbers.length) * 10) / 10
}

function riceMeasurementColumn(day: TemperatureDay, period: RicePeriod, slot: RiceSlot) {
  return `temp${day}_rice_${period}_t${slot}`
}

function normalizeDiscardContaminations(value: unknown): DiscardContaminations {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const result: DiscardContaminations = {}

  for (const day of TEMPERATURE_DAYS) {
    const row = (value as any)[String(day)]
    if (!row || typeof row !== "object" || Array.isArray(row)) continue

    const normalized: Partial<Record<DiscardKind, boolean>> = {}
    for (const option of DISCARD_OPTIONS) {
      if (Boolean(row[option.key])) normalized[option.key] = true
    }

    if (Object.keys(normalized).length > 0) result[String(day)] = normalized
  }

  return result
}

function getExperimentDayDate(startDate: string | null | undefined, day: number) {
  if (!startDate) return ""
  const [year, month, date] = String(startDate).slice(0, 10).split("-").map(Number)
  if (!year || !month || !date) return ""
  const d = new Date(year, month - 1, date)
  d.setDate(d.getDate() + day)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatShortDate(dateString: string) {
  if (!dateString) return "--/--/--"
  const [year, month, date] = dateString.slice(0, 10).split("-")
  if (!year || !month || !date) return "--/--/--"
  return `${date}/${month}/${year.slice(-2)}`
}

function formatTemperatureValue(value: any) {
  if (value === null || value === undefined || value === "") return "-"
  const n = Number(value)
  if (!Number.isFinite(n)) return "-"
  return `${n} ºC`
}

function formatChartTemperature(value: any) {
  const n = toNumberOrUndefined(value)
  if (n === undefined) return "-"
  return `${n.toFixed(1).replace(".", ",")} ºC`
}

function getRiceAverageFromRow(row: any, day: TemperatureDay) {
  const storedAverage = toNumberOrUndefined(row?.[`temp${day}_rice`])
  if (storedAverage !== undefined) return storedAverage

  return averageTemperature(
    RICE_PERIODS.flatMap((period) =>
      RICE_SLOTS.map((slot) => row?.[riceMeasurementColumn(day, period.key, slot)]),
    ),
  )
}

function buildHistoricalTemperatureRows(rows: any[]) {
  return TEMPERATURE_DAYS.map((day) => ({
    day,
    historicalChamber: averageTemperature(rows.map((row) => row?.[`temp${day}_chamber`])),
    historicalRice: averageTemperature(rows.map((row) => getRiceAverageFromRow(row, day))),
  }))
}

function TemperatureChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mb-2 font-bold text-slate-900 dark:text-slate-100">{label}</div>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={`${item.dataKey}-${item.name}`} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{item.name}</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{formatChartTemperature(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TestViewPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const signedUrlCache = useMemo(() => new SignedUrlCache(), [])

  const {
    id: experimentId,
    repetitionId,
    testId,
  } = params as {
    id: string
    repetitionId: string
    testId: string
  }

  const repetitionNumber = Number(repetitionId)
  const testNumber = Number(testId)

  const [testData, setTestData] = useState<any>(null)
  const [experiment, setExperiment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [temperatureViewMode, setTemperatureViewMode] = useState<"table" | "chart">("table")
  const [temperatureChartType, setTemperatureChartType] = useState<"line" | "bar">("line")
  const [temperatureComparison, setTemperatureComparison] = useState<"both" | "chamber" | "rice">("both")
  const [showHistoricalAverage, setShowHistoricalAverage] = useState(true)
  const [historicalTemperatures, setHistoricalTemperatures] = useState<any[]>([])

  const getWeekNumber = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
  }
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)

        const { data: exp, error: expErr } = await supabase
          .from("experiments")
          .select("id, number, strain, start_date, test_count, repetition_count")
          .eq("id", experimentId)
          .single()

        if (expErr) throw expErr
        if (cancelled) return
        setExperiment(exp)

        const { data: t, error: tErr } = await supabase
          .from("tests")
          .select("*")
          .eq("experiment_id", experimentId)
          .eq("repetition_number", repetitionNumber)
          .eq("test_number", testNumber)
          .single()

        if (tErr) throw tErr

        const historicalTemperatureColumns = TEMPERATURE_DAYS.flatMap((day) => [
          `temp${day}_chamber`,
          `temp${day}_rice`,
          ...RICE_PERIODS.flatMap((period) =>
            RICE_SLOTS.map((slot) => riceMeasurementColumn(day, period.key, slot)),
          ),
        ]).join(", ")

        const { data: historicalRows, error: historicalErr } = await supabase
          .from("tests")
          .select(`id, ${historicalTemperatureColumns}`)

        if (!historicalErr && !cancelled) {
          setHistoricalTemperatures(buildHistoricalTemperatureRows(historicalRows ?? []))
        }

        const ENABLE_INDIVIDUAL_PHOTOS = false

        const { data: photos, error: pErr } = await supabase
          .from("test_photos")
          .select("id, test_id, day, storage_path, created_at, kind, photo_index")
          .eq("test_id", t.id)
          .eq("kind", ENABLE_INDIVIDUAL_PHOTOS ? "single" : "merged")
          .order("created_at", { ascending: false })

        if (pErr) throw pErr

        let paths7: string[] = []
        let paths14: string[] = []

        if (ENABLE_INDIVIDUAL_PHOTOS) {
          // modo antigo: 6 fotos individuais
          const photos7 = (photos ?? []).filter((p: PhotoRow) => p.day === 7)
          const photos14 = (photos ?? []).filter((p: PhotoRow) => p.day === 14)

          const ordered7 = [...photos7].sort(
            (a: PhotoRow, b: PhotoRow) =>
              (a.photo_index ?? 999) - (b.photo_index ?? 999) ||
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          )
          const ordered14 = [...photos14].sort(
            (a: PhotoRow, b: PhotoRow) =>
              (a.photo_index ?? 999) - (b.photo_index ?? 999) ||
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          )

          paths7 = ordered7.map((p: PhotoRow) => p.storage_path).filter(Boolean)
          paths14 = ordered14.map((p: PhotoRow) => p.storage_path).filter(Boolean)
        } else {
          // modo econômico: apenas 1 mosaico por dia (pega o mais recente)
          const merged7 = (photos ?? []).find((p: PhotoRow) => p.day === 7)
          const merged14 = (photos ?? []).find((p: PhotoRow) => p.day === 14)
          if (merged7?.storage_path) paths7 = [merged7.storage_path]
          if (merged14?.storage_path) paths14 = [merged14.storage_path]
        }

        const urls7 = await getSignedUrlsForPaths(supabase, paths7, { cache: signedUrlCache })
        const urls14 = await getSignedUrlsForPaths(supabase, paths14, { cache: signedUrlCache })

const mapped = {
          unit: t.unit,
          requisition: t.requisition,
          testLot: t.test_lot,
          matrixLot: t.matrix_lot,
          strain: t.strain,
          mpLot: t.mp_lot,
          averageHumidity: t.average_humidity,
          bozo: t.bozo,
          sensorial: t.sensorial,
          quantity: t.quantity,
          testType: t.test_type,
          date7Day: t.date_7_day,
          date14Day: t.date_14_day,
          temp7Chamber: t.temp7_chamber,
          temp7Rice: t.temp7_rice,
          temp14Chamber: t.temp14_chamber,
          temp14Rice: t.temp14_rice,
          temperatures: TEMPERATURE_DAYS.map((day) => {
            const morningValues = RICE_SLOTS.map((slot) => (t as any)[riceMeasurementColumn(day, "morning", slot)])
            const afternoonValues = RICE_SLOTS.map((slot) => (t as any)[riceMeasurementColumn(day, "afternoon", slot)])
            const morningAverage = averageTemperature(morningValues)
            const afternoonAverage = averageTemperature(afternoonValues)
            const generalAverage = toNumberOrUndefined((t as any)[`temp${day}_rice`]) ?? averageTemperature([morningAverage, afternoonAverage])

            return {
              day,
              date: getExperimentDayDate(exp?.start_date, day),
              chamber: (t as any)[`temp${day}_chamber`],
              morningValues,
              afternoonValues,
              morningAverage,
              afternoonAverage,
              rice: generalAverage,
            }
          }),
          discardContaminations: normalizeDiscardContaminations((t as any).discard_contaminations),
          wetWeight: t.wet_weight,
          dryWeight: t.dry_weight,
          extractedConidiumWeight: t.extracted_conidium_weight,
          annotations7Day: t.annotations_7_day,
          annotations14Day: t.annotations_14_day,
          photos7Day: urls7.filter(Boolean),
          photos14Day: urls14.filter(Boolean),
        }

        if (cancelled) return
        setTestData(mapped)
      } catch (e) {
        console.error(e)
        if (!cancelled) setTestData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, experimentId, repetitionNumber, testNumber])

  const currentDate = new Date()
  const weekNumber = getWeekNumber(currentDate)

  // QR code (para esta página de view)
  const pageUrl = useMemo(() => {
    if (typeof window === "undefined") return ""
    return window.location.href
  }, [experimentId, repetitionId, testId])

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrBusy, setQrBusy] = useState(false)

  const fmt = (v: any, suffix?: string) => {
    if (v === null || v === undefined || v === "") return "Não informado"
    const n = typeof v === "number" ? v : Number(v)
    if (Number.isFinite(n)) return `${n}${suffix ? ` ${suffix}` : ""}`
    return `${String(v)}${suffix ? ` ${suffix}` : ""}`
  }

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      if (!pageUrl) return
      try {
        const dataUrl = await QRCodeLib.toDataURL(pageUrl, {
          margin: 1,
          width: 600,
          errorCorrectionLevel: "M",
        })
        if (!cancelled) setQrDataUrl(dataUrl)
      } catch (e) {
        console.error("Erro ao gerar QR code", e)
        if (!cancelled) setQrDataUrl(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pageUrl])

  const handleDownloadQrPdf = async () => {
    if (!qrDataUrl) return
    try {
      setQrBusy(true)

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

      const pageW = doc.internal.pageSize.getWidth()
      const margin = 16
      const qrSize = 90
      const x = (pageW - qrSize) / 2
      const y = 28

      doc.setFontSize(14)
      doc.text("QR Code do teste", margin, 18)

      doc.addImage(qrDataUrl, "PNG", x, y, qrSize, qrSize)

      doc.setFontSize(10)
      const caption = [
        `Experimento: ${experimentId}`,
        `Repetição: ${repetitionId} | Teste: ${testId}`,
        `Cepa: ${testData?.strain || "-"} | Lote: ${testData?.testLot || "-"}`,
      ]

      let cy = y + qrSize + 10
      for (const line of caption) {
        doc.text(line, margin, cy)
        cy += 6
      }

      doc.setFontSize(8)
      const urlLines = doc.splitTextToSize(pageUrl, pageW - margin * 2)
      doc.text(urlLines, margin, cy + 4)

      doc.save(`qr_teste_${String(testId)}_rep_${String(repetitionId)}.pdf`)
    } finally {
      setQrBusy(false)
    }
  }

  const temperatureChartData = useMemo(() => {
    const historicalByDay = new Map((historicalTemperatures ?? []).map((row: any) => [row.day, row]))

    return (testData?.temperatures ?? []).map((row: any) => {
      const historical = historicalByDay.get(row.day) as any
      return {
        day: row.day,
        dayLabel: `${row.day}º dia`,
        dateLabel: formatShortDate(row.date),
        chamber: toNumberOrUndefined(row.chamber),
        rice: toNumberOrUndefined(row.rice),
        historicalChamber: toNumberOrUndefined(historical?.historicalChamber),
        historicalRice: toNumberOrUndefined(historical?.historicalRice),
      }
    })
  }, [historicalTemperatures, testData])

  const hasTemperatureChartData = temperatureChartData.some((row: any) =>
    [row.chamber, row.rice, row.historicalChamber, row.historicalRice].some((value) => value !== undefined),
  )
  const showChamberSeries = temperatureComparison === "both" || temperatureComparison === "chamber"
  const showRiceSeries = temperatureComparison === "both" || temperatureComparison === "rice"
  const chartSummary = {
    chamberAverage: averageTemperature(temperatureChartData.map((row: any) => row.chamber)),
    riceAverage: averageTemperature(temperatureChartData.map((row: any) => row.rice)),
    historicalChamberAverage: averageTemperature(temperatureChartData.map((row: any) => row.historicalChamber)),
    historicalRiceAverage: averageTemperature(temperatureChartData.map((row: any) => row.historicalRice)),
  }

  if (loading) return <div className="container mx-auto p-4">Carregando detalhes do teste...</div>
  if (!testData) return <div className="container mx-auto p-4">Teste não encontrado</div>

  return (
    <div className="container mx-auto w-full max-w-7xl p-4">
      <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link href={`/experiments/${experimentId}`}>
                <Button variant="secondary" size="sm" className="mb-4 bg-white/15 text-white hover:bg-white/25">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Voltar ao experimento
                </Button>
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                  Experimento #{experiment?.number ?? "-"}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                  Repetição {repetitionId}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                  Teste {testId}
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">
                {testData.testType || `Teste #${testId}`}
              </h1>
              <p className="mt-1 text-sm text-blue-50">
                Cepa {testData.strain || experiment?.strain || "não informada"} • {testData.unit === "americana" ? "Americana" : "Salto"}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
              <Button
                onClick={() => router.push(`/experiments/${experimentId}/repetition/${repetitionId}/test/${testId}`)}
                className="bg-white text-blue-700 shadow-md hover:bg-blue-50"
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar Teste
              </Button>

              <Button
                variant="secondary"
                onClick={handleDownloadQrPdf}
                disabled={!qrDataUrl || qrBusy}
                className="bg-white/15 text-white hover:bg-white/25 disabled:opacity-60"
              >
                <Download className="mr-2 h-4 w-4" />
                QR Code (PDF)
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {[
            { label: "Unidade", value: testData.unit === "americana" ? "Americana" : "Salto" },
            { label: "Requisição", value: testData.requisition === "interna" ? "Interna" : "Externa" },
            { label: "Data", value: currentDate.toLocaleDateString("pt-BR") },
            { label: "Semana", value: weekNumber },
            { label: "Lote Teste", value: testData.testLot || "Não informado" },
            { label: "Lote Matriz", value: testData.matrixLot || "Não informado" },
            { label: "Lote MP", value: testData.mpLot || "Não informado" },
            { label: "Quantidade", value: fmt(testData.quantity, "kg") },
            { label: "Bozo", value: fmt(testData.bozo, "min") },
            { label: "Média umidade", value: fmt(testData.averageHumidity, "%") },
            { label: "Sensorial", value: fmt(testData.sensorial, "pts") },
            { label: "Cepa", value: testData.strain || "Não informada" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</div>
              <div className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-slate-100">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <Card className="mb-6 overflow-hidden border-slate-200 shadow-lg shadow-slate-200/50 dark:border-slate-800 dark:shadow-none">
        <CardHeader className="border-b bg-gradient-to-r from-orange-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-blue-600 text-white shadow-md">
                <Thermometer className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Temperaturas</CardTitle>
                <CardDescription>
                  Acompanhamento diário da câmara e das médias do arroz, com comparação histórica opcional.
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={temperatureViewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setTemperatureViewMode("table")}
                className={temperatureViewMode === "table" ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white" : ""}
              >
                <Table2 className="mr-1.5 h-4 w-4" />
                Tabela
              </Button>
              <Button
                type="button"
                variant={temperatureViewMode === "chart" ? "default" : "outline"}
                size="sm"
                onClick={() => setTemperatureViewMode("chart")}
                className={temperatureViewMode === "chart" ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white" : ""}
              >
                <TrendingUp className="mr-1.5 h-4 w-4" />
                Gráfico
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-4">
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                <Activity className="h-3.5 w-3.5" />
                Média Câmara
              </div>
              <div className="mt-1 text-2xl font-bold text-blue-900 dark:text-blue-100">{formatChartTemperature(chartSummary.chamberAverage)}</div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                <Activity className="h-3.5 w-3.5" />
                Média Arroz
              </div>
              <div className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-100">{formatChartTemperature(chartSummary.riceAverage)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Histórico Câmara</div>
              <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatChartTemperature(chartSummary.historicalChamberAverage)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Histórico Arroz</div>
              <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatChartTemperature(chartSummary.historicalRiceAverage)}</div>
            </div>
          </div>

          {temperatureViewMode === "chart" ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={temperatureChartType === "line" ? "default" : "outline"}
                    onClick={() => setTemperatureChartType("line")}
                    className={temperatureChartType === "line" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : ""}
                  >
                    <LineChartIcon className="mr-1.5 h-4 w-4" />
                    Linhas
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={temperatureChartType === "bar" ? "default" : "outline"}
                    onClick={() => setTemperatureChartType("bar")}
                    className={temperatureChartType === "bar" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : ""}
                  >
                    <BarChart3 className="mr-1.5 h-4 w-4" />
                    Barras
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={showHistoricalAverage ? "default" : "outline"}
                    onClick={() => setShowHistoricalAverage((value) => !value)}
                    className={showHistoricalAverage ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white" : ""}
                  >
                    Média histórica
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "both", label: "Câmara + Arroz" },
                    { key: "chamber", label: "Câmara" },
                    { key: "rice", label: "Arroz" },
                  ].map((option) => (
                    <Button
                      key={option.key}
                      type="button"
                      size="sm"
                      variant={temperatureComparison === option.key ? "default" : "outline"}
                      onClick={() => setTemperatureComparison(option.key as any)}
                      className={temperatureComparison === option.key ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white" : ""}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="h-[380px] rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/30">
                {hasTemperatureChartData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={temperatureChartData} margin={{ top: 12, right: 18, left: -12, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.45} />
                      <XAxis dataKey="dayLabel" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${value}°`} domain={["auto", "auto"]} />
                      <Tooltip content={<TemperatureChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />

                      {showHistoricalAverage && showChamberSeries ? (
                        <Area
                          type="monotone"
                          dataKey="historicalChamber"
                          name="Média hist. Câmara"
                          fill="#93c5fd"
                          stroke="#60a5fa"
                          fillOpacity={0.18}
                          strokeOpacity={0.5}
                          connectNulls
                        />
                      ) : null}
                      {showHistoricalAverage && showRiceSeries ? (
                        <Area
                          type="monotone"
                          dataKey="historicalRice"
                          name="Média hist. Arroz"
                          fill="#86efac"
                          stroke="#4ade80"
                          fillOpacity={0.16}
                          strokeOpacity={0.45}
                          connectNulls
                        />
                      ) : null}

                      {temperatureChartType === "bar" ? (
                        <>
                          {showChamberSeries ? <Bar dataKey="chamber" name="Câmara" fill="#2563eb" radius={[6, 6, 0, 0]} /> : null}
                          {showRiceSeries ? <Bar dataKey="rice" name="Arroz" fill="#059669" radius={[6, 6, 0, 0]} /> : null}
                        </>
                      ) : (
                        <>
                          {showChamberSeries ? (
                            <Line
                              type="monotone"
                              dataKey="chamber"
                              name="Câmara"
                              stroke="#2563eb"
                              strokeWidth={3}
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                              connectNulls
                            />
                          ) : null}
                          {showRiceSeries ? (
                            <Line
                              type="monotone"
                              dataKey="rice"
                              name="Arroz"
                              stroke="#059669"
                              strokeWidth={3}
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                              connectNulls
                            />
                          ) : null}
                        </>
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-sm text-muted-foreground dark:bg-slate-900/40">
                    Sem dados suficientes para exibir o gráfico de temperaturas.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-[1240px] w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <th rowSpan={2} className="w-[150px] border border-slate-200 px-2 py-2 text-left align-middle dark:border-slate-800">Dia</th>
                    <th rowSpan={2} className="w-[96px] border border-slate-200 px-2 py-2 text-center align-middle dark:border-slate-800">Temp. Câmara</th>
                    <th colSpan={4} className="border border-slate-200 px-2 py-2 text-center dark:border-slate-800">Temp. Arroz (Manhã)</th>
                    <th colSpan={4} className="border border-slate-200 px-2 py-2 text-center dark:border-slate-800">Temp. Arroz (Tarde)</th>
                    <th rowSpan={2} className="w-[82px] border border-slate-200 px-2 py-2 text-center align-middle dark:border-slate-800">Média Geral</th>
                    <th colSpan={4} className="border border-slate-200 px-2 py-2 text-center dark:border-slate-800">Descarte (contaminações)</th>
                  </tr>
                  <tr className="bg-slate-50 text-[11px] font-semibold text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
                    <th className="w-[72px] border border-slate-200 px-1.5 py-1.5 text-center dark:border-slate-800">T1</th>
                    <th className="w-[72px] border border-slate-200 px-1.5 py-1.5 text-center dark:border-slate-800">T2</th>
                    <th className="w-[72px] border border-slate-200 px-1.5 py-1.5 text-center dark:border-slate-800">T3</th>
                    <th className="w-[76px] border border-slate-200 px-1.5 py-1.5 text-center dark:border-slate-800">Média</th>
                    <th className="w-[72px] border border-slate-200 px-1.5 py-1.5 text-center dark:border-slate-800">T1</th>
                    <th className="w-[72px] border border-slate-200 px-1.5 py-1.5 text-center dark:border-slate-800">T2</th>
                    <th className="w-[72px] border border-slate-200 px-1.5 py-1.5 text-center dark:border-slate-800">T3</th>
                    <th className="w-[76px] border border-slate-200 px-1.5 py-1.5 text-center dark:border-slate-800">Média</th>
                    <th className="w-[72px] border border-slate-200 px-1.5 py-1.5 text-center dark:border-slate-800">Penic.</th>
                    <th className="w-[72px] border border-slate-200 px-1.5 py-1.5 text-center dark:border-slate-800">Tri.</th>
                    <th className="w-[72px] border border-slate-200 px-1.5 py-1.5 text-center dark:border-slate-800">Bac.</th>
                    <th className="w-[76px] border border-slate-200 px-1.5 py-1.5 text-center dark:border-slate-800">Outros</th>
                  </tr>
                </thead>
                <tbody>
                  {(testData.temperatures ?? []).map((row: any) => (
                    <tr key={row.day} className="odd:bg-background even:bg-muted/30">
                      <td className="border border-slate-200 px-2 py-1.5 font-medium dark:border-slate-800">
                        {row.day}º dia <span className="text-xs font-normal text-muted-foreground">({formatShortDate(row.date)})</span>
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center dark:border-slate-800">{formatTemperatureValue(row.chamber)}</td>
                      {row.morningValues.map((value: any, index: number) => (
                        <td key={`m-${row.day}-${index}`} className="border border-slate-200 px-2 py-1.5 text-center dark:border-slate-800">{formatTemperatureValue(value)}</td>
                      ))}
                      <td className="border border-slate-200 bg-sky-50/70 px-2 py-1.5 text-center font-semibold dark:border-slate-800 dark:bg-sky-950/20">{formatTemperatureValue(row.morningAverage)}</td>
                      {row.afternoonValues.map((value: any, index: number) => (
                        <td key={`t-${row.day}-${index}`} className="border border-slate-200 px-2 py-1.5 text-center dark:border-slate-800">{formatTemperatureValue(value)}</td>
                      ))}
                      <td className="border border-slate-200 bg-sky-50/70 px-2 py-1.5 text-center font-semibold dark:border-slate-800 dark:bg-sky-950/20">{formatTemperatureValue(row.afternoonAverage)}</td>
                      <td className="border border-slate-200 bg-blue-50/80 px-2 py-1.5 text-center font-bold dark:border-slate-800 dark:bg-blue-950/20">{formatTemperatureValue(row.rice)}</td>
                      {DISCARD_OPTIONS.map((option) => {
                        const active = Boolean(testData.discardContaminations?.[String(row.day)]?.[option.key])
                        return (
                          <td key={`${row.day}-${option.key}`} className="border border-slate-200 px-1.5 py-1.5 text-center dark:border-slate-800">
                            <span className={`inline-flex h-7 min-w-[64px] items-center justify-center rounded-md border px-2 text-[11px] font-bold ${active ? option.className : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-950/40"}`}>
                              {option.label}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Dados do 7º dia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Data do 7º dia</h3>
            <p className="font-medium">
              {testData.date7Day ? new Date(testData.date7Day).toLocaleDateString("pt-BR") : "Não informada"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Temp 7º dia - Câmara</h3>
              <p className="font-medium">{testData.temp7Chamber === null || testData.temp7Chamber === undefined ? "Não informado" : `${testData.temp7Chamber} ºC`}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Temp 7º dia - Arroz</h3>
              <p className="font-medium">{testData.temp7Rice === null || testData.temp7Rice === undefined ? "Não informado" : `${testData.temp7Rice} ºC`}</p>
            </div>
          </div>

          {testData.photos7Day?.length > 0 ? (
            <PhotoGridDisplay
              photos={testData.photos7Day}
              annotations={testData.annotations7Day}
              testInfo={{
                experimentNumber: experiment?.number || "",
                repetitionNumber: String(repetitionId),
                testNumber: String(testId),
                strain: testData.strain,
                day: 7,
                unit: testData.unit,
                testLot: testData.testLot,
                matrixLot: testData.matrixLot,
                date: testData.date7Day ? new Date(testData.date7Day).toLocaleDateString("pt-BR") : undefined,
                temperature: { chamber: testData.temp7Chamber, rice: testData.temp7Rice },
              }}
            />
          ) : (
            <div className="flex justify-center">
              <div className="bg-muted/50 rounded-lg p-8 flex flex-col items-center justify-center w-full">
                <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-center">Foto do 7º dia não disponível</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Dados do 14º dia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Data do 14º dia</h3>
            <p className="font-medium">
              {testData.date14Day ? new Date(testData.date14Day).toLocaleDateString("pt-BR") : "Não informada"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Temp 14º dia - Câmara</h3>
              <p className="font-medium">{testData.temp14Chamber === null || testData.temp14Chamber === undefined ? "Não informado" : `${testData.temp14Chamber} ºC`}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Temp 14º dia - Arroz</h3>
              <p className="font-medium">{testData.temp14Rice === null || testData.temp14Rice === undefined ? "Não informado" : `${testData.temp14Rice} ºC`}</p>
            </div>
          </div>

          {testData.photos14Day?.length > 0 ? (
            <PhotoGridDisplay
              photos={testData.photos14Day}
              annotations={testData.annotations14Day}
              testInfo={{
                experimentNumber: experiment?.number || "",
                repetitionNumber: String(repetitionId),
                testNumber: String(testId),
                strain: testData.strain,
                day: 14,
                unit: testData.unit,
                testLot: testData.testLot,
                matrixLot: testData.matrixLot,
                date: testData.date14Day ? new Date(testData.date14Day).toLocaleDateString("pt-BR") : undefined,
                temperature: { chamber: testData.temp14Chamber, rice: testData.temp14Rice },
              }}
            />
          ) : (
            <div className="flex justify-center">
              <div className="bg-muted/50 rounded-lg p-8 flex flex-col items-center justify-center w-full">
                <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-center">Foto do 14º dia não disponível</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Medições de Peso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Peso Úmido</h3>
              <p className="font-medium">{fmt(testData.wetWeight, "kg")}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Peso Seco</h3>
              <p className="font-medium">{fmt(testData.dryWeight, "kg")}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Peso Conídio Extraído</h3>
              <p className="font-medium">
                {fmt(testData.extractedConidiumWeight, "kg")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
