"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Edit, Camera } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
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

        const { data: photos, error: pErr } = await supabase
          .from("test_photos")
          .select("id, test_id, day, storage_path, created_at, kind, photo_index")
          .eq("test_id", t.id)
          .eq("kind", "single")
          .order("created_at", { ascending: true })

        if (pErr) throw pErr

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

        const paths7 = ordered7.map((p: PhotoRow) => p.storage_path).filter(Boolean)
        const paths14 = ordered14.map((p: PhotoRow) => p.storage_path).filter(Boolean)

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

  if (loading) return <div className="container mx-auto p-4">Carregando detalhes do teste...</div>
  if (!testData) return <div className="container mx-auto p-4">Teste não encontrado</div>

  return (
    <div className="container mx-auto p-4 max-w-3xl overflow-x-hidden">
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

        <Button
          onClick={() => router.push(`/experiments/${experimentId}/repetition/${repetitionId}/test/${testId}`)}
          className="flex items-center gap-1 w-full sm:w-auto"
        >
          <Edit className="h-4 w-4" />
          Editar Teste
        </Button>
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
              <p className="font-medium">{testData.wetWeight === null || testData.wetWeight === undefined ? "Não informado" : `${testData.wetWeight} g`}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Peso Seco</h3>
              <p className="font-medium">{testData.dryWeight === null || testData.dryWeight === undefined ? "Não informado" : `${testData.dryWeight} g`}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Peso Conídio Extraído</h3>
              <p className="font-medium">
                {testData.extractedConidiumWeight === null || testData.extractedConidiumWeight === undefined ? "Não informado" : `${testData.extractedConidiumWeight} g`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
