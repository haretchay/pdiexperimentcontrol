"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

type TestMetrics = {
  temp7Chamber?: number
  temp7Rice?: number
  temp14Chamber?: number
  temp14Rice?: number
}

type ExperimentInput = {
  number: string | number
  strain?: string
  testsData?: TestMetrics[]
}

type TooltipLike = {
  active?: boolean
  payload?: Array<{ value?: number; name?: string; payload?: any }>
  label?: string
}

interface TemperatureLineChartProps {
  data: ExperimentInput[]
}

export function TemperatureLineChart({ data }: TemperatureLineChartProps) {
  const chartData = (data ?? []).map((experiment) => {
    const testsData = (experiment.testsData ?? []) as TestMetrics[]
    const denom = testsData.length || 1

    const avgTemp7Chamber =
      testsData.reduce<number>((sum, test) => sum + (test.temp7Chamber ?? 0), 0) / denom
    const avgTemp7Rice =
      testsData.reduce<number>((sum, test) => sum + (test.temp7Rice ?? 0), 0) / denom
    const avgTemp14Chamber =
      testsData.reduce<number>((sum, test) => sum + (test.temp14Chamber ?? 0), 0) / denom
    const avgTemp14Rice =
      testsData.reduce<number>((sum, test) => sum + (test.temp14Rice ?? 0), 0) / denom

    return {
      name: `Exp #${String(experiment.number)}`,
      strain: experiment.strain ?? "-",
      temp7Chamber: Number.parseFloat(avgTemp7Chamber.toFixed(1)),
      temp7Rice: Number.parseFloat(avgTemp7Rice.toFixed(1)),
      temp14Chamber: Number.parseFloat(avgTemp14Chamber.toFixed(1)),
      temp14Rice: Number.parseFloat(avgTemp14Rice.toFixed(1)),
    }
  })

  const CustomTooltip = ({ active, payload, label }: TooltipLike) => {
    if (active && payload && payload.length) {
      const row = payload[0]?.payload as any
      return (
        <div className="bg-background border rounded-md shadow-md p-3">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">{row?.strain ?? "-"}</p>
          <div className="text-sm space-y-1 mt-2">
            <div>
              7º dia (Câmara): <span className="font-medium">{row?.temp7Chamber ?? "-"}</span>
            </div>
            <div>
              7º dia (Arroz): <span className="font-medium">{row?.temp7Rice ?? "-"}</span>
            </div>
            <div>
              14º dia (Câmara): <span className="font-medium">{row?.temp14Chamber ?? "-"}</span>
            </div>
            <div>
              14º dia (Arroz): <span className="font-medium">{row?.temp14Rice ?? "-"}</span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="col-span-1 md:col-span-2">
      <CardHeader>
        <CardTitle>Temperaturas (média)</CardTitle>
        <CardDescription>Médias por experimento (7 e 14 dias)</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
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

              <Line type="monotone" dataKey="temp7Chamber" name="7º dia (Câmara)" stroke="#3b82f6" />
              <Line type="monotone" dataKey="temp7Rice" name="7º dia (Arroz)" stroke="#f59e0b" />
              <Line type="monotone" dataKey="temp14Chamber" name="14º dia (Câmara)" stroke="#22c55e" />
              <Line type="monotone" dataKey="temp14Rice" name="14º dia (Arroz)" stroke="#ef4444" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {chartData.length === 0 && (
          <div className="text-sm text-muted-foreground mt-4">Sem dados suficientes para exibir temperaturas.</div>
        )}
      </CardContent>
    </Card>
  )
}
