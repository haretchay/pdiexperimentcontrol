"use client"

import { useMemo } from "react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ZoomIn, Circle } from "lucide-react"

type Annotation = {
  x: number
  y: number
  size: string
  caption: string
  color?: string
}

// Pode vir como Record<number, Annotation[]> (por foto) OU como Annotation[] (legado)
type AnnotationsInput = Record<number, Annotation[]> | Annotation[] | null | undefined

interface PhotoGridDisplayProps {
  photos: string[]
  annotations?: AnnotationsInput
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

const FLUORESCENT_COLORS = [
  "#FF0033",
  "#00FF33",
  "#3300FF",
  "#FF33FF",
  "#FFFF00",
  "#00FFFF",
  "#FF6600",
  "#CC00FF",
  "#FF0099",
  "#66FF00",
]

function isRecordOfArrays(v: any): v is Record<number, Annotation[]> {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

function normalizeAnnotationsByPhoto(input: AnnotationsInput): Record<number, Annotation[]> {
  if (!input) return {}
  if (Array.isArray(input)) {
    // Legado: todas as anotações sem vínculo por foto -> assume Foto 1
    return { 0: input as Annotation[] }
  }
  if (isRecordOfArrays(input)) return input
  return {}
}

export function PhotoGridDisplay({ photos, annotations, testInfo, showCaption = true }: PhotoGridDisplayProps) {
  if (!photos || photos.length === 0) return null

  const annotationsByPhoto = useMemo(() => normalizeAnnotationsByPhoto(annotations), [annotations])

  const captionsByPhoto = useMemo(() => {
    const out: Record<number, Annotation[]> = {}
    Object.entries(annotationsByPhoto).forEach(([k, arr]) => {
      const idx = Number(k)
      const filtered = (arr || []).filter((a) => a?.caption && String(a.caption).trim() !== "")
      if (filtered.length > 0) out[idx] = filtered
    })
    return out
  }, [annotationsByPhoto])

  const totalCaptions = useMemo(() => {
    return Object.values(captionsByPhoto).reduce((acc, arr) => acc + (arr?.length || 0), 0)
  }, [captionsByPhoto])

  const orderedPhotoIndexesWithCaptions = useMemo(() => {
    return Object.keys(captionsByPhoto)
      .map((n) => Number(n))
      .sort((a, b) => a - b)
  }, [captionsByPhoto])

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Grid */}
      <div className="grid grid-cols-3 gap-1 bg-gray-800">
        {photos.map((photo, index) => {
          const photoCaptions = captionsByPhoto[index] || []
          const count = photoCaptions.length

          return (
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

                  {/* Indicador por foto */}
                  {count > 0 && (
                    <div className="absolute bottom-2 right-2 bg-red-600/80 text-white px-2 py-1 text-xs rounded-full flex items-center">
                      <Circle className="h-3 w-3 mr-1" />
                      {count} anotaç{count === 1 ? "ão" : "ões"}
                    </div>
                  )}
                </div>
              </DialogTrigger>

              <DialogContent className="max-w-3xl p-0 bg-black">
                {/* A11y (remove os warnings do Radix) */}
                <DialogTitle className="sr-only">{`Foto ${index + 1}`}</DialogTitle>
                <DialogDescription className="sr-only">
                  Visualização ampliada da foto do teste.
                </DialogDescription>

                <div className="relative h-[80vh]">
                  <Image src={photo || "/placeholder.svg"} alt={`Foto ${index + 1}`} fill className="object-contain" />
                </div>
              </DialogContent>
            </Dialog>
          )
        })}
      </div>

      {/* Área de caption */}
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

          {/* Legendas reais */}
          {totalCaptions > 0 && (
            <div className="mt-3 border-t border-gray-700 pt-3">
              <span className="text-gray-400 block mb-2 font-semibold">
                Legendas dos Contaminantes ({totalCaptions})
              </span>

              <div className="space-y-3">
                {orderedPhotoIndexesWithCaptions.map((photoIndex) => {
                  const list = captionsByPhoto[photoIndex] || []
                  if (list.length === 0) return null

                  return (
                    <div key={photoIndex} className="space-y-1">
                      <div className="text-xs text-gray-300 font-semibold">
                        Foto {photoIndex + 1}
                      </div>

                      <div className="space-y-1">
                        {list.map((ann, idx) => {
                          const color = ann.color || FLUORESCENT_COLORS[idx % FLUORESCENT_COLORS.length]
                          return (
                            <div key={`${photoIndex}-${idx}`} className="flex items-center gap-2 text-sm">
                              <div
                                className="flex items-center justify-center rounded-full text-white font-bold"
                                style={{
                                  backgroundColor: color,
                                  width: "24px",
                                  height: "24px",
                                  fontSize: "12px",
                                  flexShrink: 0,
                                }}
                              >
                                {idx + 1}
                              </div>
                              <span className="text-white">{ann.caption}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
