// @ts-nocheck
"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Edit, Camera } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { PhotoGridDisplay } from "@/components/camera/photo-grid-display"
import { createClient } from "@/lib/supabase/client"

type PhotoRow = {
  id: string
  test_id: string
  day: 7 | 14
  storage_path: string
  created_at: string
}

const BUCKET = "test-photos"
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hora

export default function TestViewPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const { id: experimentId, repetitionId, testId } = params as {
    id: string
    repetitionId: string
    testId: string
  }

  const repetitionNumber = Number(repetitionId)
  const testNumber = Number(testId)

  const [testData, setTestData] = useState<any>(null)
  const [experiment, setExperiment] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Calcular o número da semana a partir da data atual
  const getWeekNumber = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
  }

  async function storagePathToUrl(path: string) {
    if (!path) return ""
    const normalized = String(path).replace(/^\/+/, "")

    // Bucket privado -> SEMPRE usar signed url
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(normalized, SIGNED_URL_TTL_SECONDS)

    if (error) {
      console.error("Erro ao gerar signed URL:", error, normalized)
      return ""
    }

    return data?.signedUrl || ""
  }

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        setLoading(true)

        // Garantir que existe usuário logado (importante para Storage privado + RLS)
        const { data: userRes, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        if (!userRes?.user) {
          router.push("/auth/login")
          return
        }

        // Experiment (uuid)
        const { data: exp, error: expErr } = await supabase
          .from("experiments")
          .select("id, number, strain, start_date, test_count, repetition_count")
          .eq("id", experimentId)
          .single()

        if (expErr) throw expErr
        if (cancelled) return
        setExperiment(exp)

        // Test row
        const { data: t, error: tErr } = await supabase
          .from("tests")
          .select("*")
          .eq("experiment_id", experimentId)
          .eq("repetition_number", repetitionNumber)
          .eq("test_number", testNumber)
          .single()

        if (tErr) throw tErr

        // Photos
        const { data: photos, error: pErr } = await supabase
          .from("test_photos")
          .select("id, test_id, day, storage_path, created_at")
          .eq("test_id", t.id)
          .order("created_at", { ascending: true })

        if (pErr) throw pErr

        const photos7 = (photos ?? []).filter((p: PhotoRow) => p.day === 7)
        const photos14 = (photos ?? []).filter((p: PhotoRow) => p.day === 14)

        const urls7 = await Promise.all(photos7.map((p: PhotoRow) => storagePathToUrl(p.storage_path)))
        const urls14 = await Promise.all(photos14.map((p: PhotoRow) => storagePathToUrl(p.storage_path)))

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
  }, [supabase, experimentId, repetitionNumber, testNumber, router])

  const currentDate = new Date()
  const weekNumber = getWeekNumber(currentDate)

  if (loading) {
    return <div className="container mx-auto p-4">Carregando detalhes do teste...</div>
  }

  if (!testData) {
    return <div className="container mx-auto p-4">Teste não encontrado</div>
  }

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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Média umidade</h3>
              <p className="font-medium">{testData.averageHumidity ?? "-"}%</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Bozo</h3>
              <p className="font-medium">{testData.bozo ?? "-"} min</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Sensorial</h3>
              <p className="font-medium">{testData.sensorial ?? "-"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Quantidade</h3>
              <p className="font-medium">{testData.quantity ?? "-"} kg</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Tipo de Teste</h3>
              <p className="font-medium">{testData.testType ?? "-"}</p>
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
              <p className="font-medium">{testData.temp7Chamber ? `${testData.temp7Chamber} ºC` : "Não informado"}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Temp 7º dia - Arroz</h3>
              <p className="font-medium">{testData.temp7Rice ? `${testData.temp7Rice} ºC` : "Não informado"}</p>
            </div>
          </div>

          {testData.photos7Day && Array.isArray(testData.photos7Day) && testData.photos7Day.length > 0 ? (
            <PhotoGridDisplay
              photos={testData.photos7Day}
              annotations={testData.annotations7Day as any}
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
              <p className="font-medium">{testData.temp14Chamber ? `${testData.temp14Chamber} ºC` : "Não informado"}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Temp 14º dia - Arroz</h3>
              <p className="font-medium">{testData.temp14Rice ? `${testData.temp14Rice} ºC` : "Não informado"}</p>
            </div>
          </div>

          {testData.photos14Day && Array.isArray(testData.photos14Day) && testData.photos14Day.length > 0 ? (
            <PhotoGridDisplay
              photos={testData.photos14Day}
              annotations={testData.annotations14Day as any}
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

      <Card>
        <CardHeader>
          <CardTitle>Secagem e Extração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Peso Úmido</h3>
              <p className="font-medium">{testData.wetWeight ? `${testData.wetWeight} kg` : "Não informado"}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Peso Após Secagem</h3>
              <p className="font-medium">{testData.dryWeight ? `${testData.dryWeight} kg` : "Não informado"}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Peso conídio extraído</h3>
              <p className="font-medium">
                {testData.extractedConidiumWeight ? `${testData.extractedConidiumWeight} kg` : "Não informado"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
