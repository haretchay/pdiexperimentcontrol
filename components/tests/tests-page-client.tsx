"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart3,
  CalendarDays,
  Clock3,
  Edit3,
  Eye,
  FlaskConical,
  ImageIcon,
  LockKeyhole,
  MapPin,
  Search,
  Sparkles,
  TestTube,
  TimerReset,
} from "lucide-react"

import { PageTitle } from "@/components/page-title"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { TestStatusFilter, TestUnitFilter, UITestRow } from "@/app/(app)/tests/page"

const STATUS_FILTERS: Array<{ value: TestStatusFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "Pendente", label: "Pendentes" },
  { value: "Inserir Fotos", label: "Inserir fotos" },
  { value: "Em andamento", label: "Em andamento" },
  { value: "Concluído", label: "Concluídos" },
]

const UNIT_FILTERS: TestUnitFilter[] = ["Salto", "Americana"]

type PeriodMode = "week" | "month"

type GroupedTests = Array<{
  key: string
  title: string
  subtitle: string
  sortValue: number
  tests: UITestRow[]
}>

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const text = String(value)
  const [year, month, day] = text.slice(0, 10).split("-").map(Number)
  if (!year || !month || !day) {
    const fallback = new Date(text)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }
  return new Date(year, month - 1, day)
}

