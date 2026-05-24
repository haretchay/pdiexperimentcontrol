"use client"

import Link from "next/link"
import type { ComponentType } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FlaskConical,
  ImageIcon,
  Layers3,
  Microscope,
  Plus,
  TestTube2,
  Thermometer,
  TrendingUp,
} from "lucide-react"

import { PageTitle } from "@/components/page-title"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { TestStatus, UIDashboardExperiment, UIDashboardTest } from "@/app/(app)/dashboard/page"

type DashboardClientProps = {
  experiments: UIDashboardExperiment[]
}

type StatCardProps = {
  title: string
  value: string | number
  description: string
  icon: ComponentType<{ className?: string }>
  tone: "blue" | "purple" | "green" | "amber"
}

const STATUS_ORDER: TestStatus[] = ["Concluído", "Em andamento", "Inserir Fotos", "Pendente"]
const STATUS_COLORS: Record<TestStatus, string> = {
  Concluído: "#10b981",
  "Em andamento": "#2563eb",
  "Inserir Fotos": "#f59e0b",
  Pendente: "#64748b",
}

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

function formatDateTimeBR(value: string | null | undefined): string {
  if (!value) return "--/--/--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return formatDateBR(value)
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function expLabel(number: number): string {
  return `Exp. #${String(number).padStart(3, "0")}`
}

function average(values: Array<number | undefined>): number | undefined {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (valid.length === 0) return undefined
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10
}

function percent(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)))
}

