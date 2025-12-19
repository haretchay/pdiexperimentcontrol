"use client"

import Link from "next/link"
import { PageTitle } from "@/components/page-title"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type UITestRow = {
  id: string
  experimentId: string
  experimentNumber: string
  experimentStrain: string
  startDate: string
  repetitionNumber: number
  testNumber: number
  testType?: string
  unit?: string
  requisition?: string
  date7Day?: string
  date14Day?: string
}

export function TestsPageClient({ initialTests }: { initialTests: UITestRow[] }) {
  return (
    <div className="container mx-auto p-4">
      <PageTitle title="Testes" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {initialTests.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle className="flex flex-col gap-1">
                <span>
                  Exp #{t.experimentNumber} — Rep {t.repetitionNumber} / Teste {t.testNumber}
                </span>
                <span className="text-sm text-muted-foreground">{t.experimentStrain}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-2">
                {t.testType ? <Badge variant="secondary">{t.testType}</Badge> : null}
                {t.unit ? <Badge variant="outline">{t.unit}</Badge> : null}
                {t.requisition ? <Badge variant="outline">{t.requisition}</Badge> : null}
              </div>

              {t.startDate ? (
                <div>
                  <strong>Início:</strong> {new Date(t.startDate).toLocaleDateString("pt-BR")}
                </div>
              ) : null}

              {(t.date7Day || t.date14Day) ? (
                <div className="text-muted-foreground">
                  {t.date7Day ? <>7d: {new Date(t.date7Day).toLocaleString("pt-BR")} </> : null}
                  {t.date14Day ? <> | 14d: {new Date(t.date14Day).toLocaleString("pt-BR")}</> : null}
                </div>
              ) : null}

              <div className="pt-2">
                <Link className="underline text-primary" href={`/experiments/${t.experimentId}`}>
                  Abrir experimento
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {initialTests.length === 0 && (
        <div className="text-sm text-muted-foreground mt-6">
          Nenhum teste encontrado no Supabase ainda.
        </div>
      )}
    </div>
  )
}
