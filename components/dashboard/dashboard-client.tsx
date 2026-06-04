"use client"

import { useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageTitle } from "@/components/page-title"
import {
  Activity,
  BarChart3,
  Gauge,
  Leaf,
  Microscope,
  PackageCheck,
  Thermometer,
  TrendingUp,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts"

type UIExperiment = {
  id: string
  number: number
  strain: string
  fungusId: string | null
  fungusName: string
  startDate: string
  testCount: number
  repetitionCount: number
  totalTests: number
}

type FungusInfo = {
  id: string
  scientificName: string
  optimalTemperature: number | null
  minTemperature: number | null
  maxTemperature: number | null
}

type TemperatureDay = {
  day: number
  chamber?: number
  rice?: number
}

type UITest = {
  id: string
  repetitionNumber?: number
  testNumber?: number
  status?: "Pendente" | "Inserir Fotos" | "Em andamento" | "Concluído"
  unit?: string
  wetWeight?: number
  dryWeight?: number
  extractedConidiumWeight?: number
  averageHumidity?: number
  bozo?: number
  sensorial?: number
  temperatureDays?: TemperatureDay[]
  avgRiceTemperature?: number
  avgChamberTemperature?: number
  createdAt?: string
}

type ExperimentData = {
  id: string
  number: number
  strain: string
  fungusId: string | null
  fungusName: string
  fungusOptimalTemperature: number | null
  fungusMinTemperature: number | null
  fungusMaxTemperature: number | null
  startDate: string
  testsData?: UITest[]
  completedTests: number
}

type ProductionMetric = "dry" | "conidium" | "wet"

interface DashboardClientProps {
  experiments: UIExperiment[]
  experimentData: ExperimentData[]
  fungi: FungusInfo[]
}

const METRIC_LABEL: Record<ProductionMetric, string> = {
  dry: "Pó seco",
  conidium: "Conídios",
  wet: "Pó úmido",
}

const METRIC_KEY: Record<ProductionMetric, "dryWeight" | "extractedConidiumWeight" | "wetWeight"> = {
  dry: "dryWeight",
  conidium: "extractedConidiumWeight",
  wet: "wetWeight",
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function average(values: Array<number | undefined | null>): number | undefined {
  const valid = values.filter(isNumber)
  if (valid.length === 0) return undefined
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function formatNumber(value: number | undefined | null, digits = 1): string {
  if (!isNumber(value)) return "-"
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function formatPercent(value: number | undefined | null): string {
  if (!isNumber(value)) return "-"
  return `${Math.round(value)}%`
}

function shortFungusName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`
}

function getMetricValue(test: UITest, metric: ProductionMetric): number | undefined {
  return test[METRIC_KEY[metric]]
}

function withinRange(value: number | undefined, min: number | null, max: number | null): boolean {
  if (!isNumber(value) || !isNumber(min) || !isNumber(max)) return false
  return value >= min && value <= max
}

function buildNumericDomain(values: Array<number | null | undefined>, padding: number): [number, number] {
  const valid = values.filter(isNumber)
  if (valid.length === 0) return [0, 1]

  const min = Math.min(...valid)
  const max = Math.max(...valid)

  if (min === max) return [Math.floor(min - padding), Math.ceil(max + padding)]

  return [Math.floor(min - padding), Math.ceil(max + padding)]
}

export function DashboardClient({ experiments, experimentData, fungi }: DashboardClientProps) {
  const firstFungusId = fungi[0]?.id ?? ""
  const [selectedFungusId, setSelectedFungusId] = useState<string>(firstFungusId)
  const [metric, setMetric] = useState<ProductionMetric>("dry")

  const selectedFungus = fungi.find((fungus) => fungus.id === selectedFungusId) ?? fungi[0] ?? null
  const selectedFungusKey = selectedFungus?.id ?? ""

  const filteredExperiments = useMemo(() => {
    if (!selectedFungusKey) return []
    return experimentData.filter((experiment) => experiment.fungusId === selectedFungusKey)
  }, [experimentData, selectedFungusKey])

  const testRows = useMemo(() => {
    return filteredExperiments.flatMap((experiment) =>
      (experiment.testsData ?? []).map((test) => ({
        ...test,
        experimentId: experiment.id,
        experimentNumber: experiment.number,
        strain: experiment.strain,
        fungusId: experiment.fungusId,
        fungusName: experiment.fungusName,
        fungusOptimalTemperature: experiment.fungusOptimalTemperature,
        fungusMinTemperature: experiment.fungusMinTemperature,
        fungusMaxTemperature: experiment.fungusMaxTemperature,
      })),
    )
  }, [filteredExperiments])

  const productionRows = testRows.filter(
    (test) => isNumber(test.wetWeight) || isNumber(test.dryWeight) || isNumber(test.extractedConidiumWeight),
  )

  const completedTests = testRows.filter((test) => test.status === "Concluído").length
  const totalTests = testRows.length
  const avgRiceTemp = average(testRows.map((test) => test.avgRiceTemperature))
  const avgChamberTemp = average(testRows.map((test) => test.avgChamberTemperature))
  const avgWet = average(productionRows.map((test) => test.wetWeight))
  const avgDry = average(productionRows.map((test) => test.dryWeight))
  const avgConidium = average(productionRows.map((test) => test.extractedConidiumWeight))
  const dryYield = isNumber(avgWet) && avgWet > 0 && isNumber(avgDry) ? (avgDry / avgWet) * 100 : undefined
  const conidiumByDry = isNumber(avgDry) && avgDry > 0 && isNumber(avgConidium) ? avgConidium / avgDry : undefined

  const fungusSummary = useMemo(() => buildFungusSummary(experimentData), [experimentData])
  const strainSummary = useMemo(() => buildStrainSummary(filteredExperiments), [filteredExperiments])
  const temperatureProductionRows = useMemo(() => buildTemperatureProductionRows(filteredExperiments, metric), [filteredExperiments, metric])
  const dailyTemperatureRows = useMemo(() => buildDailyTemperatureRows(filteredExperiments), [filteredExperiments])
  const productionByExperimentRows = useMemo(() => buildProductionByExperimentRows(filteredExperiments), [filteredExperiments])
  const statusRows = useMemo(() => buildStatusRows(testRows), [testRows])
  const thermalRange = useMemo(() => {
    const fromSelected = {
      min: selectedFungus?.minTemperature ?? null,
      max: selectedFungus?.maxTemperature ?? null,
      optimal: selectedFungus?.optimalTemperature ?? null,
    }

    if (isNumber(fromSelected.min) && isNumber(fromSelected.max)) return fromSelected

    const fromExperiment = filteredExperiments.find(
      (experiment) => isNumber(experiment.fungusMinTemperature) && isNumber(experiment.fungusMaxTemperature),
    )

    return {
      min: fromExperiment?.fungusMinTemperature ?? fromSelected.min,
      max: fromExperiment?.fungusMaxTemperature ?? fromSelected.max,
      optimal: fromExperiment?.fungusOptimalTemperature ?? fromSelected.optimal,
    }
  }, [filteredExperiments, selectedFungus])
  const scatterTemperatureDomain = useMemo(
    () =>
      buildNumericDomain(
        [
          ...temperatureProductionRows.map((row) => row.avgRiceTemperature),
          thermalRange.min,
          thermalRange.max,
          thermalRange.optimal,
        ],
        1,
      ),
    [temperatureProductionRows, thermalRange],
  )
  const dailyTemperatureDomain = useMemo(
    () =>
      buildNumericDomain(
        [
          ...dailyTemperatureRows.flatMap((row) => [row.rice, row.chamber]),
          thermalRange.min,
          thermalRange.max,
          thermalRange.optimal,
        ],
        2,
      ),
    [dailyTemperatureRows, thermalRange],
  )

  const mostProductiveStrain = strainSummary.reduce<(typeof strainSummary)[number] | null>((best, row) => {
    if (!best) return row
    return (row.avgDry ?? 0) > (best.avgDry ?? 0) ? row : best
  }, null)

  return (
    <div className="container mx-auto space-y-6 p-4">
      <PageTitle title="Dashboard" />

      <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white shadow-lg">
        <div className="p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white/90 ring-1 ring-white/20">
                <Microscope className="h-4 w-4" />
                Produção, produtividade e temperatura
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Dashboard PDI</h1>
                <p className="mt-2 max-w-3xl text-sm text-white/80 md:text-base">
                  Leitura alinhada por fungo: temperatura do arroz, faixa ideal cadastrada e resultado final de produção.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
              <HeaderStat label="Experimentos" value={filteredExperiments.length} />
              <HeaderStat label="Testes" value={totalTests} />
              <HeaderStat label="Com produção" value={productionRows.length} />
              <HeaderStat label="Concluídos" value={formatPercent(totalTests > 0 ? (completedTests / totalTests) * 100 : 0)} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Filtros de análise</h2>
            <p className="text-sm text-muted-foreground">
              Os gráficos usam o fungo selecionado para comparar temperatura, faixa ideal e produção.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {fungi.map((fungus) => (
              <Button
                key={fungus.id}
                type="button"
                size="sm"
                variant={selectedFungusKey === fungus.id ? "default" : "outline"}
                className={selectedFungusKey === fungus.id ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white" : ""}
                onClick={() => setSelectedFungusId(fungus.id)}
              >
                <span className="italic">{shortFungusName(fungus.scientificName)}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Métrica principal:</span>
            {(Object.keys(METRIC_LABEL) as ProductionMetric[]).map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={metric === item ? "default" : "outline"}
                className={metric === item ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white" : ""}
                onClick={() => setMetric(item)}
              >
                {METRIC_LABEL[item]}
              </Button>
            ))}
          </div>

          {selectedFungus ? (
            <div className="rounded-xl bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">Fungo visualizado: </span>
              <span className="font-medium italic">{selectedFungus.scientificName}</span>
              <span className="ml-2 text-muted-foreground">
                ótimo {formatNumber(thermalRange.optimal)} ºC · faixa {formatNumber(thermalRange.min)}–{formatNumber(thermalRange.max)} ºC
              </span>
            </div>
          ) : (
            <div className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
              Cadastre ou selecione um fungo para visualizar linha ótima e faixa térmica específica.
            </div>
          )}
        </div>
      </section>

      {experiments.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum dado disponível</CardTitle>
            <CardDescription>Adicione experimentos para iniciar as análises de produção e temperatura.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Pó úmido médio"
              value={formatNumber(avgWet)}
              description={`${productionRows.length} teste(s) com dado final`}
              icon={PackageCheck}
              tone="emerald"
            />
            <MetricCard
              title="Pó seco médio"
              value={formatNumber(avgDry)}
              description={isNumber(dryYield) ? `Rendimento seco/úmido: ${formatPercent(dryYield)}` : "Aguardando dados de úmido e seco"}
              icon={Leaf}
              tone="blue"
            />
            <MetricCard
              title="Conídios médio"
              value={formatNumber(avgConidium)}
              description={isNumber(conidiumByDry) ? `${formatNumber(conidiumByDry, 2)} por unidade de pó seco` : "Aguardando pó seco e conídios"}
              icon={Microscope}
              tone="purple"
            />
            <MetricCard
              title="Temperatura média do arroz"
              value={`${formatNumber(avgRiceTemp)} ºC`}
              description={`Câmara: ${formatNumber(avgChamberTemp)} ºC`}
              icon={Thermometer}
              tone="orange"
            />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    Temperatura do arroz x {METRIC_LABEL[metric]}
                  </CardTitle>
                  <Badge variant="outline">Por teste</Badge>
                </div>
                <CardDescription>
                  Cada ponto representa um teste. A temperatura usada é a média dos 14 dias do arroz.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 16, right: 28, bottom: 16, left: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        dataKey="avgRiceTemperature"
                        name="Temp. arroz"
                        unit=" ºC"
                        domain={scatterTemperatureDomain}
                      />
                      <YAxis type="number" dataKey="productionValue" name={METRIC_LABEL[metric]} />
                      <ZAxis type="number" dataKey="testNumber" range={[80, 220]} />
                      <Tooltip content={<TemperatureProductionTooltip metric={metric} />} />
                      {isNumber(thermalRange.min) && isNumber(thermalRange.max) ? (
                        <ReferenceArea
                          x1={thermalRange.min}
                          x2={thermalRange.max}
                          fill="#22c55e"
                          fillOpacity={0.08}
                        />
                      ) : null}
                      {isNumber(thermalRange.optimal) ? (
                        <ReferenceLine
                          x={thermalRange.optimal}
                          stroke="#16a34a"
                          strokeDasharray="5 5"
                          label={{ value: "ótima", position: "top" }}
                        />
                      ) : null}
                      <Scatter name="Testes" data={temperatureProductionRows} fill="#2563eb">
                        {temperatureProductionRows.map((entry, index) => (
                          <Cell
                            key={`cell-${entry.id}`}
                            fill={entry.withinRange ? "#16a34a" : index % 2 === 0 ? "#2563eb" : "#9333ea"}
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Thermometer className="h-5 w-5 text-orange-600" />
                  Perfil térmico médio
                </CardTitle>
                <CardDescription>Temperatura média por dia nos testes filtrados para o fungo selecionado.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dailyTemperatureRows} margin={{ top: 16, right: 20, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="dayLabel" />
                      <YAxis unit=" ºC" domain={dailyTemperatureDomain} />
                      <Tooltip content={<DailyTemperatureTooltip />} />
                      <Legend />
                      {isNumber(thermalRange.min) && isNumber(thermalRange.max) ? (
                        <ReferenceArea y1={thermalRange.min} y2={thermalRange.max} fill="#22c55e" fillOpacity={0.08} />
                      ) : null}
                      <Line type="monotone" dataKey="rice" name="Arroz" stroke="#f97316" strokeWidth={3} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="chamber" name="Câmara" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                      {isNumber(thermalRange.optimal) ? (
                        <ReferenceLine y={thermalRange.optimal} stroke="#16a34a" strokeDasharray="5 5" />
                      ) : null}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  O arroz é a principal referência por ser o substrato de crescimento do fungo. A câmara aparece como controle ambiental.
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  Produtividade por cepa
                </CardTitle>
                <CardDescription>Média por teste, agrupada por cepa dentro do filtro atual.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={strainSummary} margin={{ top: 14, right: 20, bottom: 28, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="strain" angle={-15} textAnchor="end" height={56} />
                      <YAxis />
                      <Tooltip content={<StrainTooltip />} />
                      <Legend />
                      <Bar dataKey="avgWet" name="Pó úmido" fill="#10b981" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="avgDry" name="Pó seco" fill="#2563eb" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="avgConidium" name="Conídios" fill="#9333ea" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Produção por experimento
                </CardTitle>
                <CardDescription>Resultado médio dos testes com produção registrada.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={productionByExperimentRows} margin={{ top: 14, right: 20, bottom: 24, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" unit=" ºC" />
                      <Tooltip content={<ExperimentProductionTooltip />} />
                      <Legend />
                      <Bar yAxisId="left" dataKey={METRIC_KEY[metric]} name={METRIC_LABEL[metric]} fill="#2563eb" radius={[6, 6, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="avgRiceTemperature" name="Temp. arroz" stroke="#f97316" strokeWidth={3} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle>Resumo por fungo</CardTitle>
                <CardDescription>Comparativo entre faixa térmica cadastrada, temperatura real e produção média.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-3 pr-4">Fungo</th>
                        <th className="py-3 pr-4">Faixa / ótima</th>
                        <th className="py-3 pr-4">Temp. arroz</th>
                        <th className="py-3 pr-4">Dentro da faixa</th>
                        <th className="py-3 pr-4">Pó seco méd.</th>
                        <th className="py-3 pr-4">Conídios méd.</th>
                        <th className="py-3 pr-0">Testes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fungusSummary.map((row) => (
                        <tr key={row.fungusId} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-medium italic">{row.fungusName}</td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {formatNumber(row.minTemperature)}–{formatNumber(row.maxTemperature)} ºC · ótima {formatNumber(row.optimalTemperature)} ºC
                          </td>
                          <td className="py-3 pr-4">{formatNumber(row.avgRiceTemperature)} ºC</td>
                          <td className="py-3 pr-4">
                            <Badge variant="outline" className={row.withinRangePct >= 70 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-orange-200 bg-orange-50 text-orange-700"}>
                              {formatPercent(row.withinRangePct)}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4">{formatNumber(row.avgDry)}</td>
                          <td className="py-3 pr-4">{formatNumber(row.avgConidium)}</td>
                          <td className="py-3 pr-0">{row.productionTests}/{row.totalTests}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Situação operacional</CardTitle>
                <CardDescription>Continua mostrando andamento, mas como apoio à leitura produtiva.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  {statusRows.map((row) => (
                    <div key={row.status} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{row.status}</span>
                        <span className="text-muted-foreground">{row.count} teste(s)</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={row.className} style={{ width: `${row.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border bg-muted/40 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                      <Gauge className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">Melhor cepa por pó seco</p>
                      <p className="text-sm text-muted-foreground">
                        {mostProductiveStrain
                          ? `${mostProductiveStrain.strain}: ${formatNumber(mostProductiveStrain.avgDry)} de pó seco médio em ${mostProductiveStrain.productionTests} teste(s).`
                          : "Aguardando dados de produção final."}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}

function HeaderStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white/12 p-3 ring-1 ring-white/20 backdrop-blur">
      <p className="text-xs uppercase tracking-wide text-white/70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: {
  title: string
  value: string | number
  description: string
  icon: typeof Microscope
  tone: "emerald" | "blue" | "purple" | "orange"
}) {
  const toneClasses = {
    emerald: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    orange: "bg-orange-100 text-orange-700",
  }

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-2xl p-3 ${toneClasses[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function buildTemperatureProductionRows(data: ExperimentData[], metric: ProductionMetric) {
  return data.flatMap((experiment) =>
    (experiment.testsData ?? [])
      .map((test) => {
        const productionValue = getMetricValue(test, metric)
        if (!isNumber(productionValue) || !isNumber(test.avgRiceTemperature)) return null

        return {
          id: test.id,
          experimentNumber: experiment.number,
          strain: experiment.strain,
          fungusName: experiment.fungusName,
          testLabel: `R${test.repetitionNumber ?? "-"} / T${test.testNumber ?? "-"}`,
          avgRiceTemperature: Number(test.avgRiceTemperature.toFixed(1)),
          avgChamberTemperature: isNumber(test.avgChamberTemperature) ? Number(test.avgChamberTemperature.toFixed(1)) : undefined,
          productionValue: Number(productionValue.toFixed(1)),
          wetWeight: test.wetWeight,
          dryWeight: test.dryWeight,
          extractedConidiumWeight: test.extractedConidiumWeight,
          testNumber: test.testNumber ?? 1,
          withinRange: withinRange(test.avgRiceTemperature, experiment.fungusMinTemperature, experiment.fungusMaxTemperature),
        }
      })
      .filter(Boolean),
  ) as Array<Record<string, any>>
}

function buildDailyTemperatureRows(data: ExperimentData[]) {
  return Array.from({ length: 14 }, (_, index) => {
    const day = index + 1
    const chamberValues: number[] = []
    const riceValues: number[] = []
    const rangeMinValues: number[] = []
    const rangeMaxValues: number[] = []

    data.forEach((experiment) => {
      if (isNumber(experiment.fungusMinTemperature)) rangeMinValues.push(experiment.fungusMinTemperature)
      if (isNumber(experiment.fungusMaxTemperature)) rangeMaxValues.push(experiment.fungusMaxTemperature)

      ;(experiment.testsData ?? []).forEach((test) => {
        const dayTemp = (test.temperatureDays ?? []).find((item) => item.day === day)
        if (isNumber(dayTemp?.chamber)) chamberValues.push(dayTemp.chamber)
        if (isNumber(dayTemp?.rice)) riceValues.push(dayTemp.rice)
      })
    })

    return {
      day,
      dayLabel: `${day}º`,
      chamber: roundOrUndefined(average(chamberValues)),
      rice: roundOrUndefined(average(riceValues)),
      rangeMin: roundOrUndefined(average(rangeMinValues)),
      rangeMax: roundOrUndefined(average(rangeMaxValues)),
    }
  })
}

function buildProductionByExperimentRows(data: ExperimentData[]) {
  return data.map((experiment) => {
    const tests = experiment.testsData ?? []
    return {
      label: `Exp. #${String(experiment.number).padStart(3, "0")}`,
      strain: experiment.strain,
      fungusName: experiment.fungusName,
      wetWeight: roundOrUndefined(average(tests.map((test) => test.wetWeight))),
      dryWeight: roundOrUndefined(average(tests.map((test) => test.dryWeight))),
      extractedConidiumWeight: roundOrUndefined(average(tests.map((test) => test.extractedConidiumWeight))),
      avgRiceTemperature: roundOrUndefined(average(tests.map((test) => test.avgRiceTemperature))),
    }
  })
}

function buildStrainSummary(data: ExperimentData[]) {
  const map = new Map<string, any>()

  data.forEach((experiment) => {
    if (!map.has(experiment.strain)) {
      map.set(experiment.strain, {
        strain: experiment.strain,
        fungusName: experiment.fungusName,
        wetValues: [] as number[],
        dryValues: [] as number[],
        conidiumValues: [] as number[],
        riceValues: [] as number[],
        productionTests: 0,
      })
    }

    const row = map.get(experiment.strain)
    ;(experiment.testsData ?? []).forEach((test) => {
      if (isNumber(test.wetWeight) || isNumber(test.dryWeight) || isNumber(test.extractedConidiumWeight)) row.productionTests += 1
      if (isNumber(test.wetWeight)) row.wetValues.push(test.wetWeight)
      if (isNumber(test.dryWeight)) row.dryValues.push(test.dryWeight)
      if (isNumber(test.extractedConidiumWeight)) row.conidiumValues.push(test.extractedConidiumWeight)
      if (isNumber(test.avgRiceTemperature)) row.riceValues.push(test.avgRiceTemperature)
    })
  })

  return Array.from(map.values()).map((row) => ({
    strain: row.strain,
    fungusName: row.fungusName,
    avgWet: roundOrUndefined(average(row.wetValues)),
    avgDry: roundOrUndefined(average(row.dryValues)),
    avgConidium: roundOrUndefined(average(row.conidiumValues)),
    avgRiceTemperature: roundOrUndefined(average(row.riceValues)),
    productionTests: row.productionTests,
  }))
}

function buildFungusSummary(data: ExperimentData[]) {
  const map = new Map<string, any>()

  data.forEach((experiment) => {
    const key = experiment.fungusId ?? "sem-fungo"
    if (!map.has(key)) {
      map.set(key, {
        fungusId: key,
        fungusName: experiment.fungusName,
        optimalTemperature: experiment.fungusOptimalTemperature,
        minTemperature: experiment.fungusMinTemperature,
        maxTemperature: experiment.fungusMaxTemperature,
        wetValues: [] as number[],
        dryValues: [] as number[],
        conidiumValues: [] as number[],
        riceValues: [] as number[],
        withinRangeCount: 0,
        totalTemperatureTests: 0,
        totalTests: 0,
        productionTests: 0,
      })
    }

    const row = map.get(key)
    ;(experiment.testsData ?? []).forEach((test) => {
      row.totalTests += 1
      if (isNumber(test.avgRiceTemperature)) {
        row.totalTemperatureTests += 1
        row.riceValues.push(test.avgRiceTemperature)
        if (withinRange(test.avgRiceTemperature, experiment.fungusMinTemperature, experiment.fungusMaxTemperature)) {
          row.withinRangeCount += 1
        }
      }
      if (isNumber(test.wetWeight) || isNumber(test.dryWeight) || isNumber(test.extractedConidiumWeight)) row.productionTests += 1
      if (isNumber(test.wetWeight)) row.wetValues.push(test.wetWeight)
      if (isNumber(test.dryWeight)) row.dryValues.push(test.dryWeight)
      if (isNumber(test.extractedConidiumWeight)) row.conidiumValues.push(test.extractedConidiumWeight)
    })
  })

  return Array.from(map.values()).map((row) => ({
    fungusId: row.fungusId,
    fungusName: row.fungusName,
    optimalTemperature: row.optimalTemperature,
    minTemperature: row.minTemperature,
    maxTemperature: row.maxTemperature,
    avgRiceTemperature: roundOrUndefined(average(row.riceValues)),
    withinRangePct: row.totalTemperatureTests > 0 ? (row.withinRangeCount / row.totalTemperatureTests) * 100 : 0,
    avgWet: roundOrUndefined(average(row.wetValues)),
    avgDry: roundOrUndefined(average(row.dryValues)),
    avgConidium: roundOrUndefined(average(row.conidiumValues)),
    totalTests: row.totalTests,
    productionTests: row.productionTests,
  }))
}

function buildStatusRows(tests: UITest[]) {
  const statuses = ["Concluído", "Em andamento", "Inserir Fotos", "Pendente"] as const
  const total = tests.length || 1

  const classes = {
    "Concluído": "h-full rounded-full bg-emerald-500",
    "Em andamento": "h-full rounded-full bg-blue-500",
    "Inserir Fotos": "h-full rounded-full bg-orange-500",
    Pendente: "h-full rounded-full bg-slate-400",
  }

  return statuses.map((status) => {
    const count = tests.filter((test) => test.status === status).length
    return { status, count, percent: (count / total) * 100, className: classes[status] }
  })
}

function roundOrUndefined(value: number | undefined): number | undefined {
  return isNumber(value) ? Number(value.toFixed(1)) : undefined
}

type TemperatureProductionTooltipProps = {
  active?: boolean
  payload?: Array<{ payload?: any }>
  metric: ProductionMetric
}

function TemperatureProductionTooltip({ active, payload, metric }: TemperatureProductionTooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  return (
    <div className="rounded-xl border bg-background p-3 text-sm shadow-lg">
      <p className="font-semibold">Exp. #{row.experimentNumber} · {row.testLabel}</p>
      <p className="text-muted-foreground"><span className="italic">{row.fungusName}</span> · {row.strain}</p>
      <div className="mt-2 space-y-1">
        <p>Temp. arroz: <span className="font-medium">{formatNumber(row.avgRiceTemperature)} ºC</span></p>
        <p>Temp. câmara: <span className="font-medium">{formatNumber(row.avgChamberTemperature)} ºC</span></p>
        <p>{METRIC_LABEL[metric]}: <span className="font-medium">{formatNumber(row.productionValue)}</span></p>
        <p>Pó úmido/seco/conídios: <span className="font-medium">{formatNumber(row.wetWeight)} / {formatNumber(row.dryWeight)} / {formatNumber(row.extractedConidiumWeight)}</span></p>
      </div>
    </div>
  )
}

function DailyTemperatureTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  return (
    <div className="rounded-xl border bg-background p-3 text-sm shadow-lg">
      <p className="font-semibold">{label} dia</p>
      <p>Arroz: <span className="font-medium">{formatNumber(row.rice)} ºC</span></p>
      <p>Câmara: <span className="font-medium">{formatNumber(row.chamber)} ºC</span></p>
      {isNumber(row.rangeMin) && isNumber(row.rangeMax) ? (
        <p className="text-muted-foreground">Faixa: {formatNumber(row.rangeMin)}–{formatNumber(row.rangeMax)} ºC</p>
      ) : null}
    </div>
  )
}

function StrainTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  return (
    <div className="rounded-xl border bg-background p-3 text-sm shadow-lg">
      <p className="font-semibold">{label}</p>
      <p className="italic text-muted-foreground">{row.fungusName}</p>
      <div className="mt-2 space-y-1">
        <p>Pó úmido: <span className="font-medium">{formatNumber(row.avgWet)}</span></p>
        <p>Pó seco: <span className="font-medium">{formatNumber(row.avgDry)}</span></p>
        <p>Conídios: <span className="font-medium">{formatNumber(row.avgConidium)}</span></p>
        <p>Temp. arroz: <span className="font-medium">{formatNumber(row.avgRiceTemperature)} ºC</span></p>
      </div>
    </div>
  )
}

function ExperimentProductionTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  return (
    <div className="rounded-xl border bg-background p-3 text-sm shadow-lg">
      <p className="font-semibold">{label}</p>
      <p className="text-muted-foreground">{row.strain} · <span className="italic">{row.fungusName}</span></p>
      <div className="mt-2 space-y-1">
        <p>Pó úmido: <span className="font-medium">{formatNumber(row.wetWeight)}</span></p>
        <p>Pó seco: <span className="font-medium">{formatNumber(row.dryWeight)}</span></p>
        <p>Conídios: <span className="font-medium">{formatNumber(row.extractedConidiumWeight)}</span></p>
        <p>Temp. arroz: <span className="font-medium">{formatNumber(row.avgRiceTemperature)} ºC</span></p>
      </div>
    </div>
  )
}
