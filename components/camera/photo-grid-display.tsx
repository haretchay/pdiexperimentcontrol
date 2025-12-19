"use client"

import { useState } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { ZoomIn, Circle } from "lucide-react"

interface PhotoGridDisplayProps {
  photos: string[]
  testInfo: {
    experimentNumber: string
    repetitionNumber: string
    testNumber: string
    strain: string
    day: 7 | 14
    unit: string
    testLot: string
    matrixLot: string
    date?: string
    temperature?: {
      chamber?: number
      rice?: number
    }
  }
  showCaption?: boolean
}

export function PhotoGridDisplay({ photos, testInfo, showCaption = true }: PhotoGridDisplayProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

  if (!photos || photos.length === 0) {
    return null
  }

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Photo grid */}
      <div className="grid grid-cols-3 gap-1 bg-gray-800">
        {photos.map((photo, index) => (
          <Dialog key={index}>
            <DialogTrigger asChild>
              <div className="relative aspect-square cursor-pointer group">
                <Image src={photo || "/placeholder.svg"} alt={`Foto ${index + 1}`} fill className="object-cover" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 transition-opacity">
                  <ZoomIn className="h-6 w-6 text-white" />
                </div>
                <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 text-xs rounded">
                  Foto {index + 1}
                </div>
                {/* Indicador de anotações */}
                {photo.includes("data:image/jpeg;base64") && photo.length > 100000 && (
                  <div className="absolute bottom-2 right-2 bg-red-600/80 text-white px-2 py-1 text-xs rounded-full flex items-center">
                    <Circle className="h-3 w-3 mr-1" />
                    Com anotações
                  </div>
                )}
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-3xl p-0 bg-black">
              <div className="relative h-[80vh]">
                <Image src={photo || "/placeholder.svg"} alt={`Foto ${index + 1}`} fill className="object-contain" />
              </div>
            </DialogContent>
          </Dialog>
        ))}
      </div>

      {/* Caption area - só exibir se showCaption for true */}
      {showCaption && (
        <div className="bg-gray-900 text-white p-3 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <span className="text-gray-400 block">Experimento:</span>
              <span>#{testInfo.experimentNumber}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Repetição:</span>
              <span>#{testInfo.repetitionNumber}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Teste:</span>
              <span>#{testInfo.testNumber}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Dia:</span>
              <span>{testInfo.day}º</span>
            </div>
            <div>
              <span className="text-gray-400 block">Data:</span>
              <span>{testInfo.date || "N/A"}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Cepa:</span>
              <span>{testInfo.strain}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Unidade:</span>
              <span>{testInfo.unit === "americana" ? "Americana" : "Salto"}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Lote Teste:</span>
              <span>{testInfo.testLot}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Lote Matriz:</span>
              <span>{testInfo.matrixLot}</span>
            </div>
            {testInfo.temperature && (
              <>
                <div>
                  <span className="text-gray-400 block">Temp. Câmara:</span>
                  <span>{testInfo.temperature.chamber ? `${testInfo.temperature.chamber} ºC` : "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Temp. Arroz:</span>
                  <span>{testInfo.temperature.rice ? `${testInfo.temperature.rice} ºC` : "N/A"}</span>
                </div>
              </>
            )}
          </div>

          {/* Adicionar legendas das anotações se existirem */}
          {photos[0] && photos[0].includes("data:image/jpeg;base64") && photos[0].length > 100000 && (
            <div className="mt-3 border-t border-gray-700 pt-2">
              <span className="text-gray-400 block mb-1">Anotações:</span>
              <div className="text-xs text-white">
                {/* As anotações já estão incluídas na imagem, esta é apenas uma indicação visual */}
                <span className="italic">As anotações estão incluídas na imagem.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
