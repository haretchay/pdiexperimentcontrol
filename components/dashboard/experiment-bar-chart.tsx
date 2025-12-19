"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type TestMetrics = {
  averageHumidity?: number
  bozo?: number
  sensorial?: number
  temp7Chamber?: number
  temp14Chamber?: number
}

type ExperimentChartInput = {
  id?: string
  number: string | number
  strain?: string
  testsData?: TestMetrics[]
}

interface ExperimentBarChartProps {
  data: ExperimentChartInput[]
}

type TooltipLike = {
  active?: boolean
  payload?: Array<{ value?: number; payload?: any }>
  label?: string
}

export function ExperimentBarChart({ data }: ExperimentBarChartProps) {
  const [chartMetric, setChartMetric] = useState<
    "averageHumidity" | "bozo" | "sensorial" | "temp7Chamber" | "temp14Chamber"
  >("averageHumidity")

  const metricOptions = useMemo(
    () => [
      { value: "averageHumidity" as const, label: "Umidade Média (%)" },
      { value: "bozo" as const, label: "Bozo (min)" },
      { value: "sensorial" as const, label: "Sensorial" },
      { value: "temp7Chamber" as const, label: "Temperatura 7º dia (ºC)" },
      { value: "temp14Chamber" as const, label: "Temperatura 14º dia (ºC)" },
    ],
    [],
  )

  const selectedMetric = metricOptions.find((option) => option.value === chartMetric)

  const chartData = useMemo(() => {
    return (data ?? []).map((experiment) => {
      const testsData = (experiment.testsData ?? []) as TestMetrics[]
      const denom = testsData.length || 1

      const avgHumidity =
        testsData.reduce<number>((sum, test) => sum + (test.averageHumidity ?? 0), 0) / denom
      const avgBozo = testsData.reduce<number>((sum, test) => sum + (test.bozo ?? 0), 0) / denom
      const avgSensorial =
        testsData.reduce<number>((sum, test) => sum + (test.sensorial ?? 0), 0) / denom
      const avgTemp7 =
        testsData.reduce<number>((sum, test) => sum + (test.temp7Chamber ?? 0), 0) / denom
      const avgTemp14 =
        testsData.reduce<number>((sum, test) => sum + (test.temp14Chamber ?? 0), 0) / denom

      return {
        name: `Exp #${String(experiment.number)}`,
        strain: experiment.strain ?? "-",
        averageHumidity: Number.parseFloat(avgHumidity.toFixed(1)),
        bozo: Number.parseFloat(avgBozo.toFixed(1)),
        sensorial: Number.parseFloat(avgSensorial.toFixed(1)),
        temp7Chamber: Number.parseFloat(avgTemp7.toFixed(1)),
        temp14Chamber: Number.parseFloat(avgTemp14.toFixed(1)),
      }
    })
  }, [data])

  const CustomTooltip = ({ active, payload, label }: TooltipLike) => {
    if (active && payload && payload.length) {
      const first = payload[0]
      const row = first?.payload as any
      return (
        <div className="bg-background border rounded-md shadow-md p-3">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">{row?.strain ?? "-"}</p>
          <p className="text-sm">
            {selectedMetric?.label}: <span className="font-medium">{first?.value ?? "-"}</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="col-span-1 md:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Comparação de Experimentos</CardTitle>
          <CardDescription>Análise comparativa por experimento</CardDescription>
        </div>

        <Select value={chartMetric} onValueChange={(v) => setChartMetric(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Selecione a métrica" />
          </SelectTrigger>
          <SelectContent>
            {metricOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey={chartMetric} name={selectedMetric?.label} fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
