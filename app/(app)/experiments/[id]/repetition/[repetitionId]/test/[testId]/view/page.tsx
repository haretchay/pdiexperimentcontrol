"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Edit, Camera, Download } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import jsPDF from "jspdf"
import QRCodeLib from "qrcode"
import { PhotoGridDisplay } from "@/components/camera/photo-grid-display"
import { createClient } from "@/lib/supabase/client"
import { SignedUrlCache } from "@/lib/pdi/signed-url-cache"
import { getSignedUrlsForPaths } from "@/lib/pdi/test-photos"

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
    if (numberValue === undefined) return undefined
    numbers.push(numberValue)
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
  d.setDate(d.getDate() + day - 1)
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

  if (loading) return <div className="container mx-auto p-4">Carregando detalhes do teste...</div>
  if (!testData) return <div className="container mx-auto p-4">Teste não encontrado</div>

  return (
    <div className="container mx-auto w-full max-w-7xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-2">
        <div className="flex items-center">
          <Link href={`/experiments/${experimentId}`}>
            <Button variant="ghost" size="sm" className="mr-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold truncate">
            {testData.testType || `Teste #${testId}`} - Repetição {repetitionId}
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            onClick={() => router.push(`/experiments/${experimentId}/repetition/${repetitionId}/test/${testId}`)}
            className="flex items-center gap-1 w-full sm:w-auto"
          >
            <Edit className="h-4 w-4" />
            Editar Teste
          </Button>

          <Button
            variant="secondary"
            onClick={handleDownloadQrPdf}
            disabled={!qrDataUrl || qrBusy}
            className="flex items-center gap-1 w-full sm:w-auto"
          >
            <Download className="h-4 w-4" />
            QR Code (PDF)
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Informações Gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Unidade</h3>
              <p className="font-medium">{testData.unit === "americana" ? "Americana" : "Salto"}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Requisição</h3>
              <p className="font-medium">{testData.requisition === "interna" ? "Interna" : "Externa"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Data</h3>
              <p className="font-medium">{currentDate.toLocaleDateString("pt-BR")}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Semana</h3>
              <p className="font-medium">{weekNumber}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Lote Teste</h3>
              <p className="font-medium">{testData.testLot}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Lote Matriz</h3>
              <p className="font-medium">{testData.matrixLot}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Cepa</h3>
              <p className="font-medium">{testData.strain}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Lote MP</h3>
              <p className="font-medium">{testData.mpLot}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Quantidade da Amostra</h3>
              <p className="font-medium">{fmt(testData.quantity, "kg")}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Bozo</h3>
              <p className="font-medium">{fmt(testData.bozo, "min")}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Média umidade</h3>
              <p className="font-medium">{fmt(testData.averageHumidity, "%")}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Sensorial</h3>
              <p className="font-medium">{fmt(testData.sensorial, "pts")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 overflow-hidden border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
          <CardTitle>Temperaturas</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4">
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