function formatDateBR(value: string | null | undefined): string {
  const date = parseDate(value)
  if (!date) return "--/--/--"
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

function formatDateTimeBR(value: string | null | undefined): string {
  if (!value) return "--/--/--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return formatDateBR(value)
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
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

function getPeriodInfo(test: UITestRow, mode: PeriodMode) {
  const date = parseDate(test.startDate) ?? parseDate(test.createdAt) ?? new Date(0)
  const year = date.getFullYear()

  if (mode === "week") {
    const week = getWeekNumber(date)
    return {
      key: `${year}-W${String(week).padStart(2, "0")}`,
      title: `Semana ${week} • ${year}`,
      subtitle: "Agrupado pela data de início do experimento",
      sortValue: year * 100 + week,
    }
  }

  const monthName = date.toLocaleDateString("pt-BR", { month: "long" })
  return {
    key: `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    title: `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} • ${year}`,
    subtitle: "Agrupado pela data de início do experimento",
    sortValue: year * 100 + date.getMonth() + 1,
  }
}

function normalizeUnit(value: string | undefined): TestUnitFilter | null {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return null
  if (normalized.includes("salto")) return "Salto"
  if (normalized.includes("americana")) return "Americana"
  return null
}

function statusClasses(status: UITestRow["status"]) {
  if (status === "Concluído") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "Em andamento") return "border-blue-200 bg-blue-50 text-blue-700"
  if (status === "Inserir Fotos") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-slate-200 bg-slate-50 text-slate-700"
}

function statusDotClasses(status: UITestRow["status"]) {
  if (status === "Concluído") return "bg-emerald-500"
  if (status === "Em andamento") return "bg-blue-500"
  if (status === "Inserir Fotos") return "bg-amber-500"
  return "bg-slate-400"
}

function progressClasses(status: UITestRow["status"]) {
  if (status === "Concluído") return "bg-emerald-500"
  if (status === "Em andamento") return "bg-blue-500"
  if (status === "Inserir Fotos") return "bg-amber-500"
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

export function TestsPageClient({ initialTests }: { initialTests: UITestRow[] }) {
  const router = useRouter()
  const [periodMode, setPeriodMode] = useState<PeriodMode>("week")
  const [unitFilter, setUnitFilter] = useState<TestUnitFilter | "all">("all")
  const [statusFilter, setStatusFilter] = useState<TestStatusFilter>("all")

  const stats = useMemo(() => {
    const total = initialTests.length
    const completed = initialTests.filter((test) => test.status === "Concluído").length
    const inProgress = initialTests.filter((test) => test.status === "Em andamento").length
    const dataAvg = total > 0 ? Math.round(initialTests.reduce((sum, test) => sum + test.dataProgressPct, 0) / total) : 0

    return { total, completed, inProgress, dataAvg }
  }, [initialTests])

  const filteredTests = useMemo(() => {
    return initialTests.filter((test) => {
      if (unitFilter !== "all" && normalizeUnit(test.unit) !== unitFilter) return false
      if (statusFilter !== "all" && test.status !== statusFilter) return false
      return true
    })
  }, [initialTests, statusFilter, unitFilter])

  const groupedTests = useMemo<GroupedTests>(() => {
    const groups = new Map<string, GroupedTests[number]>()

    for (const test of filteredTests) {
      const info = getPeriodInfo(test, periodMode)
      const existing = groups.get(info.key)
      if (existing) {
        existing.tests.push(test)
      } else {
        groups.set(info.key, { ...info, tests: [test] })
      }
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        tests: [...group.tests].sort((a, b) => {
          const expDiff = Number(b.experimentNumber) - Number(a.experimentNumber)
          if (expDiff !== 0) return expDiff
          if (a.repetitionNumber !== b.repetitionNumber) return a.repetitionNumber - b.repetitionNumber
          return a.testNumber - b.testNumber
        }),
      }))
      .sort((a, b) => b.sortValue - a.sortValue)
  }, [filteredTests, periodMode])

  const activeUnitLabel = unitFilter === "all" ? "Todas as unidades" : unitFilter
  const activeStatusLabel = STATUS_FILTERS.find((item) => item.value === statusFilter)?.label ?? "Todos"

  return (
    <div className="w-full overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8">
      <PageTitle title="Testes" />

      <section className="mb-5 overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white shadow-lg">
        <div className="relative p-5 sm:p-6">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-0 left-1/2 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
                <Sparkles className="h-3.5 w-3.5" />
                Central de acompanhamento dos testes
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Testes do PDI</h1>
                <p className="mt-1 max-w-2xl text-sm text-blue-50">
                  Visualize rapidamente o andamento, filtre por período, unidade e status, e acesse a edição ou visualização de cada teste.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[520px]">
              <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                <div className="text-xs text-blue-100">Total</div>
                <div className="mt-1 text-2xl font-bold">{stats.total}</div>
              </div>
              <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                <div className="text-xs text-blue-100">Concluídos</div>
                <div className="mt-1 text-2xl font-bold">{stats.completed}</div>
              </div>
              <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                <div className="text-xs text-blue-100">Em andamento</div>
                <div className="mt-1 text-2xl font-bold">{stats.inProgress}</div>
              </div>
              <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                <div className="text-xs text-blue-100">Dados médios</div>
                <div className="mt-1 text-2xl font-bold">{stats.dataAvg}%</div>
              </div>
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

          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Search className="h-3.5 w-3.5" />
            Exibindo <strong>{filteredTests.length}</strong> de <strong>{initialTests.length}</strong> testes • {activeUnitLabel} • {activeStatusLabel}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {groupedTests.map((group) => (
          <section key={group.key} className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{group.title}</h2>
                <p className="text-xs text-slate-500">{group.subtitle}</p>
              </div>
              <Badge variant="outline" className="w-fit rounded-full border-slate-200 bg-white px-3 py-1 text-slate-600">
                {group.tests.length} teste{group.tests.length === 1 ? "" : "s"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {group.tests.map((test) => (
                <Card
                  key={test.id}
                  role="button"
                  tabIndex={test.isRepetitionLocked ? -1 : 0}
                  aria-disabled={test.isRepetitionLocked}
                  onClick={() => {
                    if (!test.isRepetitionLocked) router.push(test.viewHref)
                  }}
                  onKeyDown={(event) => {
                    if (!test.isRepetitionLocked && (event.key === "Enter" || event.key === " ")) router.push(test.viewHref)
                  }}
                  className={`group relative overflow-hidden border-slate-200 bg-white shadow-sm transition-all duration-200 ${
                    test.isRepetitionLocked
                      ? "cursor-not-allowed border-slate-200/80 bg-slate-50/90"
                      : "cursor-pointer hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"
                  }`}
                >
                  <div
                    className={`h-1.5 ${
                      test.isRepetitionLocked ? "bg-slate-300" : "bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"
                    }`}
                  />
                  {test.isRepetitionLocked && (
                    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/55 backdrop-blur-[1.5px]">
                      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-center shadow-sm">
                        <LockKeyhole className="mb-1 h-6 w-6 text-slate-500" />
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Repetição bloqueada</p>
                        <p className="mt-0.5 max-w-[190px] text-[11px] text-slate-500">Conclua a repetição anterior para liberar este teste.</p>
                      </div>
                    </div>
                  )}
                  <div className={test.isRepetitionLocked ? "select-none opacity-45 grayscale" : undefined}>
                  <CardHeader className="space-y-3 p-4 pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="flex items-center gap-2 text-base text-slate-900">
                          <FlaskConical className="h-4 w-4 shrink-0 text-blue-600" />
                          <span className="truncate">Exp. #{test.experimentNumber}</span>
                        </CardTitle>
                        <p className="mt-1 truncate text-sm font-semibold text-purple-700">{test.experimentStrain}</p>
                      </div>
                      <Badge className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold ${statusClasses(test.status)}`}>
                        <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${statusDotClasses(test.status)}`} />
                        {test.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-2xl bg-slate-50 p-2">
                        <p className="text-slate-500">Repetição</p>
                        <p className="font-bold text-slate-900">{test.repetitionNumber}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-2">
                        <p className="text-slate-500">Teste</p>
                        <p className="font-bold text-slate-900">{test.testNumber}</p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 p-4 pt-2 text-sm">
                    <div className="flex flex-wrap gap-2">
                      {test.testType ? <Badge variant="secondary" className="rounded-full">{test.testType}</Badge> : null}
                      {test.unit ? <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 text-blue-700">{test.unit}</Badge> : null}
                      {test.requisition ? <Badge variant="outline" className="rounded-full">Req. {test.requisition}</Badge> : null}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div className="rounded-2xl border border-slate-100 p-2">
                        <div className="flex items-center gap-1 text-slate-500">
                          <CalendarDays className="h-3.5 w-3.5" /> Início
                        </div>
                        <div className="mt-1 font-semibold text-slate-800">{formatDateBR(test.startDate)}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-100 p-2">
                        <div className="flex items-center gap-1 text-slate-500">
                          <ImageIcon className="h-3.5 w-3.5" /> Fotos
                        </div>
                        <div className="mt-1 font-semibold text-slate-800">7º: {test.photos7Count} • 14º: {test.photos14Count}</div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600">Dados preenchidos</span>
                        <span className="font-bold text-slate-800">
                          {test.dataProgressPct}% <span className="font-medium text-slate-400">({test.filledFields}/{test.requiredFields})</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${progressClasses(test.status)}`} style={{ width: `${test.dataProgressPct}%` }} />
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-2 text-xs text-slate-500">
                      Última referência: {formatDateTimeBR(test.date14Day ?? test.date7Day ?? test.createdAt)}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        disabled={test.isRepetitionLocked}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!test.isRepetitionLocked) router.push(test.viewHref)
                        }}
                      >
                        <Eye className="mr-1.5 h-4 w-4" />
                        Ver
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 font-semibold text-white shadow-sm hover:from-blue-700 hover:to-purple-700"
                        disabled={test.isRepetitionLocked}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!test.isRepetitionLocked) router.push(test.editHref)
                        }}
                      >
                        <Edit3 className="mr-1.5 h-4 w-4" />
                        Editar
                      </Button>
                    </div>
                  </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      {filteredTests.length === 0 && (
        <Card className="mt-6 border-dashed border-slate-300 bg-slate-50/80">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="rounded-full bg-white p-4 shadow-sm">
              <TestTube className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Nenhum teste encontrado</h3>
              <p className="mt-1 text-sm text-slate-500">Ajuste os filtros ou cadastre novos experimentos para visualizar os testes.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
