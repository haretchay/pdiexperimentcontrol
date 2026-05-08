"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { saveMergedPhotosForDay } from "@/lib/pdi/merged-photos"


import { createClient } from "@/lib/supabase/client"
import { SignedUrlCache } from "@/lib/pdi/signed-url-cache"
import { getSignedUrlsForPaths, replaceMergedDayPhoto } from "@/lib/pdi/test-photos"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PhotoCaptureWorkflow } from "@/components/camera/photo-capture-workflow"
import { Camera, Check } from "lucide-react"

type Annotation = { x: number; y: number; size: string; caption: string; color?: string }
type AnnotationsByPhotoIndex = Record<number, Annotation[]>

const toNumberOrUndefined = (v: unknown) => {
  if (v === "" || v === null || v === undefined) return undefined
  if (typeof v === "number") return Number.isNaN(v) ? undefined : v
  if (typeof v === "string") {
    const s = v.trim()
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
}: {
  value: any
  onChange: any
  step?: string
  suffix: string
}) {
  return (
    <div className="relative">
      <Input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={onChange}
        className="pr-12"
      />
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
        {suffix}
      </div>
    </div>
  )
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

  temp7Chamber: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp7Rice: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp14Chamber: z.preprocess(toNumberOrUndefined, z.number().optional()),
  temp14Rice: z.preprocess(toNumberOrUndefined, z.number().optional()),

  wetWeight: z.preprocess(toNumberOrUndefined, z.number().optional()),
  dryWeight: z.preprocess(toNumberOrUndefined, z.number().optional()),
  extractedConidiumWeight: z.preprocess(toNumberOrUndefined, z.number().optional()),
})

