"use client"

import Link from "next/link"
import { PageTitle } from "@/components/page-title"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { UIRepetition } from "@/app/(app)/repetitions/page"

export function RepetitionsPageClient({ initialRepetitions }: { initialRepetitions: UIRepetition[] }) {
  return (
    <div className="container mx-auto p-4">
      <PageTitle title="Repetições" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {initialRepetitions.map((rep) => (
          <Card key={`${rep.experimentId}-${rep.repetitionNumber}`}>
            <CardHeader>
              <CardTitle>
                Exp #{rep.experimentNumber} — Rep {rep.repetitionNumber}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <strong>Cepa:</strong> {rep.strain}
              </div>
              <div>
                <strong>Início:</strong> {new Date(rep.startDate).toLocaleDateString("pt-BR")}
              </div>
              <div>
                <strong>Testes:</strong> {rep.testCount}
              </div>

              <div className="pt-2">
                <Link
                  className="underline text-primary"
                  href={`/experiments/${rep.experimentId}?rep=${rep.repetitionNumber}`}
                >
                  Abrir experimento
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {initialRepetitions.length === 0 && (
        <div className="text-sm text-muted-foreground mt-6">
          Nenhum experimento encontrado no Supabase ainda.
        </div>
      )}
    </div>
  )
}
