"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BarChart3,
  CalendarDays,
  Download,
  FlaskConical,
  ImageIcon,
  MapPin,
  PlusCircle,
  Search,
  Sparkles,
  TestTube,
  RotateCcw,
  Trash,
} from "lucide-react"

import { PageTitle } from "@/components/page-title"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { cancelExperiment, getTestsByExperiment, restoreExperiment, type Test as DbTest } from "@/lib/supabase/experiments"
import type { ExperimentUnitFilter, UIExperiment } from "@/app/(app)/experiments/page"

type PeriodMode = "week" | "month"
type ExperimentStatusFilter = "all" | "Pendente" | "Inserir Fotos" | "Em andamento" | "Concluído" | "Cancelado"
type ExperimentStatus = Exclude<ExperimentStatusFilter, "all">

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
    photos7Day?: string[]
    photos14Day?: string[]
  }
>

type GroupedExperiments = Array<{
  key: string
  title: string
  subtitle: string
  sortValue: number
  experiments: UIExperiment[]
}>

const UNIT_FILTERS: ExperimentUnitFilter[] = ["Salto", "Americana"]

const STATUS_FILTERS: Array<{ value: ExperimentStatusFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "Pendente", label: "Pendentes" },
  { value: "Inserir Fotos", label: "Inserir fotos" },
  { value: "Em andamento", label: "Em andamento" },
  { value: "Concluído", label: "Concluídos" },
  { value: "Cancelado", label: "Cancelados" },
]

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null

  const text = String(value)
  const [year, month, day] = text.slice(0, 10).split("-").map(Number)

  if (year && month && day) return new Date(year, month - 1, day)

  const fallback = new Date(text)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function formatDateBR(value: string | null | undefined): string {
  const date = parseDate(value)
  if (!date) return "--/--/--"
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

function getWeekNumber(date: Date): number {
  const target = new Date(date.valueOf())
  const dayNr = (date.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7))
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
}

