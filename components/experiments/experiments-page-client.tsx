"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PlusCircle, Calendar, CalendarDays, Download, Trash } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PeriodGroup } from "@/components/period-group"
import { PageTitle } from "@/components/page-title"
import { useCardColors } from "@/lib/color-utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { createClient } from "@/lib/supabase/client"
import { deleteExperiment, getTestsByExperiment, type Test as DbTest } from "@/lib/supabase/experiments"
import type { UIExperiment } from "@/app/(app)/experiments/page"

// Função auxiliar para obter a semana do ano
function getWeekNumber(date: Date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
}

// Função auxiliar para obter o nome do mês
function getMonthName(date: Date) {
  return date.toLocaleString("pt-BR", { month: "long" })
}

type TestDataMap = Record<
  string,
  {
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
    // Fotos serão buscadas de test_photos no Step 2 (por enquanto mantemos vazio)
    photos7Day?: string[]
    photos14Day?: string[]
  }
>

function testsToMap(tests: DbTest[]): TestDataMap {
  const map: TestDataMap = {}

  for (const t of tests) {
    const key = `${t.repetitionNumber}_${t.testNumber}`

    map[key] = {
      unit: t.unit ?? undefined,
      requisition: t.requisition ?? undefined,
      testLot: t.testLot ?? undefined,
      matrixLot: t.matrixLot ?? undefined,
      strain: t.strain ?? undefined,
      mpLot: t.mpLot ?? undefined,

      averageHumidity: typeof t.averageHumidity === "number" ? t.averageHumidity : undefined,
      bozo: typeof t.bozo === "number" ? t.bozo : undefined,
      sensorial: typeof t.sensorial === "number" ? t.sensorial : undefined,
      quantity: typeof t.quantity === "number" ? t.quantity : undefined,

      testType: t.testType ?? undefined,

      date7Day: t.date7Day ?? undefined,
      date14Day: t.date14Day ?? undefined,

      temp7Chamber: typeof t.temp7Chamber === "number" ? t.temp7Chamber : undefined,
      temp7Rice: typeof t.temp7Rice === "number" ? t.temp7Rice : undefined,
      temp14Chamber: typeof t.temp14Chamber === "number" ? t.temp14Chamber : undefined,
      temp14Rice: typeof t.temp14Rice === "number" ? t.temp14Rice : undefined,

      wetWeight: typeof t.wetWeight === "number" ? t.wetWeight : undefined,
      dryWeight: typeof t.dryWeight === "number" ? t.dryWeight : undefined,
      extractedConidiumWeight: typeof t.extractedConidiumWeight === "number" ? t.extractedConidiumWeight : undefined,

      photos7Day: [],
      photos14Day: [],
    }
  }

  return map
}

