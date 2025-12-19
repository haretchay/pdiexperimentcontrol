"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageTitle } from "@/components/page-title"
import { Construction } from "lucide-react"

export default function RegistersPage() {
  return (
    <div className="container mx-auto p-4">
      <PageTitle title="Cadastros" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Página em Construção</CardTitle>
          <CardDescription>Esta funcionalidade está sendo desenvolvida e estará disponível em breve.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-12">
          <Construction className="h-24 w-24 text-muted-foreground/50 mb-4" />
          <p className="text-center text-muted-foreground">
            Estamos trabalhando para disponibilizar esta funcionalidade o mais rápido possível.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
