"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { createClient } from "@/lib/supabase/client"
import { assertValidTestPhotoPath, buildTestPhotoPath } from "@/lib/pdi/storage-path"
import { getSignedUrlCached, clearSignedUrlCache } from "@/lib/pdi/signed-url-cache"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PhotoCaptureWorkflow } from "@/components/camera/photo-capture-workflow"
import { Camera, Check } from "lucide-react"

type Annotation = { x: number; y: number; size: string; caption: string; color?: string }
type AnnotationsByPhotoIndex = Record<number, Annotation[]>

type DbExperiment = {
  id: string
  number: number
  strain: string
  start_date: string
  test_count: number
  repetition_count: number
}

type DbTest = {
  id: string
  unit: string | null
  requisition: string | null
  test_lot: string | null
  matrix_lot: string | null
  strain: string | null
  mp_lot: string | null
  test_type: string | null

  average_humidity: number | null
  bozo: number | null
  sensorial: number | null
  quantity: number | null

  date_7_day: string | null
  date_14_day: string | null

  temp7_chamber: number | null
  temp14_chamber: number | null
  temp7_rice: number | null
  temp14_rice: number | null

  wet_weight: number | null
  dry_weight: number | null
  extracted_conidium_weight: number | null

  annotations_7_day: any | null
  annotations_14_day: any | null
}

type DbPhotoRow = {
  day: 7 | 14
  storage_path: string
  created_at: string
}

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

