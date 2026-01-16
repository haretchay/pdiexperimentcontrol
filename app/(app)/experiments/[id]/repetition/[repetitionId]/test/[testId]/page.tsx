// @ts-nocheck
"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
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

  async function storagePathToUrl(path: string) {
    // Preferir signed URL (funciona em bucket privado e público)
    const { data, error } = await supabase.storage.from("test-photos").createSignedUrl(path, 60 * 60)
    if (error || !data?.signedUrl) {
      console.error("[v0] Erro ao criar signed URL:", error)
      return ""
    }
    return data.signedUrl
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

        const { data, error } = await supabase
          .from("tests")
          .select("*")
          .eq("experiment_id", experimentId)
          .eq("repetition_number", repetitionNumber)
          .eq("test_number", testNumber)
          .single()

        if (error) throw error
        if (cancelled) return

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
          .select("day, storage_path, created_at")
          .eq("test_id", data.id)
          .order("created_at", { ascending: true })

        if (existingPhotos) {
          const photos7 = existingPhotos.filter((p: any) => p.day === 7)
          const photos14 = existingPhotos.filter((p: any) => p.day === 14)

          if (photos7.length > 0) {
            const urls7 = await Promise.all(photos7.map((p: any) => storagePathToUrl(p.storage_path)))
            setPhotos7Day(urls7.filter(Boolean))
          }

          if (photos14.length > 0) {
            const urls14 = await Promise.all(photos14.map((p: any) => storagePathToUrl(p.storage_path)))
            setPhotos14Day(urls14.filter(Boolean))
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

    async function savePhotosToStorage(photos: string[], day: 7 | 14, userId: string) {
    if (!testDbId) return

    // Segurança: só faz upload se forem fotos NOVAS (dataURL).
    // Se forem URLs antigas, NÃO re-upar / NÃO deletar nada.
    if (!hasNewCapturedPhotos(photos)) return

    try {
      // Deletar fotos antigas do dia específico (somente porque vamos substituir)
      const { data: oldPhotos } = await supabase
        .from("test_photos")
        .select("storage_path")
        .eq("test_id", testDbId)
        .eq("day", day)

      if (oldPhotos && oldPhotos.length > 0) {
        const pathsToDelete = oldPhotos.map((p: any) => p.storage_path)
        await supabase.storage.from("test-photos").remove(pathsToDelete)
        await supabase.from("test_photos").delete().eq("test_id", testDbId).eq("day", day)
      }

      // Fazer upload das novas fotos (dataURL)
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i]
        if (!isDataUrlImage(photo)) continue

        const response = await fetch(photo)
        const blob = await response.blob()

        const fileName = `day${day}_photo${i + 1}_${Date.now()}.jpg`
        const filePath = `${userId}/${testDbId}/${fileName}`


        const { error: uploadError } = await supabase.storage.from("test-photos").upload(filePath, blob, {
          contentType: "image/jpeg",
          upsert: true,
        })
        if (uploadError) throw uploadError

        const { error: dbError } = await supabase.from("test_photos").insert({
          test_id: testDbId,
          day: day,
          storage_path: filePath,
        })
        if (dbError) throw dbError
      }
    } catch (error) {
      console.error(`Erro ao salvar fotos do ${day}º dia:`, error)
      throw error
    }
  }

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
      if (photos7Day.length > 0 && hasNewCapturedPhotos(photos7Day)) {
        await savePhotosToStorage(photos7Day, 7, user.Id)
      }
      if (photos14Day.length > 0 && hasNewCapturedPhotos(photos14Day)) {
        await savePhotosToStorage(photos14Day, 14, user.Id)
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
        onCancel={() => setIsCapturing7Day(false)}
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
        onCancel={() => setIsCapturing14Day(false)}
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
                        <Input type="number" step="0.1" value={field.value ?? ""} onChange={field.onChange} />
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
                      <FormLabel>Bozo</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" value={field.value ?? ""} onChange={field.onChange} />
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
                        <Input type="number" step="0.1" value={field.value ?? ""} onChange={field.onChange} />
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
                        <Input type="number" step="0.1" value={field.value ?? ""} onChange={field.onChange} />
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
                        <FormLabel>Temp 7 Câmara</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" value={field.value ?? ""} onChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="temp7Rice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temp 7 Arroz</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" value={field.value ?? ""} onChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="button"
                  variant={photos7Day.length > 0 ? "default" : "outline"}
                  onClick={() => setIsCapturing7Day(true)}
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
                        <FormLabel>Temp 14 Câmara</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" value={field.value ?? ""} onChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="temp14Rice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temp 14 Arroz</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" value={field.value ?? ""} onChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="button"
                  variant={photos14Day.length > 0 ? "default" : "outline"}
                  onClick={() => setIsCapturing14Day(true)}
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="wetWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Peso Úmido</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" value={field.value ?? ""} onChange={field.onChange} />
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
                        <Input type="number" step="0.01" value={field.value ?? ""} onChange={field.onChange} />
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
                        <Input type="number" step="0.01" value={field.value ?? ""} onChange={field.onChange} />
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
    </div>
  )
}
