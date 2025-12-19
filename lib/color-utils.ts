"use client"

import { useTheme } from "next-themes"

// Get card background color based on experiment ID and theme
export function useCardColors() {
  const { theme, resolvedTheme } = useTheme()

  // Extract experiment ID from a composite ID (e.g., "1_2_3" -> "1")
  const getExperimentId = (id: number | string): number => {
    if (typeof id === "number") return id

    // If it's a string like "1_2_3", get the first part
    const parts = id.toString().split("_")
    return Number.parseInt(parts[0])
  }

  const getCardBackground = (id: number | string) => {
    // Get the experiment ID to ensure consistent colors
    const experimentId = getExperimentId(id)

    // Use modulo to cycle through colors
    const colorIndex = experimentId % 6

    // Check if we're in dark mode
    const isDark = resolvedTheme === "dark" || theme === "dark"

    // Neutral theme uses grayscale
    if (theme === "neutral") {
      const neutralColors = isDark
        ? ["bg-gray-800/40", "bg-gray-800/60", "bg-gray-800/30", "bg-gray-800/50", "bg-gray-800/40", "bg-gray-800/70"]
        : ["bg-gray-50", "bg-gray-100", "bg-gray-50", "bg-white", "bg-gray-50", "bg-gray-100"]
      return neutralColors[colorIndex]
    }

    // Dark theme needs darker colors
    if (isDark) {
      const darkColors = [
        "bg-blue-900/20",
        "bg-purple-900/20",
        "bg-indigo-900/20",
        "bg-cyan-900/20",
        "bg-emerald-900/20",
        "bg-amber-900/20",
      ]
      return darkColors[colorIndex]
    }

    // Pink theme uses pink variations
    if (theme === "pink") {
      const pinkColors = [
        "bg-pink-50",
        "bg-rose-50",
        "bg-pink-50/70",
        "bg-rose-50/70",
        "bg-pink-100/50",
        "bg-rose-100/50",
      ]
      return pinkColors[colorIndex]
    }

    // Default light theme
    const lightColors = ["bg-blue-50", "bg-purple-50", "bg-indigo-50", "bg-cyan-50", "bg-emerald-50", "bg-amber-50"]
    return lightColors[colorIndex]
  }

  const getCardBorder = (id: number | string) => {
    // Get the experiment ID to ensure consistent colors
    const experimentId = getExperimentId(id)

    // Use modulo to cycle through colors
    const colorIndex = experimentId % 6

    // Check if we're in dark mode
    const isDark = resolvedTheme === "dark" || theme === "dark"

    // Neutral theme uses grayscale
    if (theme === "neutral") {
      const neutralBorders = isDark
        ? [
            "border-gray-700",
            "border-gray-600",
            "border-gray-700",
            "border-gray-600",
            "border-gray-700",
            "border-gray-600",
          ]
        : [
            "border-gray-200",
            "border-gray-300",
            "border-gray-200",
            "border-gray-100",
            "border-gray-200",
            "border-gray-300",
          ]
      return neutralBorders[colorIndex]
    }

    // Dark theme needs darker colors
    if (isDark) {
      const darkBorders = [
        "border-blue-800/30",
        "border-purple-800/30",
        "border-indigo-800/30",
        "border-cyan-800/30",
        "border-emerald-800/30",
        "border-amber-800/30",
      ]
      return darkBorders[colorIndex]
    }

    // Pink theme uses pink variations
    if (theme === "pink") {
      const pinkBorders = [
        "border-pink-200",
        "border-rose-200",
        "border-pink-200/70",
        "border-rose-200/70",
        "border-pink-300/50",
        "border-rose-300/50",
      ]
      return pinkBorders[colorIndex]
    }

    // Default light theme
    const lightBorders = [
      "border-blue-100",
      "border-purple-100",
      "border-indigo-100",
      "border-cyan-100",
      "border-emerald-100",
      "border-amber-100",
    ]
    return lightBorders[colorIndex]
  }

  return { getCardBackground, getCardBorder }
}
