"use client"

import { useMemo, useState } from "react"
import { PageTitle } from "@/components/page-title"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type MediaExperiment = {
  id: string
  number: string
  strain: string
  startDate: string
  testCount: number
  repetitionCount: number
}

export function MediaPageClient({ initialExperiments }: { initialExperiments: MediaExperiment[] }) {
  const [selectedId, setSelectedId] = useState<string>("")

  const selected = useMemo(
    () => initialExperiments.find((e) => e.id === selectedId),
    [initialExperiments, selectedId]
  )

  return (
    <div className="container mx-auto p-4">
      <PageTitle title="Mídias" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Selecionar experimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Selecione um experimento" />
            </SelectTrigger>
            <SelectContent>
              {initialExperiments.map((exp) => (
                <SelectItem key={exp.id} value={exp.id}>
                  #{exp.number} — {exp.strain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selected ? (
            <div className="text-sm text-muted-foreground">
              <div>
                <strong>Início:</strong> {new Date(selected.startDate).toLocaleDateString("pt-BR")}
              </div>
              <div>
                <strong>Testes:</strong> {selected.testCount} | <strong>Repetições:</strong> {selected.repetitionCount}
              </div>
              <div className="mt-3">
                (Próximo passo: listar fotos do Supabase Storage vinculadas aos testes.)
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Selecione um experimento para visualizar as mídias.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