type FormValues = z.infer<typeof formSchema>

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
    resolver: zodResolver(formSchema),
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
      temp7Chamber: undefined,
      temp7Rice: undefined,
      temp14Chamber: undefined,
      temp14Rice: undefined,
      wetWeight: undefined,
      dryWeight: undefined,
      extractedConidiumWeight: undefined,
    },
  })
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

        const { data, error } = await supabase
          .from("tests")
          .select("*")
          .eq("experiment_id", experimentId)
          .eq("repetition_number", repetitionNumber)
          .eq("test_number", testNumber)
          .maybeSingle()

        // Quando o teste ainda não existe (criação), maybeSingle retorna data=null e error=null.
        // NÃO devemos quebrar a página com 406 (PGRST116).
        if (error) throw error
        if (cancelled) return

        if (!data) {
          setTestDbId(null)
          // Mantém o formulário em branco (modo criação)
          return
        }

        setTestDbId(data.id)

        // Carregar anotações que já existiam
        setAnnotations7Day((data.annotations_7_day as any) ?? {})
        setAnnotations14Day((data.annotations_14_day as any) ?? {})

        form.reset({
          unit: (data.unit as any) ?? "americana",
          requisition: (data.requisition as any) ?? "interna",
          testLot: data.test_lot ?? "",
          matrixLot: data.matrix_lot ?? "",
          strain: data.strain ?? "",
          mpLot: data.mp_lot ?? "",
          testType: data.test_type ?? "",

          averageHumidity: data.average_humidity ?? undefined,
          bozo: data.bozo ?? undefined,
          sensorial: data.sensorial ?? undefined,
          quantity: data.quantity ?? undefined,

          date7Day: data.date_7_day ? String(data.date_7_day).slice(0, 10) : "",
          date14Day: data.date_14_day ? String(data.date_14_day).slice(0, 10) : "",

          temp7Chamber: data.temp7_chamber ?? undefined,
          temp7Rice: data.temp7_rice ?? undefined,
          temp14Chamber: data.temp14_chamber ?? undefined,
          temp14Rice: data.temp14_rice ?? undefined,

          wetWeight: data.wet_weight ?? undefined,
          dryWeight: data.dry_weight ?? undefined,
          extractedConidiumWeight: data.extracted_conidium_weight ?? undefined,
        })

        const { data: existingPhotos } = await supabase
          .from("test_photos")
          .select("day, storage_path, created_at, kind, photo_index")
          .eq("test_id", data.id)
          .order("created_at", { ascending: true })

        if (existingPhotos) {
          const singles = existingPhotos.filter((p: any) => !p.kind || p.kind === "single")
          const photos7 = singles.filter((p: any) => p.day === 7)
          const photos14 = singles.filter((p: any) => p.day === 14)

          if (photos7.length > 0) {
            const ordered7 = [...photos7].sort(
              (a: any, b: any) =>
                (a.photo_index ?? 999) - (b.photo_index ?? 999) ||
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            )
            const paths7 = ordered7.map((p: any) => p.storage_path).filter(Boolean)
            const urls7 = await getSignedUrlsForPaths(supabase, paths7, { cache: signedUrlCache })
            const clean7 = urls7.filter(Boolean)
            setPhotos7Day(clean7)
            // se existir merged (mosaico), normalmente vem como última ou como único item
            const merged7 = ordered7.find((p: any) => p.kind === "merged")
            if (merged7) {
              const idx = ordered7.findIndex((p: any) => p.kind === "merged")
              setExistingMerged7Url(clean7[idx] ?? clean7[clean7.length - 1] ?? null)
            } else {
              setExistingMerged7Url(clean7[clean7.length - 1] ?? null)
            }
          }

          if (photos14.length > 0) {
            const ordered14 = [...photos14].sort(
              (a: any, b: any) =>
                (a.photo_index ?? 999) - (b.photo_index ?? 999) ||
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            )
            const paths14 = ordered14.map((p: any) => p.storage_path).filter(Boolean)
            const urls14 = await getSignedUrlsForPaths(supabase, paths14, { cache: signedUrlCache })
            const clean14 = urls14.filter(Boolean)
            setPhotos14Day(clean14)
            const merged14 = ordered14.find((p: any) => p.kind === "merged")
            if (merged14) {
              const idx = ordered14.findIndex((p: any) => p.kind === "merged")
              setExistingMerged14Url(clean14[idx] ?? clean14[clean14.length - 1] ?? null)
            } else {
              setExistingMerged14Url(clean14[clean14.length - 1] ?? null)
            }
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
  }, [supabase, experimentId, repetitionNumber, testNumber, form])

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

        date_7_day: values.date7Day ? new Date(values.date7Day).toISOString() : null,
        date_14_day: values.date14Day ? new Date(values.date14Day).toISOString() : null,

        temp7_chamber: values.temp7Chamber ?? null,
        temp7_rice: values.temp7Rice ?? null,
        temp14_chamber: values.temp14Chamber ?? null,
        temp14_rice: values.temp14Rice ?? null,

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
        .eq("experiment_id", experimentId)
        .eq("repetition_number", repetitionNumber)
        .eq("test_number", testNumber)

      if (error) throw error

      // ✅ Só mexe no storage se tiver foto NOVA (dataURL)
      // ✅ Fotos: substitui o dia somente se o usuário recapturou (dataURL)
      if (photos7Day.length > 0 && hasNewCapturedPhotos(photos7Day) && testDbId) {
        // ✅ MODO ECONÔMICO: salva SOMENTE o mosaico (kind='merged') do 7º dia
        // (as 6 fotos individuais continuam no código, mas o salvamento está desativado por enquanto)
        if (photos7Day.every((p) => isDataUrlImage(p)) && photos7Day.length >= 6) {
          const mosaicBlob = await createMosaicBlob(photos7Day.slice(0, 6))
          await replaceMergedDayPhoto({ supabase, userId: user.id, testId: testDbId, day: 7, mosaicBlob })
        } else {
          throw new Error("Para salvar as fotos do 7º dia, capture as 6 fotos antes de salvar.")
        }
      }
      if (photos14Day.length > 0 && hasNewCapturedPhotos(photos14Day) && testDbId) {
        // ✅ MODO ECONÔMICO: salva SOMENTE o mosaico (kind='merged') do 14º dia
        if (photos14Day.every((p) => isDataUrlImage(p)) && photos14Day.length >= 6) {
          const mosaicBlob = await createMosaicBlob(photos14Day.slice(0, 6))
          await replaceMergedDayPhoto({ supabase, userId: user.id, testId: testDbId, day: 14, mosaicBlob })
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
          date: form.getValues("date7Day"),
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
          date: form.getValues("date14Day"),
          unit: form.getValues("unit"),
          testLot: form.getValues("testLot"),
          matrixLot: form.getValues("matrixLot"),
          testType: form.getValues("testType"),
        }}
      />
    )
  }

  return (
    <div className="container mx-auto max-w-3xl py-6">
      <Card>
        <CardHeader>
          <CardTitle>Editar Teste</CardTitle>
          <CardDescription>
            Experimento: {experimentId} • Repetição {repetitionId} • Teste {testId}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              <FormField
                control={form.control}
                name="testType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Teste</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="Ex: Teste A" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                      <FormLabel>Quantidade da Amostra (kg)</FormLabel>
                      <FormControl>
                        <NumberInputWithSuffix value={field.value} onChange={field.onChange} step="0.1" suffix="kg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Dados do 7º dia</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="date7Day"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data 7º dia</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="temp7Chamber"
                    render={({ field }) => (
                      <FormItem>
                      <FormLabel>Temp 7 Câmara (ºC)</FormLabel>
                      <FormControl>
                        <NumberInputWithSuffix value={field.value} onChange={field.onChange} step="0.1" suffix="ºC" />
                      </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="temp7Rice"
                    render={({ field }) => (
                      <FormItem>
                      <FormLabel>Temp 7 Arroz (ºC)</FormLabel>
                      <FormControl>
                        <NumberInputWithSuffix value={field.value} onChange={field.onChange} step="0.1" suffix="ºC" />
                      </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="button"
                  variant={photos7Day.length > 0 ? "default" : "outline"}
                  onClick={() => {
                    // Se já existe mosaico salvo e não há novas capturas (dataURL), abre modal para decidir
                    if (existingMerged7Url && !hasNewCapturedPhotos(photos7Day)) {
                      setOpenDayPreview(7)
                      return
                    }
                    // caso contrário, captura normalmente
                    prevPhotos7Ref.current = photos7Day?.length ? [...photos7Day] : null
                    setIsCapturing7Day(true)
                  }}
                  className="w-full"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {photos7Day.length > 0 ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Fotos do 7º dia capturadas ({photos7Day.length})
                    </>
                  ) : (
                    "Capturar Fotos do 7º dia"
                  )}
                </Button>

                {Object.keys(annotations7Day || {}).length > 0 && (
                  <div className="mt-3 rounded-md border p-2">
                    <div className="text-xs font-medium mb-1">Anotações (7º dia)</div>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                      {Object.entries(annotations7Day).flatMap(([idx, anns]) =>
                        (anns || []).map((a, j) => (
                          <li key={`${idx}-${j}`}>Foto {Number(idx) + 1}: {a.caption}</li>
                        )),
                      )}
                    </ul>
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Dados do 14º dia</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="date14Day"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data 14º dia</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="temp14Chamber"
                    render={({ field }) => (
                      <FormItem>
                      <FormLabel>Temp 14 Câmara (ºC)</FormLabel>
                      <FormControl>
                        <NumberInputWithSuffix value={field.value} onChange={field.onChange} step="0.1" suffix="ºC" />
                      </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="temp14Rice"
                    render={({ field }) => (
                      <FormItem>
                      <FormLabel>Temp 14 Arroz (ºC)</FormLabel>
                      <FormControl>
                        <NumberInputWithSuffix value={field.value} onChange={field.onChange} step="0.1" suffix="ºC" />
                      </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="button"
                  variant={photos14Day.length > 0 ? "default" : "outline"}
                  onClick={() => {
                    if (existingMerged14Url && !hasNewCapturedPhotos(photos14Day)) {
                      setOpenDayPreview(14)
                      return
                    }
                    prevPhotos14Ref.current = photos14Day?.length ? [...photos14Day] : null
                    setIsCapturing14Day(true)
                  }}
                  className="w-full"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {photos14Day.length > 0 ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Fotos do 14º dia capturadas ({photos14Day.length})
                    </>
                  ) : (
                    "Capturar Fotos do 14º dia"
                  )}
                </Button>

                {Object.keys(annotations14Day || {}).length > 0 && (
                  <div className="mt-3 rounded-md border p-2">
                    <div className="text-xs font-medium mb-1">Anotações (14º dia)</div>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                      {Object.entries(annotations14Day).flatMap(([idx, anns]) =>
                        (anns || []).map((a, j) => (
                          <li key={`${idx}-${j}`}>Foto {Number(idx) + 1}: {a.caption}</li>
                        )),
                      )}
                    </ul>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="wetWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Peso Úmido (kg)</FormLabel>
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
                      <FormLabel>Peso Seco (kg)</FormLabel>
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
                      <FormLabel>Peso conídio extraído (kg)</FormLabel>
                      <FormControl>
                        <NumberInputWithSuffix value={field.value} onChange={field.onChange} step="0.01" suffix="kg" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/experiments/${experimentId}`)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>


      <Dialog open={openDayPreview !== null} onOpenChange={(o) => setOpenDayPreview(o ? openDayPreview : null)}>
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
                className="w-full h-auto block"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-end">
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