function getPeriodInfo(experiment: UIExperiment, mode: PeriodMode) {
  const date = parseDate(experiment.startDate) ?? new Date(0)
  const year = date.getFullYear()

  if (mode === "week") {
    const week = getWeekNumber(date)
    return {
      key: `${year}-W${String(week).padStart(2, "0")}`,
      title: `Semana ${week} • ${year}`,
      subtitle: "Agrupado pela data de criação do experimento",
      sortValue: year * 100 + week,
    }
  }

  const monthName = date.toLocaleDateString("pt-BR", { month: "long" })
  return {
    key: `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    title: `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} • ${year}`,
    subtitle: "Agrupado pela data de criação do experimento",
    sortValue: year * 100 + date.getMonth() + 1,
  }
}

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

function normalizeUnit(value: string | undefined): ExperimentUnitFilter | null {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return null
  if (normalized.includes("salto")) return "Salto"
  if (normalized.includes("americana")) return "Americana"
  return null
}

function getExperimentStatus(experiment: UIExperiment): ExperimentStatus {
  if (experiment.status === "canceled") return "Cancelado"
  if (experiment.totalTests > 0 && experiment.completedTests === experiment.totalTests) return "Concluído"
  if (experiment.inProgressTests > 0) return "Em andamento"
  if (experiment.needsPhotosTests > 0) return "Inserir Fotos"
  return "Pendente"
}

function statusClasses(status: ExperimentStatus) {
  if (status === "Concluído") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "Em andamento") return "border-blue-200 bg-blue-50 text-blue-700"
  if (status === "Inserir Fotos") return "border-amber-200 bg-amber-50 text-amber-700"
  if (status === "Cancelado") return "border-red-200 bg-red-50 text-red-700"
  return "border-slate-200 bg-slate-50 text-slate-700"
}

function statusDotClasses(status: ExperimentStatus) {
  if (status === "Concluído") return "bg-emerald-500"
  if (status === "Em andamento") return "bg-blue-500"
  if (status === "Inserir Fotos") return "bg-amber-500"
  if (status === "Cancelado") return "bg-red-500"
  return "bg-slate-400"
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className={
        active
          ? "h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-3 text-xs font-semibold text-white shadow-sm hover:from-blue-700 hover:to-purple-700"
          : "h-8 rounded-full border-slate-200 bg-white/80 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      }
    >
      {children}
    </Button>
  )
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
      <div className="text-xs text-blue-100">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {detail ? <div className="mt-0.5 text-[11px] text-blue-100/90">{detail}</div> : null}
    </div>
  )
}

export function ExperimentsPageClient({ initialExperiments, isAdmin = false }: { initialExperiments: UIExperiment[]; isAdmin?: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [experiments, setExperiments] = useState<UIExperiment[]>(initialExperiments)
  const [periodMode, setPeriodMode] = useState<PeriodMode>("week")
  const [unitFilter, setUnitFilter] = useState<ExperimentUnitFilter | "all">("all")
  const [statusFilter, setStatusFilter] = useState<ExperimentStatusFilter>("all")
  const [selectedExperimentId, setSelectedExperimentId] = useState<string>("")
  const [isExporting, setIsExporting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [experimentToDelete, setExperimentToDelete] = useState<UIExperiment | null>(null)

  useEffect(() => {
    setExperiments(initialExperiments)
  }, [initialExperiments])

  const stats = useMemo(() => {
    const total = experiments.length
    const totalTests = experiments.reduce((sum, experiment) => sum + experiment.totalTests, 0)
    const completedTests = experiments.reduce((sum, experiment) => sum + experiment.completedTests, 0)
    const inProgressTests = experiments.reduce((sum, experiment) => sum + experiment.inProgressTests, 0)
    const activeProgressAvg = total > 0 ? Math.round(experiments.reduce((sum, experiment) => sum + experiment.progressActivePct, 0) / total) : 0

    return { total, totalTests, completedTests, inProgressTests, activeProgressAvg }
  }, [experiments])

  const filteredExperiments = useMemo(() => {
    return experiments.filter((experiment) => {
      if (unitFilter !== "all" && !(experiment.units ?? []).some((unit) => normalizeUnit(unit) === unitFilter)) return false
      if (statusFilter !== "all" && getExperimentStatus(experiment) !== statusFilter) return false
      return true
    })
  }, [experiments, statusFilter, unitFilter])

  const groupedExperiments = useMemo<GroupedExperiments>(() => {
    const groups = new Map<string, GroupedExperiments[number]>()

    for (const experiment of filteredExperiments) {
      const info = getPeriodInfo(experiment, periodMode)
      const existing = groups.get(info.key)
      if (existing) {
        existing.experiments.push(experiment)
      } else {
        groups.set(info.key, { ...info, experiments: [experiment] })
      }
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        experiments: [...group.experiments].sort((a, b) => Number(b.number) - Number(a.number)),
      }))
      .sort((a, b) => b.sortValue - a.sortValue)
  }, [filteredExperiments, periodMode])

  const activeUnitLabel = unitFilter === "all" ? "Todas as unidades" : unitFilter
  const activeStatusLabel = STATUS_FILTERS.find((item) => item.value === statusFilter)?.label ?? "Todos"

  async function loadTestDataFromSupabase(experimentId: string) {
    const supabase = createClient()
    const tests = await getTestsByExperiment(supabase, experimentId)
    return testsToMap(tests ?? [])
  }

  async function exportToPDF() {
    if (!selectedExperimentId) {
      toast({
        title: "Nenhum experimento selecionado",
        description: "Selecione um experimento para exportar.",
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

      doc.setFontSize(18)
      doc.setFont("helvetica", "bold")
      let y = margin
      y = addWrappedText(`Relatório do Experimento #${experiment.number}`, margin, y, contentWidth, 8) + 10

      doc.setFontSize(12)
      doc.setFont("helvetica", "normal")
      y = addWrappedText(`Cepa: ${experiment.strain}`, margin, y, contentWidth, 6) + 4
      y = addWrappedText(`Data de criação: ${formatDateBR(experiment.startDate)}`, margin, y, contentWidth, 6) + 4
      y = addWrappedText(`Testes: ${experiment.testCount}`, margin, y, contentWidth, 6) + 4
      y = addWrappedText(`Repetições: ${experiment.repetitionCount}`, margin, y, contentWidth, 6) + 10

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
            y = addWrappedText("Status: Pendente", margin, y, contentWidth, 6) + 6
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

  async function handleDeleteExperiment() {
    if (!experimentToDelete) return

    try {
      const supabase = createClient()
      await cancelExperiment(supabase, experimentToDelete.id)
      setExperiments((prev) =>
        prev.map((experiment) =>
          experiment.id === experimentToDelete.id
            ? { ...experiment, status: "canceled", canceledAt: new Date().toISOString() }
            : experiment,
        ),
      )
      toast({
        title: "Experimento cancelado",
        description: `O experimento #${experimentToDelete.number} foi inativado sem apagar os dados.`,
      })
    } catch (error) {
      console.error(error)
      toast({ title: "Erro", description: "Ocorreu um erro ao cancelar o experimento.", variant: "destructive" })
    } finally {
      setShowDeleteDialog(false)
      setExperimentToDelete(null)
    }
  }

  async function handleRestoreExperiment(experiment: UIExperiment) {
    try {
      const supabase = createClient()
      await restoreExperiment(supabase, experiment.id)
      setExperiments((prev) =>
        prev.map((item) =>
          item.id === experiment.id
            ? { ...item, status: "active", canceledAt: null }
            : item,
        ),
      )
      toast({
        title: "Experimento reativado",
        description: `O experimento #${experiment.number} voltou para edição e andamento.`,
      })
    } catch (error) {
      console.error(error)
      toast({ title: "Erro", description: "Ocorreu um erro ao reativar o experimento.", variant: "destructive" })
    }
  }

  return (
    <div className="w-full overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8">
      <PageTitle title="Experimentos" />

      <section className="mb-5 overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white shadow-lg">
        <div className="relative p-5 sm:p-6">
          <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-0 left-1/2 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
                <Sparkles className="h-3.5 w-3.5" />
                Central de experimentos do PDI
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Experimentos</h1>
                <p className="mt-1 max-w-2xl text-sm text-blue-50">
                  Acompanhe o andamento geral, filtre por período, unidade e status, e acesse rapidamente cada experimento.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[560px]">
              <StatCard label="Experimentos" value={stats.total} />
              <StatCard label="Testes" value={stats.totalTests} />
              <StatCard label="Concluídos" value={stats.completedTests} detail={`${stats.inProgressTests} em andamento`} />
              <StatCard label="Progresso médio" value={`${stats.activeProgressAvg}%`} />
            </div>
          </div>
        </div>
      </section>

      <Card className="mb-5 border-slate-200/80 bg-white/90 shadow-sm backdrop-blur">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" /> Período
              </span>
              <FilterButton active={periodMode === "week"} onClick={() => setPeriodMode("week")}>
                Semanas
              </FilterButton>
              <FilterButton active={periodMode === "month"} onClick={() => setPeriodMode("month")}>
                Meses
              </FilterButton>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <MapPin className="h-3.5 w-3.5" /> Unidade
              </span>
              <FilterButton active={unitFilter === "all"} onClick={() => setUnitFilter("all")}>
                Todas
              </FilterButton>
              {UNIT_FILTERS.map((unit) => (
                <FilterButton key={unit} active={unitFilter === unit} onClick={() => setUnitFilter(unit)}>
                  {unit}
                </FilterButton>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <BarChart3 className="h-3.5 w-3.5" /> Status
            </span>
            {STATUS_FILTERS.map((status) => (
              <FilterButton key={status.value} active={statusFilter === status.value} onClick={() => setStatusFilter(status.value)}>
                {status.label}
              </FilterButton>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <Search className="h-3.5 w-3.5" />
              Exibindo <strong>{filteredExperiments.length}</strong> de <strong>{experiments.length}</strong> experimentos • {activeUnitLabel} • {activeStatusLabel}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={selectedExperimentId} onValueChange={setSelectedExperimentId}>
                <SelectTrigger className="h-9 w-full rounded-xl border-slate-200 bg-white text-xs font-semibold sm:w-[280px]">
                  <SelectValue placeholder="Selecione para exportar" />
                </SelectTrigger>
                <SelectContent>
                  {experiments.map((experiment) => (
                    <SelectItem key={experiment.id} value={experiment.id}>
                      #{experiment.number} - {experiment.strain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={exportToPDF}
                disabled={isExporting}
                className="h-9 rounded-xl border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Exportar PDF
              </Button>

              <Button asChild size="sm" className="h-9 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-xs font-semibold text-white shadow-sm hover:from-blue-700 hover:to-purple-700">
                <Link href="/experiments/new">
                  <PlusCircle className="h-4 w-4" />
                  Novo
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {groupedExperiments.map((group) => (
          <section key={group.key} className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{group.title}</h2>
                <p className="text-xs text-slate-500">{group.subtitle}</p>
              </div>
              <Badge variant="outline" className="w-fit rounded-full border-slate-200 bg-white px-3 py-1 text-slate-600">
                {group.experiments.length} experimento{group.experiments.length === 1 ? "" : "s"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {group.experiments.map((experiment) => {
                const status = getExperimentStatus(experiment)

                return (
                  <Card
                    key={experiment.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/experiments/${experiment.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") router.push(`/experiments/${experiment.id}`)
                    }}
                    className={`group cursor-pointer overflow-hidden border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg ${experiment.status === "canceled" ? "opacity-75 grayscale" : ""}`}
                  >
                    <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600" />
                    <CardHeader className="space-y-3 p-4 pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="flex items-center gap-2 text-base text-slate-900">
                            <FlaskConical className="h-4 w-4 shrink-0 text-blue-600" />
                            <span className="truncate">Experimento #{experiment.number}</span>
                          </CardTitle>
                          <p className="mt-1 truncate text-base font-bold text-purple-700">{experiment.strain}</p>
                        </div>
                        <Badge className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold ${statusClasses(status)}`}>
                          <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${statusDotClasses(status)}`} />
                          {status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-2xl bg-slate-50 p-2">
                          <p className="text-slate-500">Testes</p>
                          <p className="font-bold text-slate-900">{experiment.testCount}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-2">
                          <p className="text-slate-500">Repetições</p>
                          <p className="font-bold text-slate-900">{experiment.repetitionCount}</p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 p-4 pt-2 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {(experiment.units ?? []).length > 0 ? (
                          (experiment.units ?? []).map((unit) => (
                            <Badge key={unit} variant="outline" className="rounded-full border-blue-200 bg-blue-50 text-blue-700">
                              {unit}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-500">
                            Sem unidade
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div className="rounded-2xl border border-slate-100 p-2">
                          <div className="flex items-center gap-1 text-slate-500">
                            <CalendarDays className="h-3.5 w-3.5" /> Criação
                          </div>
                          <div className="mt-1 font-semibold text-slate-800">{formatDateBR(experiment.startDate)}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-100 p-2">
                          <div className="flex items-center gap-1 text-slate-500">
                            <TestTube className="h-3.5 w-3.5" /> Total
                          </div>
                          <div className="mt-1 font-semibold text-slate-800">{experiment.totalTests} testes</div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-600">Progresso do experimento</span>
                          <span className="font-bold text-slate-800">{experiment.progressActivePct}%</span>
                        </div>
                        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          {experiment.progressCompletedPct > 0 ? (
                            <div className="h-full bg-emerald-500" style={{ width: `${experiment.progressCompletedPct}%` }} />
                          ) : null}
                          {experiment.progressInProgressPct > 0 ? (
                            <div className="h-full bg-blue-500" style={{ width: `${experiment.progressInProgressPct}%` }} />
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            {experiment.completedTests}/{experiment.totalTests} concluídos
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            {experiment.inProgressTests}/{experiment.totalTests} andamento
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            {experiment.needsPhotosTests}/{experiment.totalTests} fotos
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-slate-400" />
                            {experiment.pendingTests}/{experiment.totalTests} pendentes
                          </span>
                        </div>
                      </div>

                      {experiment.status === "canceled" ? (
                        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                          Experimento cancelado{experiment.canceledAt ? ` em ${formatDateBR(experiment.canceledAt)}` : ""}. Edição e andamento pausados.
                        </div>
                      ) : null}

                      <div className="flex gap-2 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 font-semibold text-white shadow-sm hover:from-blue-700 hover:to-purple-700"
                          onClick={(event) => {
                            event.stopPropagation()
                            router.push(`/experiments/${experiment.id}`)
                          }}
                        >
                          <ImageIcon className="mr-1.5 h-4 w-4" />
                          Abrir
                        </Button>
                        {experiment.status === "canceled" && isAdmin ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-emerald-200 bg-emerald-50 px-3 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleRestoreExperiment(experiment)
                            }}
                            title="Reativar experimento"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={experiment.status === "canceled"}
                            className="rounded-xl border-red-200 bg-red-50 px-3 text-red-700 hover:bg-red-100 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={(event) => {
                              event.stopPropagation()
                              setExperimentToDelete(experiment)
                              setShowDeleteDialog(true)
                            }}
                            title="Cancelar experimento"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {filteredExperiments.length === 0 ? (
        <Card className="mt-6 border-dashed border-slate-300 bg-slate-50/80">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="rounded-full bg-white p-4 shadow-sm">
              <FlaskConical className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Nenhum experimento encontrado</h3>
              <p className="mt-1 text-sm text-slate-500">Ajuste os filtros ou cadastre um novo experimento.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar experimento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar/inativar o experimento #{experimentToDelete?.number}? Os dados não serão apagados, mas a edição e o andamento dos testes ficarão pausados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteExperiment}>
              Cancelar experimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
