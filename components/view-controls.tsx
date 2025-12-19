"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar, CalendarDays } from "lucide-react"

interface ViewControlsProps {
  periodMode: "week" | "month"
  setPeriodMode: (mode: "week" | "month") => void
  title: string
}

export function ViewControls({ periodMode, setPeriodMode, title }: ViewControlsProps) {
  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">{title}</h1>

          <div className="flex flex-col sm:flex-row gap-2">
            {/* Substituído o combobox por botões e removido o texto "Organizar por:" */}
            <div className="flex border rounded-md overflow-hidden">
              <Button
                variant={periodMode === "week" ? "default" : "ghost"}
                size="sm"
                onClick={() => setPeriodMode("week")}
                className="rounded-none"
              >
                <Calendar className="h-4 w-4 mr-1" />
                Semanal
              </Button>
              <Button
                variant={periodMode === "month" ? "default" : "ghost"}
                size="sm"
                onClick={() => setPeriodMode("month")}
                className="rounded-none"
              >
                <CalendarDays className="h-4 w-4 mr-1" />
                Mensal
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