function StatCard({ title, value, description, icon: Icon, tone }: StatCardProps) {
  const toneClass = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    purple: "border-purple-100 bg-purple-50 text-purple-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
  }[tone]

  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-950/70">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{title}</p>
          <div className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</div>
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-2 font-semibold text-slate-900 dark:text-slate-100">{label}</div>
      <div className="space-y-1">
        {payload.map((entry: any) => (
          <div key={entry.dataKey ?? entry.name} className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300">
            <span>{entry.name ?? entry.dataKey}</span>
            <span className="font-semibold text-slate-950 dark:text-white">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardClient({ experiments }: DashboardClientProps) {
  const allTests = experiments.flatMap((experiment) => experiment.testsData)
  const totalTests = allTests.length
  const completedTests = allTests.filter((test) => test.status === "Concluído").length
  const inProgressTests = allTests.filter((test) => test.status === "Em andamento").length
  const insertPhotosTests = allTests.filter((test) => test.status === "Inserir Fotos").length
  const pendingTests = allTests.filter((test) => test.status === "Pendente").length
  const avgDataProgress = totalTests > 0 ? Math.round(allTests.reduce((sum, test) => sum + test.dataProgressPct, 0) / totalTests) : 0
  const avgMediaProgress =
    experiments.length > 0 ? Math.round(experiments.reduce((sum, experiment) => sum + experiment.mediaProgressPct, 0) / experiments.length) : 0
  const avgChamberTemperature = average(allTests.map((test) => test.chamberTemperatureAvg))
  const avgRiceTemperature = average(allTests.map((test) => test.riceTemperatureAvg))
  const latestExperiment = [...experiments].sort((a, b) => b.number - a.number)[0]

  const statusData = STATUS_ORDER.map((status) => ({
    name: status,
    value: allTests.filter((test) => test.status === status).length,
    color: STATUS_COLORS[status],
  })).filter((item) => item.value > 0)

  const progressByExperiment = [...experiments]
    .sort((a, b) => b.number - a.number)
    .slice(0, 8)
    .reverse()
    .map((experiment) => ({
      name: expLabel(experiment.number),
      Concluídos: experiment.completedTests,
      "Em andamento": experiment.inProgressTests,
      "Inserir fotos": experiment.insertPhotosTests,
      Pendentes: experiment.pendingTests,
      progresso: percent(experiment.completedTests, experiment.totalTests),
    }))

  const temperatureByExperiment = [...experiments]
    .sort((a, b) => b.number - a.number)
    .slice(0, 8)
    .reverse()
    .map((experiment) => ({
      name: expLabel(experiment.number),
      Câmara: average(experiment.testsData.map((test) => test.chamberTemperatureAvg)),
      Arroz: average(experiment.testsData.map((test) => test.riceTemperatureAvg)),
    }))

  const strainData = Object.values(
    experiments.reduce<Record<string, { strain: string; experimentos: number; testes: number; concluidos: number; progresso: number }>>(
      (acc, experiment) => {
        const strain = experiment.strain || "Sem cepa"
        if (!acc[strain]) acc[strain] = { strain, experimentos: 0, testes: 0, concluidos: 0, progresso: 0 }
        acc[strain].experimentos += 1
        acc[strain].testes += experiment.totalTests
        acc[strain].concluidos += experiment.completedTests
        acc[strain].progresso = percent(acc[strain].concluidos, acc[strain].testes)
        return acc
      },
      {},
    ),
  ).sort((a, b) => b.testes - a.testes)

  const weightByStrain = Object.values(
    allTests.reduce<Record<string, { strain: string; umido: number[]; seco: number[]; conidio: number[] }>>((acc, test) => {
      const strain = test.experimentStrain || "Sem cepa"
      if (!acc[strain]) acc[strain] = { strain, umido: [], seco: [], conidio: [] }
      if (typeof test.wetWeight === "number") acc[strain].umido.push(test.wetWeight)
      if (typeof test.dryWeight === "number") acc[strain].seco.push(test.dryWeight)
      if (typeof test.extractedConidiumWeight === "number") acc[strain].conidio.push(test.extractedConidiumWeight)
      return acc
    }, {}),
  )
    .map((item) => ({
      strain: item.strain,
      "Úmido": average(item.umido),
      "Seco": average(item.seco),
      "Conídio": average(item.conidio),
    }))
    .filter((item) => item["Úmido"] !== undefined || item["Seco"] !== undefined || item["Conídio"] !== undefined)
    .slice(0, 8)

  const recentTests = [...allTests]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6)

  return (
    <div className="w-full overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8">
      <PageTitle title="Dashboard" />

      <section className="mb-5 overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white shadow-lg">
        <div className="relative p-5 sm:p-6">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-0 left-1/2 h-36 w-36 rounded-full bg-cyan-300/20 blur-2xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
                <Activity className="h-3.5 w-3.5" />
                Visão geral operacional do PDI
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
                <p className="mt-1 text-sm text-blue-50">
                  Acompanhe experimentos, testes, mídias, temperaturas e resultados finais com dados atuais do sistema.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="rounded-2xl bg-white text-blue-700 shadow-sm hover:bg-blue-50">
                <Link href="/experiments/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo experimento
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-2xl border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <Link href="/tests">Ver testes</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {experiments.length === 0 ? (
        <Card className="border-dashed bg-white/80 shadow-sm dark:bg-slate-950/60">
          <CardHeader>
            <CardTitle>Nenhum dado disponível</CardTitle>
            <CardDescription>Crie um experimento para começar a visualizar estatísticas.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Experimentos" value={experiments.length} description={`${totalTests} teste(s) cadastrados`} icon={FlaskConical} tone="blue" />
            <StatCard title="Concluídos" value={`${percent(completedTests, totalTests)}%`} description={`${completedTests} de ${totalTests} teste(s)`} icon={CheckCircle2} tone="green" />
            <StatCard title="Dados médios" value={`${avgDataProgress}%`} description={`Mídias completas em média: ${avgMediaProgress}%`} icon={BarChart3} tone="purple" />
            <StatCard
              title="Temperaturas"
              value={avgChamberTemperature !== undefined ? `${avgChamberTemperature.toFixed(1)} ºC` : "--"}
              description={avgRiceTemperature !== undefined ? `Arroz médio: ${avgRiceTemperature.toFixed(1)} ºC` : "Sem dados de arroz"}
              icon={Thermometer}
              tone="amber"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <Card className="xl:col-span-8 border-slate-200/80 bg-white/90 shadow-sm dark:bg-slate-950/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Layers3 className="h-5 w-5 text-blue-600" />
                  Progresso dos últimos experimentos
                </CardTitle>
                <CardDescription>Status dos testes por experimento.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={progressByExperiment} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="Concluídos" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                      <Bar dataKey="Em andamento" stackId="a" fill="#2563eb" />
                      <Bar dataKey="Inserir fotos" stackId="a" fill="#f59e0b" />
                      <Bar dataKey="Pendentes" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-4 border-slate-200/80 bg-white/90 shadow-sm dark:bg-slate-950/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TestTube2 className="h-5 w-5 text-purple-600" />
                  Situação dos testes
                </CardTitle>
                <CardDescription>Distribuição atual por status.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3}>
                        {statusData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {STATUS_ORDER.map((status) => (
                    <div key={status} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-800">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                      <span className="truncate text-slate-600 dark:text-slate-300">{status}</span>
                      <span className="ml-auto font-semibold">{allTests.filter((test) => test.status === status).length}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <Card className="xl:col-span-7 border-slate-200/80 bg-white/90 shadow-sm dark:bg-slate-950/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Thermometer className="h-5 w-5 text-blue-600" />
                  Temperaturas por experimento
                </CardTitle>
                <CardDescription>Média dos 14 dias de câmara e arroz por experimento.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={temperatureByExperiment} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} unit="º" />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="Câmara" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} connectNulls />
                      <Line type="monotone" dataKey="Arroz" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-5 border-slate-200/80 bg-white/90 shadow-sm dark:bg-slate-950/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Microscope className="h-5 w-5 text-emerald-600" />
                  Resultados finais por cepa
                </CardTitle>
                <CardDescription>Médias de peso úmido, seco e conídio extraído.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weightByStrain} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="strain" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="Úmido" stroke="#2563eb" fill="#2563eb" fillOpacity={0.12} connectNulls />
                      <Area type="monotone" dataKey="Seco" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.12} connectNulls />
                      <Area type="monotone" dataKey="Conídio" stroke="#10b981" fill="#10b981" fillOpacity={0.12} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <Card className="xl:col-span-7 border-slate-200/80 bg-white/90 shadow-sm dark:bg-slate-950/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  Cepas em acompanhamento
                </CardTitle>
                <CardDescription>Volume de testes e avanço por cepa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {strainData.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados suficientes para listar cepas.</p>
                ) : (
                  strainData.slice(0, 8).map((item) => (
                    <div key={item.strain} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-950 dark:text-white">{item.strain}</div>
                          <div className="text-xs text-slate-500">
                            {item.experimentos} experimento(s) • {item.concluidos} de {item.testes} teste(s) concluídos
                          </div>
                        </div>
                        <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">{item.progresso}%</Badge>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${item.progresso}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-5 border-slate-200/80 bg-white/90 shadow-sm dark:bg-slate-950/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock3 className="h-5 w-5 text-blue-600" />
                  Atividades recentes
                </CardTitle>
                <CardDescription>Últimos testes alterados no sistema.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentTests.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhuma atividade recente.</p>
                  ) : (
                    recentTests.map((test) => (
                      <Link
                        key={test.id}
                        href={test.viewHref}
                        className="block rounded-2xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-blue-950/20"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                              {expLabel(test.experimentNumber)} • Rep. {test.repetitionNumber} • Teste {test.testNumber}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {test.experimentStrain} • {formatDateTimeBR(test.updatedAt)}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="shrink-0"
                            style={{ borderColor: STATUS_COLORS[test.status], color: STATUS_COLORS[test.status] }}
                          >
                            {test.status}
                          </Badge>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="border-slate-200/80 bg-white/90 shadow-sm dark:bg-slate-950/70">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-700 dark:bg-blue-950/30">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Último experimento</div>
                  <div className="mt-1 font-semibold">{latestExperiment ? `${expLabel(latestExperiment.number)} • ${formatDateBR(latestExperiment.startDate)}` : "--"}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200/80 bg-white/90 shadow-sm dark:bg-slate-950/70">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/30">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Fotos completas</div>
                  <div className="mt-1 font-semibold">{avgMediaProgress}% em média por experimento</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200/80 bg-white/90 shadow-sm dark:bg-slate-950/70">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-2xl bg-amber-50 p-3 text-amber-700 dark:bg-amber-950/30">
                  <FlaskConical className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Em atenção</div>
                  <div className="mt-1 font-semibold">{pendingTests + insertPhotosTests} teste(s) pendente(s) ou sem fotos</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
