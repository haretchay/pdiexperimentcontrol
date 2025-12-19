"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"

type TooltipLike = {
  active?: boolean
  payload?: Array<{ value?: number; name?: string }>
}

interface ExperimentProgressChartProps {
  totalTests: number
  completedTests: number
}

export function ExperimentProgressChart({ totalTests, completedTests }: ExperimentProgressChartProps) {
  const safeTotal = Number.isFinite(totalTests) ? totalTests : 0
  const safeCompleted = Number.isFinite(completedTests) ? completedTests : 0

  const done = Math.min(safeCompleted, safeTotal)
  const pending = Math.max(safeTotal - done, 0)

  const chartData = [
    { name: "Concluídos", value: done },
    { name: "Pendentes", value: pending },
  ]

  const CustomTooltip = ({ active, payload }: TooltipLike) => {
    if (active && payload && payload.length) {
      const first = payload[0]
      return (
        <div className="bg-background border rounded-md shadow-md p-3">
          <p className="font-medium">{first?.name ?? "Item"}</p>
          <p className="text-sm">
            Valor: <span className="font-medium">{first?.value ?? 0}</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Progresso</CardTitle>
        <CardDescription>Concluídos vs pendentes</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                <Cell fill="#22c55e" />
                <Cell fill="#f59e0b" />
              </Pie>

              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
