"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Database, Loader2 } from "lucide-react"
import { useState } from "react"

export function GenerateTestDataButton() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const generateData = async () => {
    setIsLoading(true)

    try {
      // Limpar dados existentes
      localStorage.removeItem("experiments")

      // Gerar dados de exemplo para experimentos
      const exampleExperiments = [
        {
          id: 1,
          number: "001",
          startDate: new Date().toISOString().split("T")[0], // Data atual
          strain: "Beauveria bassiana",
          testCount: 3,
          repetitionCount: 4,
          totalTests: 12,
          withControl: true,
          testTypes: ["Testemunha", "Tipo A", "Tipo B"],
        },
        {
          id: 2,
          number: "002",
          // Data 5 dias atrás
          startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          strain: "Metarhizium anisopliae",
          testCount: 2,
          repetitionCount: 5,
          totalTests: 10,
          withControl: false,
          testTypes: ["Tipo C", "Tipo D"],
        },
        {
          id: 3,
          number: "003",
          // Data 10 dias atrás
          startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          strain: "Trichoderma harzianum",
          testCount: 4,
          repetitionCount: 3,
          totalTests: 12,
          withControl: true,
          testTypes: ["Testemunha", "Tipo E", "Tipo F", "Tipo G"],
        },
      ]

      // Salvar experimentos no localStorage
      localStorage.setItem("experiments", JSON.stringify(exampleExperiments))

      // Gerar dados de exemplo para testes
      exampleExperiments.forEach((experiment) => {
        const testData: Record<string, any> = {}


        // Gerar dados para cada repetição e teste
        for (let rep = 1; rep <= experiment.repetitionCount; rep++) {
          for (let test = 1; test <= experiment.testCount; test++) {
            // Gerar dados aleatórios para alguns testes (não todos)
            if (Math.random() > 0.3) {
              const testKey = `${rep}_${test}`

              // Determinar o tipo de teste com base nos testTypes do experimento
              const testType =
                experiment.testTypes && experiment.testTypes[test - 1] ? experiment.testTypes[test - 1] : `Tipo ${test}`

              // Gerar datas para o 7º e 14º dia
              const startDate = new Date(experiment.startDate)
              const date7Day = new Date(startDate)
              date7Day.setDate(startDate.getDate() + 7)

              const date14Day = new Date(startDate)
              date14Day.setDate(startDate.getDate() + 14)

              // Gerar fotos de exemplo para o 7º e 14º dia
              const generatePhotos = (count: number) => {
               const photos: string[] = []

                for (let i = 0; i < count; i++) {
                  // Gerar uma URL de data URI para uma imagem de placeholder colorida
                  const color = `hsl(${Math.floor(Math.random() * 360)}, 70%, 80%)`
                  const canvas = document.createElement("canvas")
                  canvas.width = 300
                  canvas.height = 300
                  const ctx = canvas.getContext("2d")
                    if (!ctx) return ""


                  // Desenhar fundo
                  ctx.fillStyle = color
                  ctx.fillRect(0, 0, canvas.width, canvas.height)

                  // Desenhar texto
                  ctx.fillStyle = "#000"
                  ctx.font = "20px Arial"
                  ctx.textAlign = "center"
                  ctx.fillText(`Exp #${experiment.number}`, canvas.width / 2, 50)
                  ctx.fillText(`Rep #${rep} Test #${test}`, canvas.width / 2, 80)
                  ctx.fillText(`${experiment.strain}`, canvas.width / 2, 110)

                  // Adicionar a foto ao array
                  photos.push(canvas.toDataURL("image/jpeg", 0.7))
                }
                return photos
              }

              testData[testKey] = {
                unit: Math.random() > 0.5 ? "americana" : "salto",
                requisition: Math.random() > 0.5 ? "interna" : "externa",
                testLot: `LT-${experiment.id}${rep}${test}`,
                matrixLot: `LM-${experiment.id}${rep}`,
                strain: experiment.strain,
                mpLot: `MP-${experiment.id}${test}`,
                averageHumidity: Math.floor(Math.random() * 100),
                bozo: Math.floor(Math.random() * 100),
                sensorial: Math.floor(Math.random() * 100),
                quantity: Math.floor(Math.random() * 50) + 1,
                testType: testType,

                // Adicionar datas formatadas para o 7º e 14º dia
                date7Day: date7Day.toISOString(),
                date14Day: date14Day.toISOString(),

                temp7Chamber: Math.floor(Math.random() * 10) + 20,
                temp7Rice: Math.floor(Math.random() * 10) + 20,
                temp14Chamber: Math.floor(Math.random() * 10) + 20,
                temp14Rice: Math.floor(Math.random() * 10) + 20,
                wetWeight: (Math.random() * 10 + 1).toFixed(2),
                dryWeight: (Math.random() * 5 + 1).toFixed(2),
                extractedConidiumWeight: (Math.random() * 3 + 1).toFixed(2),

                // Adicionar fotos para o 7º e 14º dia (apenas para alguns testes)
                photos7Day: Math.random() > 0.3 ? generatePhotos(Math.floor(Math.random() * 3) + 1) : [],
                photos14Day: Math.random() > 0.5 ? generatePhotos(Math.floor(Math.random() * 3) + 1) : [],
              }
            }
          }
        }

        // Salvar dados de teste para este experimento
        if (Object.keys(testData).length > 0) {
          localStorage.setItem(`testData_${experiment.id}`, JSON.stringify(testData))
        }
      })

      // Simular um pequeno atraso para mostrar o loading
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Dados de exemplo gerados",
        description: "Os dados de exemplo foram gerados com sucesso.",
      })
    } catch (error) {
      console.error("Erro ao gerar dados:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao gerar os dados de exemplo.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsOpen(false)

      // Recarregar a página para mostrar os novos dados
      window.location.reload()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Database className="h-4 w-4" />
          Gerar Dados de Exemplo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar Dados de Exemplo</DialogTitle>
          <DialogDescription>
            Isso irá gerar dados de exemplo para testes em todo o aplicativo. Os dados existentes serão substituídos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={generateData} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              "Gerar Dados"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
