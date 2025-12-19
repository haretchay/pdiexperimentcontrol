"use client"

import type { MouseEvent } from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Edit, Share2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { useCardColors } from "@/lib/color-utils"
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
}

type DbTestRow = {
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

type TestDataRecord = {
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

function isFieldFilled(testData: TestDataRecord, field: keyof TestDataRecord): boolean {
  const value = testData[field]

  if (typeof value === "number") return !Number.isNaN(value)
  if (typeof value === "string") return value.trim() !== ""
  if (Array.isArray(value)) return value.length > 0

  return value !== undefined && value !== null
}

const getTestStatus = (
  testData: TestDataRecord | null | undefined,
  allTestsInRepetition: boolean,
  allRepetitionsCompleted: boolean,
): { status: string; variant: StatusVariant } => {
  if (!testData) return { status: "Pendente", variant: "warning" }

  if (allRepetitionsCompleted) return { status: "Encerrado", variant: "destructive" }
  if (allTestsInRepetition) return { status: "Concluído", variant: "default" }

  const allFields: (keyof TestDataRecord)[] = [
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
    "temp7Chamber",
    "temp7Rice",
    "temp14Chamber",
    "temp14Rice",
    "wetWeight",
    "dryWeight",
    "extractedConidiumWeight",
  ]

  const allFieldsFilled = allFields.every((field) => isFieldFilled(testData, field))

  const hasPhotos =
    (Array.isArray(testData.photos7DayPaths) && testData.photos7DayPaths.length > 0) ||
    (Array.isArray(testData.photos14DayPaths) && testData.photos14DayPaths.length > 0)

  if (!allFieldsFilled) return { status: "Pendente", variant: "warning" }
  if (!hasPhotos) return { status: "Inserir fotos", variant: "warning" }

  return { status: "Em andamento", variant: "info" }
}

function safeNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isNaN(v) ? undefined : v
  return undefined
}

export default function ExperimentDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const experimentId = params.id // uuid (string)

  const supabase = useMemo(() => createClient(), [])

  const [experiment, setExperiment] = useState<ExperimentUI | null>(null)
  const [repetitions, setRepetitions] = useState<Repetition[]>([])
  const [testData, setTestData] = useState<Record<string, TestDataRecord>>({})

  const { getCardBackground, getCardBorder } = useCardColors()
  const isMobile = useIsMobile()
  const { toast } = useToast()
  const [isSharing, setIsSharing] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // 1) Experimento (sem test_types)
        const { data: exp, error: expErr } = await supabase
          .from("experiments")
          .select("id, number, repetition_count, test_count, start_date, strain")
          .eq("id", experimentId)
          .single()

        if (expErr) throw expErr
        if (!exp) throw new Error("Experimento não encontrado")

        const expRow = exp as DbExperimentRow

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
        const { data: tests, error: testsErr } = await supabase
          .from("tests")
          .select(
            `
            id,
            experiment_id,
            repetition_number,
            test_number,
            unit,
            requisition,
            test_type,
            test_lot,
            matrix_lot,
            strain,
            mp_lot,
            average_humidity,
            bozo,
            sensorial,
            quantity,
            temp7_chamber,
            temp14_chamber,
            temp7_rice,
            temp14_rice,
            wet_weight,
            dry_weight,
            extracted_conidium_weight,
            date_7_day,
            date_14_day,
            annotations_7_day,
            annotations_14_day,
            test_photos(day, storage_path)
          `,
          )
          .eq("experiment_id", experimentId)
          .order("repetition_number", { ascending: true })
          .order("test_number", { ascending: true })

        if (testsErr) throw testsErr

        const rows = (tests ?? []) as DbTestRow[]

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
            strain: (t.strain ?? expUI.strain) ?? undefined,
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

            wetWeight: safeNumber(t.wet_weight),
            dryWeight: safeNumber(t.dry_weight),
            extractedConidiumWeight: safeNumber(t.extracted_conidium_weight),

            photos7DayPaths: photos7,
            photos14DayPaths: photos14,
          }
        }

        // 4) Calcula status por repetição
        const repetitionsWithAllTestsDone: number[] = []

        for (let rep = 1; rep <= expUI.repetitionCount; rep++) {
          let allDone = true

          for (let test = 1; test <= expUI.testCount; test++) {
            const key = `${rep}_${test}`
            const info = map[key]

            if (!info) {
              allDone = false
              break
            }

            const requiredFields: (keyof TestDataRecord)[] = [
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
            ]

            const allFieldsFilled = requiredFields.every((f) => isFieldFilled(info, f))
            const hasPhotos =
              (info.photos7DayPaths?.length ?? 0) > 0 || (info.photos14DayPaths?.length ?? 0) > 0

            if (!allFieldsFilled || !hasPhotos) {
              allDone = false
              break
            }
          }

          if (allDone) repetitionsWithAllTestsDone.push(rep)
        }

        const allRepetitionsCompleted = repetitionsWithAllTestsDone.length === expUI.repetitionCount

        const reps: Repetition[] = []
        for (let rep = 1; rep <= expUI.repetitionCount; rep++) {
          const isRepCompleted = repetitionsWithAllTestsDone.includes(rep)

          const testsForRep: TestSummary[] = []
          for (let test = 1; test <= expUI.testCount; test++) {
            const key = `${rep}_${test}`
            const info = map[key]

            // prioridade: tests.test_type
            const label = info?.testType ? info.testType : `Teste #${test}`

            const { status, variant } = getTestStatus(info, isRepCompleted, allRepetitionsCompleted)

            testsForRep.push({
              id: test,
              number: test,
              completed: status !== "Pendente" && status !== "Inserir fotos",
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

  const handleCardClick = (repetitionId: number, testId: number) => {
    const key = `${repetitionId}_${testId}`
    const info = testData[key]

    if (!info) {
      router.push(`/experiments/${experimentId}/repetition/${repetitionId}/test/${testId}`)
      return
    }

    const { status } = getTestStatus(info, false, false)
    if (status === "Pendente" || status === "Inserir fotos") {
      router.push(`/experiments/${experimentId}/repetition/${repetitionId}/test/${testId}`)
      return
    }

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

  if (!experiment) return <div className="container mx-auto p-4">Carregando...</div>

  return (
    <div className="w-full max-w-full overflow-hidden px-2 sm:px-4">
      <div className="flex items-center mb-6 mt-4">
        <Link href="/experiments">
          <Button variant="ghost" size="sm" className="mr-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Data de Início</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{new Date(experiment.startDate).toLocaleDateString("pt-BR")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cepa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{experiment.strain}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Testes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{experiment.totalTests}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="repetition-1" className="w-full">
        <div className="w-full overflow-x-auto pb-2 -mx-2 px-2">
          <TabsList className="mb-4 w-max">
            {repetitions.map((repetition) => (
              <TabsTrigger
                key={repetition.id}
                value={`repetition-${repetition.id}`}
                disabled={!repetition.unlocked}
                className={!repetition.unlocked ? "opacity-50 cursor-not-allowed" : ""}
              >
                Repetição {repetition.number}
                {repetition.completed && <span className="ml-2 text-green-500">✓</span>}
                {!repetition.unlocked && <span className="ml-2">🔒</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {repetitions.map((repetition) => (
          <TabsContent key={repetition.id} value={`repetition-${repetition.id}`} className="w-full p-0 m-0">
            {!repetition.unlocked ? (
              <Card className="mb-4">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">
                    Esta repetição será liberada após a conclusão da repetição anterior.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                {repetition.tests.map((test) => {
                  const key = `${repetition.id}_${test.id}`
                  const info = testData[key]

                  return (
                    <Card
                      key={test.id}
                      className={`cursor-pointer hover:bg-muted/50 transition-colors border-2 ${getCardBackground("default")} ${getCardBorder("default")}`}
                      onClick={() => handleCardClick(repetition.id, test.id)}
                    >
                      <CardHeader className="mobile-card-header">
                        <CardTitle>
                          #{test.number} - {test.testType}
                        </CardTitle>
                        <CardDescription>Repetição {repetition.number}</CardDescription>
                      </CardHeader>

                      <CardContent className="mobile-card-content">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm px-2 py-0.5 rounded-full border ${
                              test.variant === "default"
                                ? "border-green-500 text-green-600"
                                : test.variant === "destructive"
                                  ? "border-red-500 text-red-600"
                                  : test.variant === "warning"
                                    ? "border-amber-500 text-amber-600"
                                    : test.variant === "info"
                                      ? "border-blue-500 text-blue-600"
                                      : "border-gray-300 text-gray-600"
                            }`}
                          >
                            {test.status}
                          </span>

                          <div className="flex gap-1">
                            {isMobile && info && (
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={(e) => handleShareTestPhotos(e, repetition.id, test.id)}
                                className="h-8 w-8 p-0"
                                disabled={isSharing}
                              >
                                <Share2 className="h-3.5 w-3.5" />
                                <span className="sr-only">Compartilhar</span>
                              </Button>
                            )}

                            <Button
                              size="icon"
                              variant="outline"
                              onClick={(e) => handleEditClick(e, repetition.id, test.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span className="sr-only">Editar</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
