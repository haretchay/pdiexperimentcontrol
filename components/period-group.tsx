"use client"

import type React from "react"
import { Calendar } from "lucide-react"
import { useTheme } from "next-themes"

interface PeriodGroupProps {
  title: string
  children: React.ReactNode
}

export function PeriodGroup({ title, children }: PeriodGroupProps) {
  const { theme } = useTheme()

  // Determine if this is a week or month period
  const isWeek = title.toLowerCase().includes("semana")

  // Get period number for color variation
  const getPeriodNumber = () => {
    if (isWeek) {
      const match = title.match(/Semana (\d+)/)
      return match ? Number.parseInt(match[1]) % 6 : 0
    } else {
      const months = [
        "janeiro",
        "fevereiro",
        "março",
        "abril",
        "maio",
        "junho",
        "julho",
        "agosto",
        "setembro",
        "outubro",
        "novembro",
        "dezembro",
      ]
      const monthName = title.split(" ")[0].toLowerCase()
      return months.indexOf(monthName) % 6
    }
  }

  // Color schemes based on theme and period type
  const getBackgroundColor = () => {
    const periodNumber = getPeriodNumber()

    // Neutral theme uses grayscale
    if (theme === "neutral") {
      const grayScales = ["bg-gray-100", "bg-gray-200", "bg-gray-300", "bg-gray-100", "bg-gray-200", "bg-gray-300"]
      return grayScales[periodNumber]
    }

    // For week periods
    if (isWeek) {
      const weekColors = ["bg-blue-50", "bg-purple-50", "bg-indigo-50", "bg-cyan-50", "bg-sky-50", "bg-violet-50"]
      return weekColors[periodNumber]
    }

    // For month periods
    const monthColors = ["bg-green-50", "bg-emerald-50", "bg-teal-50", "bg-amber-50", "bg-orange-50", "bg-rose-50"]
    return monthColors[periodNumber]
  }

  // Get border color to match background
  const getBorderColor = () => {
    const periodNumber = getPeriodNumber()

    // Neutral theme uses grayscale
    if (theme === "neutral") {
      const grayScales = [
        "border-gray-200",
        "border-gray-300",
        "border-gray-400",
        "border-gray-200",
        "border-gray-300",
        "border-gray-400",
      ]
      return grayScales[periodNumber]
    }

    // For week periods
    if (isWeek) {
      const weekBorders = [
        "border-blue-100",
        "border-purple-100",
        "border-indigo-100",
        "border-cyan-100",
        "border-sky-100",
        "border-violet-100",
      ]
      return weekBorders[periodNumber]
    }

    // For month periods
    const monthBorders = [
      "border-green-100",
      "border-emerald-100",
      "border-teal-100",
      "border-amber-100",
      "border-orange-100",
      "border-rose-100",
    ]
    return monthBorders[periodNumber]
  }

  // Get icon color to match background
  const getIconColor = () => {
    const periodNumber = getPeriodNumber()

    // Neutral theme uses grayscale
    if (theme === "neutral") {
      return "text-gray-500"
    }

    // For week periods
    if (isWeek) {
      const weekIconColors = [
        "text-blue-500",
        "text-purple-500",
        "text-indigo-500",
        "text-cyan-500",
        "text-sky-500",
        "text-violet-500",
      ]
      return weekIconColors[periodNumber]
    }

    // For month periods
    const monthIconColors = [
      "text-green-500",
      "text-emerald-500",
      "text-teal-500",
      "text-amber-500",
      "text-orange-500",
      "text-rose-500",
    ]
    return monthIconColors[periodNumber]
  }

  return (
    <div className="mb-8">
      <div className={`flex items-center mb-4 p-3 rounded-lg border ${getBackgroundColor()} ${getBorderColor()}`}>
        <Calendar className={`h-5 w-5 mr-2 ${getIconColor()}`} />
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  )
}
