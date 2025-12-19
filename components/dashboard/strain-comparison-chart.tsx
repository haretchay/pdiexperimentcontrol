"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

type TestMetrics = {
  averageHumidity?: number
  bozo?: number
  sensorial?: number
}

type ExperimentInput = {
  strain?: string
  testsData?: TestMetrics[]
}

type TooltipLike = {
  active?: boolean
  payload?: Array<{ value?: number; name?: string; payload?: any }>
  label?: string
}

interface StrainComparisonChartProps {
  data: ExperimentInput[]
}

export function StrainComparisonChart({ data }: StrainComparisonChartProps) {
  // Agregar por cepa
  const strainMap = (data ?? []).reduce<Record<string, { count: number; totalHumidity: number; totalBozo: number; totalSensorial: number }>>(
    (acc, experiment) => {
      const strain = experiment.strain ?? "Sem cepa"
      const testsData = (experiment.testsData ?? []) as TestMetrics[]

      if (!acc[strain]) {
        acc[strain] = { count: 0, totalHumidity: 0, totalBozo: 0, totalSensorial: 0 }
      }

      // Somar valores para esta cepa
      testsData.forEach((test: TestMetrics) => {
        acc[strain].totalHumidity += test.averageHumidity ?? 0
        acc[strain].totalBozo += test.bozo ?? 0
        acc[strain].totalSensorial += test.sensorial ?? 0
        acc[strain].count += 1
      })

      return acc
    },
    {},
  )

  const chartData = Object.entries(strainMap).map(([strain, stats]) => {
    const denom = stats.count || 1
    return {
      strain,
      averageHumidity: Number.parseFloat((stats.totalHumidity / denom).toFixed(1)),
      bozo: Number.parseFloat((stats.totalBozo / denom).toFixed(1)),
      sensorial: Number.parseFloat((stats.totalSensorial / denom).toFixed(1)),
    }
  })

  const CustomTooltip = ({ active, payload, label }: TooltipLike) => {
    if (active && payload && payload.length) {
      const row = payload[0]?.payload as any
      return (
        <div className="bg-background border rounded-md shadow-md p-3">
          <p className="font-medium">{label}</p>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Umidade média: <span className="font-medium">{row?.averageHumidity ?? "-"}</span></div>
            <div>Bozo médio: <span className="font-medium">{row?.bozo ?? "-"}</span></div>
            <div>Sensorial médio: <span className="font-medium">{row?.sensorial ?? "-"}</span></div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="col-span-1 md:col-span-2">
      <CardHeader>
        <CardTitle>Comparação por Cepa</CardTitle>
        <CardDescription>Médias agregadas por cepa (a partir dos testes)</CardDescription>
      </CardHeader>

      <CardContent>
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
              <XAxis dataKey="strain" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="averageHumidity" name="Umidade média" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="bozo" name="Bozo" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sensorial" name="Sensorial" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {chartData.length === 0 && (
          <div className="text-sm text-muted-foreground mt-4">Sem dados suficientes para comparar cepas.</div>
        )}
      </CardContent>
    </Card>
  )
}
