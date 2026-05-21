"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/lib/supabase/client"
import { SignedUrlCache } from "@/lib/pdi/signed-url-cache"
import { getSignedUrlsForPaths, replaceMergedDayPhoto } from "@/lib/pdi/test-photos"
import { ensureTestRow } from "@/lib/pdi/tests"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PhotoCaptureWorkflow } from "@/components/camera/photo-capture-workflow"
import { Camera, Check, Images, Thermometer } from "lucide-react"

type Annotation = { x: number; y: number; size: string; caption: string; color?: string }
type AnnotationsByPhotoIndex = Record<number, Annotation[]>

const TEMPERATURE_DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const
type TemperatureDay = (typeof TEMPERATURE_DAYS)[number]
type TemperatureKind = "Chamber" | "Rice"
type TemperatureFieldName = `temp${TemperatureDay}${TemperatureKind}`

const toNumberOrUndefined = (v: unknown) => {
  if (v === "" || v === null || v === undefined) return undefined
  if (typeof v === "number") return Number.isNaN(v) ? undefined : v
  if (typeof v === "string") {
    const s = v.trim().replace(",", ".")
    if (!s) return undefined
    const n = Number(s)
    return Number.isNaN(n) ? undefined : n
  }
  return undefined
}

const isDataUrlImage = (s?: string) => typeof s === "string" && s.startsWith("data:image/")
const hasNewCapturedPhotos = (photos: string[]) => Array.isArray(photos) && photos.some((p) => isDataUrlImage(p))

function NumberInputWithSuffix({
  value,
  onChange,
  step,
  suffix,
  className,
  inputClassName,
}: {
  value: any
  onChange: any
  step?: string
  suffix: string
  className?: string
  inputClassName?: string
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <Input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={onChange}
        onWheel={(e) => e.currentTarget.blur()}
        className={`pr-10 ${inputClassName ?? ""}`}
      />
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11px] text-muted-foreground">
        {suffix}
      </div>
    </div>
  )
}

function getTemperatureFieldName(day: TemperatureDay, kind: TemperatureKind): TemperatureFieldName {
  return `temp${day}${kind}` as TemperatureFieldName
}

function getTemperatureColumnName(day: TemperatureDay, kind: TemperatureKind) {
  return `temp${day}_${kind === "Chamber" ? "chamber" : "rice"}`
}

function getTemperatureDefaults(row?: any) {
  const values: Partial<Record<TemperatureFieldName, number | undefined>> = {}

  for (const day of TEMPERATURE_DAYS) {
    const chamberField = getTemperatureFieldName(day, "Chamber")
    const riceField = getTemperatureFieldName(day, "Rice")
    values[chamberField] = row?.[getTemperatureColumnName(day, "Chamber")] ?? undefined
    values[riceField] = row?.[getTemperatureColumnName(day, "Rice")] ?? undefined
  }

  return values as Record<TemperatureFieldName, number | undefined>
}

function getTemperaturePayload(values: FormValues) {
  const payload: Record<string, number | null> = {}

  for (const day of TEMPERATURE_DAYS) {
    const chamberField = getTemperatureFieldName(day, "Chamber")
    const riceField = getTemperatureFieldName(day, "Rice")
    payload[getTemperatureColumnName(day, "Chamber")] = (values as any)[chamberField] ?? null
    payload[getTemperatureColumnName(day, "Rice")] = (values as any)[riceField] ?? null
  }

  return payload
}

