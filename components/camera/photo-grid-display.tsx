"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, ZoomIn } from "lucide-react"

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

function formatTemp(v: any) {
  if (v === null || v === undefined) return "N/A"
  const n = Number(v)
  if (Number.isNaN(n)) return "N/A"
  return `${n} ºC`
}

export function PhotoGridDisplay({ photos, annotations, testInfo, showCaption = true }: PhotoGridDisplayProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

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

  const isSingle = photos.length === 1
  const photo0 = photos[0]
  const ann0 = getAnnotationsForIndex(annotations, 0)
  const hasAnn0 = ann0.some((a) => (a.caption ?? "").trim().length > 0)

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Visualização */}
      {isSingle ? (
        <Dialog onOpenChange={(open) => setSelectedIndex(open ? 0 : null)}>
          <DialogTrigger asChild>
            <div className="relative w-full bg-gray-800 cursor-pointer group">
              {/* mosaico 3x2 (6 fotos) tende a ficar bem em 3/2 */}
              <div className="relative w-full aspect-[3/2] sm:aspect-[16/9]">
                <Image src={photo0 || "/placeholder.svg"} alt={`Foto ${testInfo.day}º dia`} fill className="object-contain" />
              </div>

              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                <div className="flex items-center gap-2 text-white text-sm">
                  <ZoomIn className="h-5 w-5" />
                  Clique para ampliar
                </div>
              </div>

              <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 text-xs rounded">
                Foto {testInfo.day}º dia
              </div>

              {hasAnn0 && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 text-[11px] rounded-full">
                  {ann0.filter((a) => (a.caption ?? "").trim().length > 0).length} legenda(s)
                </div>
              )}
            </div>
          </DialogTrigger>

          <DialogContent className="max-w-5xl p-0 bg-black">
            <DialogTitle className="sr-only">{`Foto ${testInfo.day}º dia`}</DialogTitle>
            <DialogDescription className="sr-only">Visualização ampliada da foto.</DialogDescription>

            <div className="relative h-[82vh] w-full">
              <Image src={photo0 || "/placeholder.svg"} alt={`Foto ${testInfo.day}º dia`} fill className="object-contain" />
            </div>

            {hasAnn0 && (
              <div className="bg-gray-950 text-white px-4 py-3 text-sm border-t border-white/10">
                <div className="font-medium mb-2">Legendas</div>
                <ul className="space-y-1">
                  {ann0
                    .filter((a) => (a.caption ?? "").trim().length > 0)
                    .map((a, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color || "#FF0033" }} />
                        <span className="leading-snug">{a.caption}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </DialogContent>
        </Dialog>
      ) : (
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
                  <DialogTitle className="sr-only">{`Foto ${index + 1} - ${testInfo.day}º dia`}</DialogTitle>
                  <DialogDescription className="sr-only">Visualização ampliada da foto.</DialogDescription>

                  <div className="relative h-[78vh] w-full">
                    <Image src={photo || "/placeholder.svg"} alt={`Foto ${index + 1}`} fill className="object-contain" />
                  </div>

                  {hasAnn && (
                    <div className="bg-gray-950 text-white px-4 py-3 text-sm border-t border-white/10">
                      <div className="font-medium mb-2">Legendas da Foto {index + 1}</div>
                      <ul className="space-y-1">
                        {ann
                          .filter((a) => (a.caption ?? "").trim().length > 0)
                          .map((a, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color || "#FF0033" }} />
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
      )}

      {/* Área de informações + legendas */}
      {showCaption && (
        <div className="bg-gray-900 text-white px-3 py-2 text-sm">
          {/* Linha compacta (sempre visível) */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <div className="text-gray-300">
              <span className="text-gray-400">Exp.</span> <span>#{testInfo.experimentNumber}</span>
            </div>
            <div className="text-gray-300">
              <span className="text-gray-400">Rep.</span> <span>#{testInfo.repetitionNumber}</span>
            </div>
            <div className="text-gray-300">
              <span className="text-gray-400">Teste</span> <span>#{testInfo.testNumber}</span>
            </div>
            <div className="text-gray-300">
              <span className="text-gray-400">Dia</span> <span>{testInfo.day}º</span>
            </div>
            <div className="text-gray-300">
              <span className="text-gray-400">Data</span> <span>{testInfo.date || "N/A"}</span>
            </div>

            <div className="ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-gray-200 hover:text-white"
                onClick={() => setDetailsOpen((v) => !v)}
              >
                {detailsOpen ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Ocultar detalhes
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Ver detalhes
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Detalhes (expandível) */}
          {detailsOpen && (
            <div className="mt-2 border-t border-gray-800 pt-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-gray-400 block">Cepa</span>
                  <span className="text-gray-200">{testInfo.strain || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Unidade</span>
                  <span className="text-gray-200">{testInfo.unit === "americana" ? "Americana" : "Salto"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Lote Teste</span>
                  <span className="text-gray-200">{testInfo.testLot || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Lote Matriz</span>
                  <span className="text-gray-200">{testInfo.matrixLot || "N/A"}</span>
                </div>
                {testInfo.temperature && (
                  <>
                    <div>
                      <span className="text-gray-400 block">Temp. Câmara</span>
                      <span className="text-gray-200">{formatTemp(testInfo.temperature.chamber)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Temp. Arroz</span>
                      <span className="text-gray-200">{formatTemp(testInfo.temperature.rice)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Legendas gerais (se houver) */}
              {annotationsSummary.length > 0 && (
                <div className="mt-2 border-t border-gray-800 pt-2">
                  <div className="text-gray-300 font-medium mb-2 text-xs">Legendas (marcações)</div>
                  <div className="space-y-3">
                    {annotationsSummary.map((row) => (
                      <div key={row.photoIndex}>
                        <div className="text-gray-400 mb-1 text-xs">Foto {row.photoIndex + 1}</div>
                        <ul className="space-y-1">
                          {row.items.map((a, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs">
                              <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color || "#FF0033" }} />
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
      )}
    </div>
  )
}
