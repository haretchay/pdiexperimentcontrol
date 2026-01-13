"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ZoomIn } from "lucide-react"

type Annotation = { x: number; y: number; size: string; caption: string; color?: string }
type AnnotationsByPhotoIndex = Record<string, Annotation[]>

interface PhotoGridDisplayProps {
  photos: string[]
  annotations?: AnnotationsByPhotoIndex | null
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

function getAnnotationsForIndex(annotations: PhotoGridDisplayProps["annotations"], index: number): Annotation[] {
  if (!annotations) return []
  return annotations[String(index)] || (annotations as any)[index] || []
}

export function PhotoGridDisplay({ photos, annotations, testInfo, showCaption = true }: PhotoGridDisplayProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const annotationsSummary = useMemo(() => {
    const rows: { photoIndex: number; items: Annotation[] }[] = []
    if (!photos?.length) return rows
    for (let i = 0; i < photos.length; i++) {
      const items = getAnnotationsForIndex(annotations, i).filter((a) => (a.caption ?? "").trim().length > 0)
      if (items.length) rows.push({ photoIndex: i, items })
    }
    return rows
  }, [photos, annotations])

  if (!photos || photos.length === 0) return null

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Grid */}
      <div className="grid grid-cols-3 gap-1 bg-gray-800">
        {photos.map((photo, index) => {
          const ann = getAnnotationsForIndex(annotations, index)
          const hasAnn = ann.some((a) => (a.caption ?? "").trim().length > 0)

          return (
            <Dialog key={index} onOpenChange={(open) => setSelectedIndex(open ? index : null)}>
              <DialogTrigger asChild>
                <div className="relative aspect-square cursor-pointer group">
                  <Image src={photo || "/placeholder.svg"} alt={`Foto ${index + 1}`} fill className="object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 transition-opacity">
                    <ZoomIn className="h-6 w-6 text-white" />
                  </div>
                  <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 text-xs rounded">
                    Foto {index + 1}
                  </div>

                  {hasAnn && (
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 text-[11px] rounded-full">
                      {ann.filter((a) => (a.caption ?? "").trim().length > 0).length} legenda(s)
                    </div>
                  )}
                </div>
              </DialogTrigger>

              <DialogContent className="max-w-4xl p-0 bg-black">
                {/* A11y: Radix exige Title/Description */}
                <DialogTitle className="sr-only">{`Foto ${index + 1} - ${testInfo.day}º dia`}</DialogTitle>
                <DialogDescription className="sr-only">
                  Visualização ampliada da foto e lista de legendas de contaminantes (se houver).
                </DialogDescription>

                <div className="relative h-[78vh] w-full">
                  <Image src={photo || "/placeholder.svg"} alt={`Foto ${index + 1}`} fill className="object-contain" />
                </div>

                {/* Legendas desta foto no modal */}
                {hasAnn && (
                  <div className="bg-gray-950 text-white px-4 py-3 text-sm border-t border-white/10">
                    <div className="font-medium mb-2">Legendas da Foto {index + 1}</div>
                    <ul className="space-y-1">
                      {ann
                        .filter((a) => (a.caption ?? "").trim().length > 0)
                        .map((a, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span
                              className="mt-1 h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: a.color || "#FF0033" }}
                            />
                            <span className="leading-snug">{a.caption}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )
        })}
      </div>

      {/* Área de informações + legendas (abaixo do grid) */}
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

          {/* ✅ Legendas gerais abaixo do grid (por foto) */}
          {annotationsSummary.length > 0 && (
            <div className="mt-3 border-t border-gray-700 pt-3">
              <div className="text-gray-300 font-medium mb-2">Legendas (marcações)</div>
              <div className="space-y-3">
                {annotationsSummary.map((row) => (
                  <div key={row.photoIndex}>
                    <div className="text-gray-400 mb-1">Foto {row.photoIndex + 1}</div>
                    <ul className="space-y-1">
                      {row.items.map((a, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span
                            className="mt-1 h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: a.color || "#FF0033" }}
                          />
                          <span className="leading-snug">{a.caption}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