function getExperimentDayDate(startDate: string | null | undefined, day: number) {
  if (!startDate) return ""

  const [year, month, date] = String(startDate).slice(0, 10).split("-").map(Number)
  if (!year || !month || !date) return ""

  const d = new Date(year, month - 1, date)
  d.setDate(d.getDate() + day - 1)

  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function formatShortDate(dateString: string) {
  if (!dateString) return "--/--/--"
  const [year, month, date] = dateString.slice(0, 10).split("-")
  if (!year || !month || !date) return "--/--/--"
  return `${date}/${month}/${year.slice(-2)}`
}

function toStoredDateIso(dateString?: string | null) {
  if (!dateString) return null
  return new Date(`${String(dateString).slice(0, 10)}T12:00:00`).toISOString()
}

async function createMosaicBlob(imageDataUrls: string[]) {
  // Mosaico 3x2 (6 fotos): mantém zoom normal ao abrir a imagem final
  const cols = 3
  const rows = 2
  const cellW = 1000
  const cellH = 750
  const gutter = 6
  const quality = 0.9

  const load = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error("Falha ao carregar imagem para mosaico"))
      img.src = src
    })

  const imgs = await Promise.all(imageDataUrls.slice(0, 6).map((u) => load(u)))

  const canvas = document.createElement("canvas")
  canvas.width = cols * cellW
  canvas.height = rows * cellH

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D indisponível")

  // fundo escuro compatível com tema
  ctx.fillStyle = "#111827"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const drawContain = (img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) => {
    const iw = img.naturalWidth || img.width
    const ih = img.naturalHeight || img.height
    const ir = iw / ih
    const dr = dw / dh

    let rw = dw
    let rh = dh
    if (ir > dr) {
      rh = dw / ir
    } else {
      rw = dh * ir
    }

    const x = dx + (dw - rw) / 2
    const y = dy + (dh - rh) / 2

    ctx.fillStyle = "#111827"
    ctx.fillRect(dx, dy, dw, dh)

    ctx.drawImage(img, x, y, rw, rh)
  }

  imgs.forEach((img, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = col * cellW
    const y = row * cellH
    drawContain(img, x + gutter, y + gutter, cellW - gutter * 2, cellH - gutter * 2)
  })

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar JPG do mosaico"))), "image/jpeg", quality)
  })

  return blob
}

const formSchema = z.object({
  unit: z.enum(["americana", "salto"]).optional(),
  requisition: z.enum(["interna", "externa"]).optional(),

  testLot: z.string().optional(),
  matrixLot: z.string().optional(),
  strain: z.string().optional(),
  mpLot: z.string().optional(),
  testType: z.string().optional(),

  averageHumidity: z.preprocess(toNumberOrUndefined, z.number().optional()),
  bozo: z.preprocess(toNumberOrUndefined, z.number().optional()),
  sensorial: z.preprocess(toNumberOrUndefined, z.number().optional()),
  quantity: z.preprocess(toNumberOrUndefined, z.number().optional()),

  date7Day: z.string().optional(),
  date14Day: z.string().optional(),

  temp1Chamber: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp1Rice: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp2Chamber: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp2Rice: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp3Chamber: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp3Rice: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp4Chamber: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp4Rice: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp5Chamber: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp5Rice: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp6Chamber: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp6Rice: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp7Chamber: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp7Rice: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp8Chamber: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp8Rice: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp9Chamber: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp9Rice: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp10Chamber: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp10Rice: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp11Chamber: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp11Rice: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp12Chamber: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp12Rice: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp13Chamber: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp13Rice: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp14Chamber: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp14Rice: z.preprocess(toNumberOrUndefined, z.number().optional()),

  wetWeight: z.preprocess(toNumberOrUndefined, z.number().optional()),
  dryWeight: z.preprocess(toNumberOrUndefined, z.number().optional()),
  extractedConidiumWeight: z.preprocess(toNumberOrUndefined, z.number().optional()),
})

type FormValues = z.output<typeof formSchema>