function isRateLimitError(err: unknown) {
  const status = (err as any)?.status
  const msg = String((err as any)?.message ?? err ?? "")
  return status === 429 || msg.includes("Too Many") || msg.includes("rate limit")
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return await res.blob()
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

  const { id: experimentId, repetitionId, testId } = params as {
    id: string
    repetitionId: string
    testId: string
  }

  const repetitionNumber = Number(repetitionId)
  const testNumber = Number(testId)

  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [isCapturing7Day, setIsCapturing7Day] = useState(false)
  const [isCapturing14Day, setIsCapturing14Day] = useState(false)

  // Pode conter dataURL (capturado agora) ou signed URL (existente)
  const [photos7Day, setPhotos7Day] = useState<string[]>([])
  const [photos14Day, setPhotos14Day] = useState<string[]>([])

  const [annotations7Day, setAnnotations7Day] = useState<AnnotationsByPhotoIndex>({})
  const [annotations14Day, setAnnotations14Day] = useState<AnnotationsByPhotoIndex>({})

  const [testDbId, setTestDbId] = useState<string | null>(null)
  const [experiment, setExperiment] = useState<DbExperiment | null>(null)

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

  async function storagePathToUrl(path: string) {
    return await getSignedUrlCached(supabase as any, "test-photos", path, 60 * 60)
  }

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        setErrorMsg(null)
        setLoading(true)

        const { data: exp, error: expErr } = await supabase
          .from("experiments")
          .select("id, number, strain, start_date, test_count, repetition_count")
          .eq("id", experimentId)
          .single()

        if (expErr) throw expErr
        if (cancelled) return
        setExperiment(exp as DbExperiment)

        const { data, error } = await supabase
          .from("tests")
          .select("*")
          .eq("experiment_id", experimentId)
          .eq("repetition_number", repetitionNumber)
          .eq("test_number", testNumber)
          .single()

        if (error) throw error
        if (cancelled) return

        const t = data as DbTest
        setTestDbId(t.id)

        setAnnotations7Day((t.annotations_7_day as any) ?? {})
        setAnnotations14Day((t.annotations_14_day as any) ?? {})

        form.reset({
          unit: (t.unit as any) ?? "americana",
          requisition: (t.requisition as any) ?? "interna",
          testLot: t.test_lot ?? "",
          matrixLot: t.matrix_lot ?? "",
          strain: t.strain ?? "",
          mpLot: t.mp_lot ?? "",
          testType: t.test_type ?? "",

          averageHumidity: t.average_humidity ?? undefined,
          bozo: t.bozo ?? undefined,
          sensorial: t.sensorial ?? undefined,
          quantity: t.quantity ?? undefined,

          date7Day: t.date_7_day ? String(t.date_7_day).slice(0, 10) : "",
          date14Day: t.date_14_day ? String(t.date_14_day).slice(0, 10) : "",

          temp7Chamber: t.temp7_chamber ?? undefined,
          temp7Rice: t.temp7_rice ?? undefined,
          temp14Chamber: t.temp14_chamber ?? undefined,
          temp14Rice: t.temp14_rice ?? undefined,

          wetWeight: t.wet_weight ?? undefined,
          dryWeight: t.dry_weight ?? undefined,
          extractedConidiumWeight: t.extracted_conidium_weight ?? undefined,
        })

        const { data: existingPhotos, error: pErr } = await supabase
          .from("test_photos")
          .select("day, storage_path, created_at")
          .eq("test_id", t.id)
          .order("created_at", { ascending: true })

        if (pErr) throw pErr

        const rows = (existingPhotos ?? []) as DbPhotoRow[]
        const photos7 = rows.filter((p) => p.day === 7)
        const photos14 = rows.filter((p) => p.day === 14)

        if (photos7.length) {
          const urls7 = await Promise.all(photos7.map((p) => storagePathToUrl(p.storage_path)))
          if (!cancelled) setPhotos7Day(urls7.filter(Boolean))
        }

        if (photos14.length) {
          const urls14 = await Promise.all(photos14.map((p) => storagePathToUrl(p.storage_path)))
          if (!cancelled) setPhotos14Day(urls14.filter(Boolean))
        }
      } catch (e) {
        console.error(e)
        const msg = isRateLimitError(e)
          ? "Muitas requisições ao Supabase (429). Aguarde alguns segundos e recarregue."
          : "Erro ao carregar o teste."
        if (!cancelled) setErrorMsg(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, experimentId, repetitionNumber, testNumber, form])

  async function savePhotosToStorage(photos: string[], day: 7 | 14, userId: string) {
    if (!testDbId) throw new Error("Test interno não encontrado (testDbId). Recarregue a página.")

    // Só mexe no storage se houver foto NOVA (dataURL)
    if (!hasNewCapturedPhotos(photos)) return

    // Evita apagar fotos antigas se houver mistura de URLs antigas + dataURL.
    const hasOldUrls = photos.some((p) => !isDataUrlImage(p))
    if (hasOldUrls) {
      throw new Error(
        "Detectei mistura de fotos antigas e novas no mesmo dia. Para evitar perder imagens, recapture o dia completo.",
      )
    }

    // Buscar fotos antigas (para remover após o sucesso)
    const { data: oldPhotos, error: oldErr } = await supabase
      .from("test_photos")
      .select("storage_path")
      .eq("test_id", testDbId)
      .eq("day", day)

    if (oldErr) throw oldErr
    const oldPaths = (oldPhotos ?? []).map((p: any) => p.storage_path)

    const newPaths: string[] = []

    try {
      // Upload sequencial (mais estável no browser)
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i]
        if (!isDataUrlImage(photo)) continue

        const response = await fetch(photo)
        const blob = await response.blob()

        const filePath = buildTestPhotoPath({
          userId,
          testId: testDbId,
          day,
          index: i + 1,
          ext: "jpg",
          timestamp: Date.now() + i,
        })

        assertValidTestPhotoPath(filePath, { userId, testId: testDbId })

        const { error: uploadError } = await supabase.storage.from("test-photos").upload(filePath, blob, {
          contentType: "image/jpeg",
          upsert: true,
        })
        if (uploadError) throw uploadError

        newPaths.push(filePath)
      }

      if (newPaths.length === 0) return

      // Inserção em lote no DB (mais rápido e reduz chamadas)
      const rows = newPaths.map((p) => ({ test_id: testDbId, day, storage_path: p }))
      const { error: dbError } = await supabase.from("test_photos").insert(rows)
      if (dbError) throw dbError
    } catch (error) {
      // rollback best-effort: remove uploads novos
      if (newPaths.length > 0) {
        await supabase.storage.from("test-photos").remove(newPaths)
      }
      console.error(`Erro ao salvar fotos do ${day}º dia:`, error)
      throw error
    }

    // Agora, remove fotos antigas (best-effort)
    try {
      if (oldPaths && oldPaths.length > 0) {
        await supabase.storage.from("test-photos").remove(oldPaths)
        await supabase.from("test_photos").delete().eq("test_id", testDbId).eq("day", day).in("storage_path", oldPaths)
      }
    } catch (e) {
      console.warn("[photos] Não foi possível remover fotos antigas (best-effort):", e)
    }

    // Limpar cache de signed URLs para garantir preview atualizado
    clearSignedUrlCache("test-photos:")

    // Atualiza o preview local para URLs do storage
    const signedUrls = await Promise.all(newPaths.map((p) => storagePathToUrl(p)))
    if (day === 7) setPhotos7Day(signedUrls.filter(Boolean))
    if (day === 14) setPhotos14Day(signedUrls.filter(Boolean))
  }

  async function onSubmit(values: FormValues) {
    setSaving(true)
    setErrorMsg(null)
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

      if (photos7Day.length > 0 && hasNewCapturedPhotos(photos7Day)) {
        await savePhotosToStorage(photos7Day, 7, user.id)
      }

      if (photos14Day.length > 0 && hasNewCapturedPhotos(photos14Day)) {
        await savePhotosToStorage(photos14Day, 14, user.id)
      }

      router.push(`/experiments/${experimentId}/repetition/${repetitionId}/test/${testId}/view`)
    } catch (e: any) {
      console.error(e)
      const msg = isRateLimitError(e)
        ? "Muitas requisições ao Supabase (429). Aguarde alguns segundos e tente novamente."
        : e?.message ?? "Erro ao salvar teste."
      setErrorMsg(msg)
      alert(msg)
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

  if (errorMsg) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-xl font-semibold">Não foi possível carregar</h1>
        <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Recarregar
        </Button>
      </div>
    )
  }

  if (isCapturing7Day) {
    return (
      <PhotoCaptureWorkflow
        onComplete={handleCapture7DayComplete}
        onCancel={() => setIsCapturing7Day(false)}
        testInfo={{
          experimentNumber: String(experiment?.number ?? experimentId),
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
        onCancel={() => setIsCapturing14Day(false)}
        testInfo={{
          experimentNumber: String(experiment?.number ?? experimentId),
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
                    <FormLabel>Tipo de teste</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="averageHumidity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Umidade média</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" {...field} value={(field.value as any) ?? ""} />
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
                      <FormLabel>Quantidade</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" {...field} value={(field.value as any) ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bozo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bozo</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" {...field} value={(field.value as any) ?? ""} />
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
                        <Input type="number" step="any" {...field} value={(field.value as any) ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Registro do 7º dia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="date7Day"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data (7º dia)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="temp7Chamber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Temperatura Câmara (7º)</FormLabel>
                          <FormControl>
                            <Input type="number" step="any" {...field} value={(field.value as any) ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="temp7Rice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Temperatura Arroz (7º)</FormLabel>
                          <FormControl>
                            <Input type="number" step="any" {...field} value={(field.value as any) ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="button" variant="outline" onClick={() => setIsCapturing7Day(true)} className="w-full">
                    <Camera className="h-4 w-4 mr-2" />
                    {photos7Day.length ? "Refazer / atualizar fotos do 7º dia" : "Capturar fotos do 7º dia"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Registro do 14º dia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="date14Day"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data (14º dia)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="temp14Chamber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Temperatura Câmara (14º)</FormLabel>
                          <FormControl>
                            <Input type="number" step="any" {...field} value={(field.value as any) ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="temp14Rice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Temperatura Arroz (14º)</FormLabel>
                          <FormControl>
                            <Input type="number" step="any" {...field} value={(field.value as any) ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="button" variant="outline" onClick={() => setIsCapturing14Day(true)} className="w-full">
                    <Camera className="h-4 w-4 mr-2" />
                    {photos14Day.length ? "Refazer / atualizar fotos do 14º dia" : "Capturar fotos do 14º dia"}
                  </Button>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="wetWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Peso úmido</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" {...field} value={(field.value as any) ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dryWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Peso seco</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" {...field} value={(field.value as any) ?? ""} />
                      </FormControl>
                      <FormMessage />
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
                        <Input type="number" step="any" {...field} value={(field.value as any) ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Salvando..." : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Salvar
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
