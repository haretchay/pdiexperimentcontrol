"use client"

import { Button } from "@/components/ui/button"

type StoredExperiment = {
  id: string
  number?: number
  strain?: string
  startDate?: string
  testCount?: number
  repetitionCount?: number
  testTypes?: string[]
}

type LocalDatabase = {
  version: number
  exportedAt: string
  experiments: StoredExperiment[]
  testData: Record<string, unknown>
}

function readLocalDatabase(): LocalDatabase {
  // Estrutura básica (tipada) – evita "never"
  const database: LocalDatabase = {
    version: 1,
    exportedAt: new Date().toISOString(),
    experiments: [],
    testData: {},
  }

  try {
    const storedExperimentsJSON = localStorage.getItem("experiments")
    if (storedExperimentsJSON) {
      const allExperiments = JSON.parse(storedExperimentsJSON) as StoredExperiment[]
      database.experiments = Array.isArray(allExperiments) ? allExperiments : []
    }

    for (const experiment of database.experiments) {
      if (!experiment?.id) continue
      const testDataJSON = localStorage.getItem(`testData_${experiment.id}`)
      if (testDataJSON) {
        database.testData[experiment.id] = JSON.parse(testDataJSON) as unknown
      }
    }
  } catch {
    // se localStorage não estiver disponível no preview, apenas retorna vazio
  }

  return database
}

function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function DatabaseActions() {
  const handleExport = () => {
    const db = readLocalDatabase()
    downloadJSON("pdi_local_database.json", db)
  }

  // Import propositalmente não implementado (vamos migrar para Supabase)
  const handleImport = () => {
    alert("Importação local desativada. Vamos migrar para Supabase.")
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={handleExport}>
        Exportar dados (local)
      </Button>
      <Button variant="secondary" onClick={handleImport}>
        Importar dados (desativado)
      </Button>
    </div>
  )
}