export default function TestEditPage() {
  const router = useRouter()
  const params = useParams()

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

  const supabase = useMemo(() => createClient(), [])
  const signedUrlCache = useMemo(() => new SignedUrlCache(), [])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isCapturing7Day, setIsCapturing7Day] = useState(false)
  const [isCapturing14Day, setIsCapturing14Day] = useState(false)

  // OBS: aqui podem existir 2 tipos de strings:
  // - data:image/... (capturado agora)
  // - URL http(s) (foto já existente no storage)
  const [photos7Day, setPhotos7Day] = useState<string[]>([])
  const [photos14Day, setPhotos14Day] = useState<string[]>([])

  // Anotações (legendas) por índice de foto (0..n-1)
  const [annotations7Day, setAnnotations7Day] = useState<AnnotationsByPhotoIndex>({})
  const [annotations14Day, setAnnotations14Day] = useState<AnnotationsByPhotoIndex>({})

  // Preview de fotos já salvas (mosaico) ao editar
  const [existingMerged7Url, setExistingMerged7Url] = useState<string | null>(null)
  const [existingMerged14Url, setExistingMerged14Url] = useState<string | null>(null)

  // Modal para visualizar/decidir manter ou refazer
  const [openDayPreview, setOpenDayPreview] = useState<7 | 14 | null>(null)

  // Backup das fotos carregadas (URLs) caso o usuário clique em "Refazer" e depois cancele
  const prevPhotos7Ref = useRef<string[] | null>(null)
  const prevPhotos14Ref = useRef<string[] | null>(null)

  const [testDbId, setTestDbId] = useState<string | null>(null)
  const [experiment, setExperiment] = useState<any>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      unit: "americana",
      requisition: "interna",
      testLot: "",
      matrixLot: "",
      strain: "",
      mpLot: "",
      testType: "",
      averageHumidity: undefined,
      bozo: undefined,
      sensorial: undefined,
      quantity: undefined,
      date7Day: "",
      date14Day: "",
      ...getTemperatureDefaults(),
      wetWeight: undefined,
      dryWeight: undefined,
      extractedConidiumWeight: undefined,
    },
  })

  const date7FromExperiment = useMemo(() => getExperimentDayDate(experiment?.start_date, 7), [experiment?.start_date])
  const date14FromExperiment = useMemo(() => getExperimentDayDate(experiment?.start_date, 14), [experiment?.start_date])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError
        if (!user) {
          router.push("/auth/login")
          return
        }

        const { data: exp, error: expErr } = await supabase
          .from("experiments")
          .select("id, number, strain, start_date, test_count, repetition_count")
          .eq("id", experimentId)
          .single()

        if (expErr) throw expErr
        if (cancelled) return
        setExperiment(exp)

        const { data, error } = await supabase
          .from("tests")
          .select("*")
          .eq("experiment_id", experimentId)
          .eq("repetition_number", repetitionNumber)
          .eq("test_number", testNumber)
          .maybeSingle()

        if (error) throw error
        if (cancelled) return

        const currentTest = data ?? (await ensureTestRow(supabase, {
          experimentId,
          repetitionNumber,
          testNumber,
          createdBy: user.id,
          defaultStrain: exp?.strain ?? null,
        }))

        if (cancelled) return
        setTestDbId(currentTest.id)

        // Carregar anotações que já existiam
        setAnnotations7Day((currentTest.annotations_7_day as any) ?? {})
        setAnnotations14Day((currentTest.annotations_14_day as any) ?? {})

        const derivedDate7 = getExperimentDayDate(exp?.start_date, 7)
        const derivedDate14 = getExperimentDayDate(exp?.start_date, 14)

        form.reset({
          unit: (currentTest.unit as any) ?? "americana",
          requisition: (currentTest.requisition as any) ?? "interna",
          testLot: currentTest.test_lot ?? "",
          matrixLot: currentTest.matrix_lot ?? "",
          strain: currentTest.strain ?? exp?.strain ?? "",
          mpLot: currentTest.mp_lot ?? "",
          testType: currentTest.test_type ?? "",

          averageHumidity: currentTest.average_humidity ?? undefined,
          bozo: currentTest.bozo ?? undefined,
          sensorial: currentTest.sensorial ?? undefined,
          quantity: currentTest.quantity ?? undefined,

          date7Day: derivedDate7 || (currentTest.date_7_day ? String(currentTest.date_7_day).slice(0, 10) : ""),
          date14Day: derivedDate14 || (currentTest.date_14_day ? String(currentTest.date_14_day).slice(0, 10) : ""),

          ...getTemperatureDefaults(currentTest),

          wetWeight: currentTest.wet_weight ?? undefined,
          dryWeight: currentTest.dry_weight ?? undefined,
          extractedConidiumWeight: currentTest.extracted_conidium_weight ?? undefined,
        })

        const { data: existingPhotos } = await supabase
          .from("test_photos")
          .select("day, storage_path, created_at, kind, photo_index")
          .eq("test_id", currentTest.id)
          .order("created_at", { ascending: true })

        if (existingPhotos) {
          const photosForDay = (day: 7 | 14) => {
            const rows = (existingPhotos as any[]).filter((p: any) => p.day === day)
            const merged = rows
              .filter((p: any) => p.kind === "merged")
              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

            if (merged.length > 0) {
              return { rows: [merged[0]], hasMerged: true }
            }

            const singles = rows
              .filter((p: any) => !p.kind || p.kind === "single")
              .sort(
                (a: any, b: any) =>
                  (a.photo_index ?? 999) - (b.photo_index ?? 999) ||
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
              )

            return { rows: singles, hasMerged: false }
          }

          const day7 = photosForDay(7)
          if (day7.rows.length > 0) {
            const paths7 = day7.rows.map((p: any) => p.storage_path).filter(Boolean)
            const urls7 = await getSignedUrlsForPaths(supabase, paths7, { cache: signedUrlCache })
            const clean7 = urls7.filter(Boolean)
            setPhotos7Day(clean7)
            setExistingMerged7Url(day7.hasMerged ? clean7[0] ?? null : null)
          } else {
            setPhotos7Day([])
            setExistingMerged7Url(null)
          }

          const day14 = photosForDay(14)
          if (day14.rows.length > 0) {
            const paths14 = day14.rows.map((p: any) => p.storage_path).filter(Boolean)
            const urls14 = await getSignedUrlsForPaths(supabase, paths14, { cache: signedUrlCache })
            const clean14 = urls14.filter(Boolean)
            setPhotos14Day(clean14)
            setExistingMerged14Url(day14.hasMerged ? clean14[0] ?? null : null)
          } else {
            setPhotos14Day([])
            setExistingMerged14Url(null)
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, experimentId, repetitionNumber, testNumber, form, router])

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) {
        router.push("/auth/login")
        return
      }

      const ensuredTest = await ensureTestRow(supabase, {
        experimentId,
        repetitionNumber,
        testNumber,
        createdBy: user.id,
        defaultStrain: experiment?.strain ?? values.strain ?? null,
      })

      setTestDbId(ensuredTest.id)

      const derivedDate7 = getExperimentDayDate(experiment?.start_date, 7) || values.date7Day
      const derivedDate14 = getExperimentDayDate(experiment?.start_date, 14) || values.date14Day

      const payload = {
        unit: values.unit ?? null,
        requisition: values.requisition ?? null,

        test_lot: values.testLot || null,
        matrix_lot: values.matrixLot || null,
        strain: values.strain || null,
        mp_lot: values.mpLot || null,
        test_type: values.testType || null,

        average_humidity: values.averageHumidity ?? null,
        bozo: values.bozo ?? null,
        sensorial: values.sensorial ?? null,
        quantity: values.quantity ?? null,

        date_7_day: toStoredDateIso(derivedDate7),
        date_14_day: toStoredDateIso(derivedDate14),

        ...getTemperaturePayload(values),

        wet_weight: values.wetWeight ?? null,
        dry_weight: values.dryWeight ?? null,
        extracted_conidium_weight: values.extractedConidiumWeight ?? null,

        // ✅ AGORA SALVA AS ANOTAÇÕES NO TESTE (jsonb)
        annotations_7_day: annotations7Day && Object.keys(annotations7Day).length ? annotations7Day : null,
        annotations_14_day: annotations14Day && Object.keys(annotations14Day).length ? annotations14Day : null,

        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from("tests")
        .update(payload)
        .eq("id", ensuredTest.id)

      if (error) throw error

      // ✅ Só mexe no storage se tiver foto NOVA (dataURL)
      // ✅ Fotos: substitui o dia somente se o usuário recapturou (dataURL)
      if (photos7Day.length > 0 && hasNewCapturedPhotos(photos7Day)) {
        // ✅ MODO ECONÔMICO: salva SOMENTE o mosaico (kind='merged') do 7º dia
        // (as 6 fotos individuais continuam no código, mas o salvamento está desativado por enquanto)
        if (photos7Day.every((p) => isDataUrlImage(p)) && photos7Day.length >= 6) {
          const mosaicBlob = await createMosaicBlob(photos7Day.slice(0, 6))
          await replaceMergedDayPhoto({ supabase, userId: user.id, testId: ensuredTest.id, day: 7, mosaicBlob })
        } else {
          throw new Error("Para salvar as fotos do 7º dia, capture as 6 fotos antes de salvar.")
        }
      }
      if (photos14Day.length > 0 && hasNewCapturedPhotos(photos14Day)) {
        // ✅ MODO ECONÔMICO: salva SOMENTE o mosaico (kind='merged') do 14º dia
        if (photos14Day.every((p) => isDataUrlImage(p)) && photos14Day.length >= 6) {
          const mosaicBlob = await createMosaicBlob(photos14Day.slice(0, 6))
          await replaceMergedDayPhoto({ supabase, userId: user.id, testId: ensuredTest.id, day: 14, mosaicBlob })
        } else {
          throw new Error("Para salvar as fotos do 14º dia, capture as 6 fotos antes de salvar.")
        }
      }

      router.push(`/experiments/${experimentId}/repetition/${repetitionId}/test/${testId}/view`)
    } catch (e: any) {
      console.error(e)
      alert(e?.message ?? "Erro ao salvar teste.")
    } finally {
      setSaving(false)
    }
  }

  const handleCapture7DayComplete = (photos: string[], annotations?: AnnotationsByPhotoIndex) => {
    setPhotos7Day(photos)
    setAnnotations7Day(annotations ?? {})
    setIsCapturing7Day(false)
  }

  const handleCapture14DayComplete = (photos: string[], annotations?: AnnotationsByPhotoIndex) => {
    setPhotos14Day(photos)
    setAnnotations14Day(annotations ?? {})
    setIsCapturing14Day(false)
  }

  const startPhotoCapture = (day: 7 | 14) => {
    if (day === 7) {
      if (existingMerged7Url && !hasNewCapturedPhotos(photos7Day)) {
        setOpenDayPreview(7)
        return
      }
      prevPhotos7Ref.current = photos7Day?.length ? [...photos7Day] : null
      setIsCapturing7Day(true)
      return
    }

    if (existingMerged14Url && !hasNewCapturedPhotos(photos14Day)) {
      setOpenDayPreview(14)
      return
    }
    prevPhotos14Ref.current = photos14Day?.length ? [...photos14Day] : null
    setIsCapturing14Day(true)
  }

  const renderAnnotationSummary = (day: 7 | 14) => {
    const annotations = day === 7 ? annotations7Day : annotations14Day
    if (!Object.keys(annotations || {}).length) return null

    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-white/70 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Anotações ({day}º dia)</div>
        <ul className="mt-1 max-h-24 space-y-1 overflow-auto pl-4 text-xs text-muted-foreground list-disc">
          {Object.entries(annotations).flatMap(([idx, anns]) =>
            ((anns as Annotation[]) || []).map((a, j) => (
              <li key={`${day}-${idx}-${j}`}>Foto {Number(idx) + 1}: {a.caption}</li>
            )),
          )}
        </ul>
      </div>
    )
  }

  const renderMediaBlock = (day: 7 | 14) => {
    const photos = day === 7 ? photos7Day : photos14Day
    const hasPhotos = photos.length > 0
    const isExistingMerged = day === 7 ? Boolean(existingMerged7Url && !hasNewCapturedPhotos(photos7Day)) : Boolean(existingMerged14Url && !hasNewCapturedPhotos(photos14Day))
    const statusText = hasPhotos
      ? isExistingMerged
        ? "Mosaico salvo"
        : `Fotos capturadas (${photos.length})`
      : "Pendente"

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 shadow-sm dark:border-slate-800 dark:bg-slate-950/30">
        <Button
          type="button"
          variant={hasPhotos ? "default" : "outline"}
          onClick={() => startPhotoCapture(day)}
          className="h-auto w-full justify-between rounded-none border-0 px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            <span className="font-semibold">Fotos do {day}º dia</span>
          </span>
          <span className="flex items-center gap-2 text-xs font-medium opacity-90">
            {hasPhotos && <Check className="h-4 w-4" />}
            {statusText}
          </span>
        </Button>

        <div className="grid grid-cols-3 border-t border-slate-200 dark:border-slate-800">
          {Array.from({ length: 6 }, (_, i) => {
            const filled = isExistingMerged || photos.length > i
            return (
              <div
                key={`${day}-${i}`}
                className={`flex aspect-[4/2.15] items-center justify-center border-r border-b border-slate-200 text-sm font-semibold last:border-r-0 dark:border-slate-800 ${
                  filled ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-white text-slate-500 dark:bg-slate-950/30"
                }`}
              >
                {i + 1}
              </div>
            )
          })}
        </div>

        {renderAnnotationSummary(day)}
      </div>
    )
  }

  if (loading) {
    return <div className="container mx-auto p-4">Carregando formulário...</div>
  }

  if (isCapturing7Day) {
    return (
      <PhotoCaptureWorkflow
        onComplete={handleCapture7DayComplete}
        onCancel={() => {
          setIsCapturing7Day(false)
          if (prevPhotos7Ref.current) {
            setPhotos7Day(prevPhotos7Ref.current)
            prevPhotos7Ref.current = null
            setAnnotations7Day({})
          }
        }}
        testInfo={{
          experimentNumber: experiment?.number || experimentId,
          repetitionNumber: String(repetitionId),
          testNumber: String(testId),
          strain: form.getValues("strain") || experiment?.strain || "",
          day: 7,
          date: date7FromExperiment || form.getValues("date7Day"),
          unit: form.getValues("unit"),
          testLot: form.getValues("testLot"),
          matrixLot: form.getValues("matrixLot"),
          testType: form.getValues("testType"),
        }}
      />
    )
  }

  if (isCapturing14Day) {
    return (
      <PhotoCaptureWorkflow
        onComplete={handleCapture14DayComplete}
        onCancel={() => {
          setIsCapturing14Day(false)
          if (prevPhotos14Ref.current) {
            setPhotos14Day(prevPhotos14Ref.current)
            prevPhotos14Ref.current = null
            setAnnotations14Day({})
          }
        }}
        testInfo={{
          experimentNumber: experiment?.number || experimentId,
          repetitionNumber: String(repetitionId),
          testNumber: String(testId),
          strain: form.getValues("strain") || experiment?.strain || "",
          day: 14,
          date: date14FromExperiment || form.getValues("date14Day"),
          unit: form.getValues("unit"),
          testLot: form.getValues("testLot"),
          matrixLot: form.getValues("matrixLot"),
          testType: form.getValues("testType"),
        }}
      />
    )
  }

  return (
    <div className="container mx-auto w-full max-w-7xl px-4 py-6">
      <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-2xl">Editar Teste</CardTitle>
              <CardDescription className="mt-1">
                Experimento #{experiment?.number ?? experimentId} • Repetição {repetitionId} • Teste {testId}
              </CardDescription>
            </div>
            <div className="rounded-2xl border bg-white/80 px-4 py-2 text-sm shadow-sm dark:bg-slate-950/60">
              <span className="text-muted-foreground">Cepa</span>
              <span className="ml-2 font-semibold">{form.watch("strain") || experiment?.strain || "-"}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/30">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">Informações do teste</h3>
                    <p className="text-xs text-muted-foreground">Dados gerais, lotes e parâmetros iniciais.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidade</FormLabel>
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="americana">Americana</SelectItem>
                            <SelectItem value="salto">Salto</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="requisition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Requisição</FormLabel>
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="interna">Interna</SelectItem>
                            <SelectItem value="externa">Externa</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="testLot"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lote Teste</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="matrixLot"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lote Matriz</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="strain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cepa</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mpLot"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lote MP</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="testType"
                    render={({ field }) => (
                      <FormItem className="xl:col-span-2">
                        <FormLabel>Tipo de Teste</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="Ex: Teste A" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/30">
                <div className="mb-4">
                  <h3 className="text-base font-semibold">Medições iniciais</h3>
                  <p className="text-xs text-muted-foreground">Campos numéricos compactos para facilitar o preenchimento.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="averageHumidity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Média umidade</FormLabel>
                        <FormControl>
                          <NumberInputWithSuffix value={field.value} onChange={field.onChange} step="0.1" suffix="%" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bozo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bozo (min)</FormLabel>
                        <FormControl>
                          <NumberInputWithSuffix value={field.value} onChange={field.onChange} step="0.1" suffix="min" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sensorial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sensorial</FormLabel>
                        <FormControl>
                          <NumberInputWithSuffix value={field.value} onChange={field.onChange} step="0.1" suffix="pts" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade da Amostra</FormLabel>
                        <FormControl>
                          <NumberInputWithSuffix value={field.value} onChange={field.onChange} step="0.1" suffix="kg" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(430px,0.92fr)_minmax(520px,1.08fr)]">
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/30">
                  <div className="flex items-center gap-3 border-b px-4 py-3 dark:border-slate-800">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300">
                      <Thermometer className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold">Temperatura</h3>
                      <p className="text-xs text-muted-foreground">Datas sequenciais a partir do início do experimento.</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto p-3">
                    <div className="min-w-[420px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="grid grid-cols-[1.15fr_0.85fr_0.85fr] bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        <div className="border-r px-3 py-2 dark:border-slate-800">Dia</div>
                        <div className="border-r px-2 py-2 text-center dark:border-slate-800">Temp. Câmara</div>
                        <div className="px-2 py-2 text-center">Temp. Arroz</div>
                      </div>

                      {TEMPERATURE_DAYS.map((day) => {
                        const dayDate = getExperimentDayDate(experiment?.start_date, day)
                        const chamberName = getTemperatureFieldName(day, "Chamber")
                        const riceName = getTemperatureFieldName(day, "Rice")

                        return (
                          <div
                            key={day}
                            className="grid grid-cols-[1.15fr_0.85fr_0.85fr] border-t border-slate-200 text-sm odd:bg-white even:bg-slate-50/70 dark:border-slate-800 dark:odd:bg-slate-950/10 dark:even:bg-slate-900/30"
                          >
                            <div className="flex min-h-[42px] items-center border-r px-3 dark:border-slate-800">
                              <div>
                                <div className="font-semibold text-slate-800 dark:text-slate-100">{day}º dia</div>
                                <div className="text-[11px] text-muted-foreground">{formatShortDate(dayDate)}</div>
                              </div>
                            </div>

                            <div className="border-r p-1.5 dark:border-slate-800">
                              <FormField
                                control={form.control}
                                name={chamberName as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <NumberInputWithSuffix
                                        value={field.value}
                                        onChange={field.onChange}
                                        step="0.1"
                                        suffix="ºC"
                                        inputClassName="h-8 text-center text-sm"
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="p-1.5">
                              <FormField
                                control={form.control}
                                name={riceName as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <NumberInputWithSuffix
                                        value={field.value}
                                        onChange={field.onChange}
                                        step="0.1"
                                        suffix="ºC"
                                        inputClassName="h-8 text-center text-sm"
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/30">
                  <div className="flex items-center gap-3 border-b px-4 py-3 dark:border-slate-800">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300">
                      <Images className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold">Mídias</h3>
                      <p className="text-xs text-muted-foreground">Capture ou refaça os mosaicos do 7º e 14º dia.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 p-3 sm:p-4">
                    {renderMediaBlock(7)}
                    {renderMediaBlock(14)}
                  </div>
                </section>
              </div>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/30">
                <div className="mb-4">
                  <h3 className="text-base font-semibold">Medições de peso</h3>
                  <p className="text-xs text-muted-foreground">Pesos finais do teste.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="wetWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peso Úmido</FormLabel>
                        <FormControl>
                          <NumberInputWithSuffix value={field.value} onChange={field.onChange} step="0.01" suffix="kg" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dryWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peso Seco</FormLabel>
                        <FormControl>
                          <NumberInputWithSuffix value={field.value} onChange={field.onChange} step="0.01" suffix="kg" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="extractedConidiumWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peso conídio extraído</FormLabel>
                        <FormControl>
                          <NumberInputWithSuffix value={field.value} onChange={field.onChange} step="0.01" suffix="kg" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              <div className="flex flex-col-reverse justify-end gap-2 pt-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/experiments/${experimentId}`)}
                  disabled={saving}
                  className="sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="sm:w-auto">
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Dialog open={openDayPreview !== null} onOpenChange={(open) => !open && setOpenDayPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {openDayPreview === 7 ? "Fotos do 7º dia" : "Fotos do 14º dia"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="overflow-hidden rounded-md border bg-black/10">
              <img
                src={
                  openDayPreview === 7
                    ? existingMerged7Url || ""
                    : existingMerged14Url || ""
                }
                alt={openDayPreview === 7 ? "Foto 7º dia" : "Foto 14º dia"}
                className="block h-auto w-full"
              />
            </div>

            <div className="flex flex-col justify-end gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenDayPreview(null)}
              >
                Manter
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const day = openDayPreview
                  setOpenDayPreview(null)
                  if (day === 7) {
                    prevPhotos7Ref.current = photos7Day?.length ? [...photos7Day] : null
                    setIsCapturing7Day(true)
                  } else if (day === 14) {
                    prevPhotos14Ref.current = photos14Day?.length ? [...photos14Day] : null
                    setIsCapturing14Day(true)
                  }
                }}
              >
                Refazer fotos
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