export function ExperimentsPageClient({ initialExperiments }: { initialExperiments: UIExperiment[] }) {
  const router = useRouter()

  const [experiments, setExperiments] = useState<UIExperiment[]>(initialExperiments)
  const [periodMode, setPeriodMode] = useState<"week" | "month">("week")
  const [groupedExperiments, setGroupedExperiments] = useState<Record<string, UIExperiment[]>>({})
  const { getCardBackground, getCardBorder } = useCardColors()
  const { toast } = useToast()
  const [selectedExperimentId, setSelectedExperimentId] = useState<string>("")
  const [isExporting, setIsExporting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [experimentToDelete, setExperimentToDelete] = useState<UIExperiment | null>(null)
  const isMobile = useIsMobile()

  // Agrupar experimentos por período
  useEffect(() => {
    const grouped: Record<string, UIExperiment[]> = {}

    experiments.forEach((experiment) => {
      const startDate = new Date(experiment.startDate)
      let periodKey: string

      if (periodMode === "week") {
        const weekNumber = getWeekNumber(startDate)
        periodKey = `Semana ${weekNumber} - ${startDate.getFullYear()}`
      } else {
        const monthName = getMonthName(startDate)
        periodKey = `${monthName} de ${startDate.getFullYear()}`
      }

      if (!grouped[periodKey]) grouped[periodKey] = []
      grouped[periodKey].push(experiment)
    })

    setGroupedExperiments(grouped)
  }, [experiments, periodMode])

  async function loadTestDataFromSupabase(experimentId: string) {
    const supabase = createClient()
    const tests = await getTestsByExperiment(supabase, experimentId)
    return testsToMap(tests ?? [])
  }

  // Exportar PDF (via Supabase)
  const exportToPDF = async () => {
    if (!selectedExperimentId) {
      toast({
        title: "Nenhum experimento selecionado",
        description: "Por favor, selecione um experimento para exportar.",
        variant: "destructive",
      })
      return
    }

    setIsExporting(true)

    try {
      const experiment = experiments.find((exp) => exp.id === selectedExperimentId)
      if (!experiment) throw new Error("Experimento não encontrado")

      const testData = await loadTestDataFromSupabase(experiment.id)

      const { jsPDF } = await import("jspdf")
      const doc = new jsPDF()
      doc.setFont("helvetica")

      const margin = 20
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const contentWidth = pageWidth - margin * 2

      const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
        const lines = doc.splitTextToSize(text, maxWidth)
        doc.text(lines, x, y)
        return y + lines.length * lineHeight
      }

      // Título
      doc.setFontSize(18)
      doc.setFont("helvetica", "bold")
      let y = margin
      y = addWrappedText(`Relatório do Experimento #${experiment.number}`, margin, y, contentWidth, 8) + 10

      // Detalhes
      doc.setFontSize(12)
      doc.setFont("helvetica", "normal")
      y = addWrappedText(`Cepa: ${experiment.strain}`, margin, y, contentWidth, 6) + 4
      y =
        addWrappedText(
          `Data de Início: ${new Date(experiment.startDate).toLocaleDateString("pt-BR")}`,
          margin,
          y,
          contentWidth,
          6,
        ) + 4
      y = addWrappedText(`Testes: ${experiment.testCount}`, margin, y, contentWidth, 6) + 4
      y = addWrappedText(`Repetições: ${experiment.repetitionCount}`, margin, y, contentWidth, 6) + 10

      // Loop (sem imagens por enquanto)
      for (let rep = 1; rep <= experiment.repetitionCount; rep++) {
        for (let test = 1; test <= experiment.testCount; test++) {
          const key = `${rep}_${test}`
          const info = testData[key]

          if (y > pageHeight - margin - 20) {
            doc.addPage()
            y = margin
          }

          doc.setFont("helvetica", "bold")
          y = addWrappedText(`Repetição ${rep} / Teste ${test}`, margin, y, contentWidth, 6)
          doc.setFont("helvetica", "normal")

          if (!info) {
            y = addWrappedText(`Status: Pendente`, margin, y, contentWidth, 6) + 6
            continue
          }

          y = addWrappedText(`Unidade: ${info.unit ?? "-"}`, margin, y, contentWidth, 6)
          y = addWrappedText(`Requisição: ${info.requisition ?? "-"}`, margin, y, contentWidth, 6)
          y = addWrappedText(`Tipo: ${info.testType ?? "-"}`, margin, y, contentWidth, 6) + 6
        }
      }

      doc.save(`Experimento_${experiment.number}_${experiment.strain.replace(/\s+/g, "_")}.pdf`)
      toast({ title: "PDF exportado", description: `Experimento #${experiment.number} exportado com sucesso.` })
    } catch (error) {
      console.error(error)
      toast({ title: "Erro ao exportar PDF", description: "Tente novamente.", variant: "destructive" })
    } finally {
      setIsExporting(false)
    }
  }

  // Deletar (Supabase)
  const handleDeleteExperiment = async () => {
    if (!experimentToDelete) return
    try {
      const supabase = createClient()
      await deleteExperiment(supabase, experimentToDelete.id)

      setExperiments((prev) => prev.filter((e) => e.id !== experimentToDelete.id))
      toast({
        title: "Experimento excluído",
        description: `O experimento #${experimentToDelete.number} foi excluído com sucesso.`,
      })
    } catch (error) {
      console.error(error)
      toast({ title: "Erro", description: "Ocorreu um erro ao excluir o experimento.", variant: "destructive" })
    } finally {
      setShowDeleteDialog(false)
      setExperimentToDelete(null)
    }
  }

  return (
    <div className="container mx-auto p-4 overflow-x-hidden">
      <PageTitle title="Experimentos" />

      <div className="mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row gap-2 items-center">
                <Select value={selectedExperimentId} onValueChange={setSelectedExperimentId}>
                  <SelectTrigger className="w-full sm:w-[250px]">
                    <SelectValue placeholder="Selecione um experimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {experiments.map((exp) => (
                      <SelectItem key={exp.id} value={exp.id}>
                        #{exp.number} - {exp.strain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPeriodMode("week")}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Semanas
                  </Button>
                  <Button variant="outline" onClick={() => setPeriodMode("month")}>
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Meses
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={exportToPDF} disabled={isExporting}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
                <Button asChild>
                  <Link href="/experiments/new">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Novo
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {Object.entries(groupedExperiments).map(([periodTitle, exps]) => (
        <PeriodGroup key={periodTitle} title={periodTitle}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {exps.map((experiment) => (
              <Card
                key={experiment.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/experiments/${experiment.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") router.push(`/experiments/${experiment.id}`)
                }}
                className={`${getCardBackground("default")} ${getCardBorder(
                  "default",
                )} cursor-pointer transition-transform hover:scale-[1.01]`}
              >
                <CardHeader>
                  <CardTitle>Experimento #{experiment.number}</CardTitle>
                  <CardDescription>{experiment.strain}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-2">
                  <div className="text-sm">
                    <strong>Início:</strong> {new Date(experiment.startDate).toLocaleDateString("pt-BR")}
                  </div>
                  <div className="text-sm">
                    <strong>Testes:</strong> {experiment.testCount} | <strong>Repetições:</strong>{" "}
                    {experiment.repetitionCount}
                  </div>
                  <div className="text-sm">
                    <strong>Total:</strong> {experiment.totalTests}
                  </div>
                </CardContent>

                <div className="px-6 pb-6 flex justify-end">
                  <Button
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExperimentToDelete(experiment)
                      setShowDeleteDialog(true)
                    }}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </PeriodGroup>
      ))}

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir experimento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o experimento #{experimentToDelete?.number}? Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteExperiment}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
