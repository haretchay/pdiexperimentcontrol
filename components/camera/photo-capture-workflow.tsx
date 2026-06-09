"use client"

import { useState } from "react"
import type { ChangeEvent } from "react"
import { CameraInterface } from "./camera-interface"
import { PhotoAnnotationEditor } from "./photo-annotation-editor"
import { Button } from "@/components/ui/button"
import { Camera, RefreshCw, Check, X, Edit2, Upload } from "lucide-react"
import { cn } from "@/lib/utils"

declare global {
  interface Window {
    HeicTo?: HeicToGlobal
    __pdieHeicToLoader?: Promise<HeicToGlobal>
  }
}

type HeicToGlobal = {
  (options: { blob: Blob; type: "image/jpeg" | "image/png"; quality?: number }): Promise<Blob | Blob[]>
  isHeic?: (blob: Blob) => Promise<boolean>
}

interface PhotoCaptureWorkflowProps {
  onComplete: (
    photos: string[],
    annotations?: Record<number, Array<{ x: number; y: number; size: string; caption: string; color?: string }>>,
  ) => void
  onCancel: () => void
  testInfo: {
    experimentNumber: string
    repetitionNumber: string
    testNumber: string
    strain: string
    day: 7 | 14
    date?: string
    unit?: string
    testLot?: string
    matrixLot?: string
    testType?: string
  }
}

// Adicionar a constante FLUORESCENT_COLORS no início do componente
const FLUORESCENT_COLORS = [
  "#FF0033", // Vermelho fluorescente
  "#00FF33", // Verde fluorescente
  "#3300FF", // Azul fluorescente
  "#FF33FF", // Rosa fluorescente
  "#FFFF00", // Amarelo fluorescente
  "#00FFFF", // Ciano fluorescente
  "#FF6600", // Laranja fluorescente
  "#CC00FF", // Roxo fluorescente
  "#FF0099", // Pink fluorescente
  "#66FF00", // Lima fluorescente
]

const MAX_PHOTO_EDGE = 1600
const UPLOAD_JPEG_QUALITY = 0.84
const CAPTION_JPEG_QUALITY = 0.86
const HEIC_TO_CDN_URL = "https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js"

const isLikelyHeicFile = (file: File) => {
  const mime = String(file.type || "").toLowerCase()
  const name = String(file.name || "").toLowerCase()
  return mime.includes("heic") || mime.includes("heif") || /\.(heic|heif)$/i.test(name)
}

const isLikelyRegularImageFile = (file: File) => {
  if (file.type && file.type.startsWith("image/")) return true
  return /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif)$/i.test(file.name || "")
}

const getImageDimensions = (img: HTMLImageElement, maxEdge = MAX_PHOTO_EDGE) => {
  const sourceWidth = img.naturalWidth || img.width
  const sourceHeight = img.naturalHeight || img.height

  if (!sourceWidth || !sourceHeight) {
    throw new Error("Não foi possível identificar o tamanho da imagem selecionada.")
  }

  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight))
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  }
}

const loadImageElement = (src: string, errorMessage = "Não foi possível abrir a imagem selecionada.") => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = "async"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(errorMessage))
    img.src = src
  })
}

const canvasToJpegDataUrl = (canvas: HTMLCanvasElement, quality = UPLOAD_JPEG_QUALITY) => {
  try {
    const dataUrl = canvas.toDataURL("image/jpeg", quality)
    if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/jpeg")) {
      return dataUrl
    }
  } catch (error) {
    console.error("Erro ao converter canvas para JPG:", error)
  }

  throw new Error("Não foi possível converter a foto para JPG. Tente selecionar outra imagem.")
}

const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === "string" && result.startsWith("data:image/")) {
        resolve(result)
        return
      }
      reject(new Error("Não foi possível converter a imagem carregada."))
    }
    reader.onerror = () => reject(reader.error ?? new Error("Não foi possível ler a imagem carregada."))
    reader.readAsDataURL(blob)
  })
}

const ensureHeicToLoaded = async (): Promise<HeicToGlobal> => {
  if (typeof window === "undefined") {
    throw new Error("Conversão HEIC indisponível fora do navegador.")
  }

  if (window.HeicTo) return window.HeicTo
  if (window.__pdieHeicToLoader) return window.__pdieHeicToLoader

  window.__pdieHeicToLoader = new Promise<HeicToGlobal>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${HEIC_TO_CDN_URL}"]`)

    const finish = () => {
      if (window.HeicTo) {
        resolve(window.HeicTo)
        return
      }
      reject(new Error("O conversor HEIC foi carregado, mas não ficou disponível no navegador."))
    }

    if (existingScript) {
      existingScript.addEventListener("load", finish, { once: true })
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Não foi possível carregar o conversor HEIC.")),
        { once: true },
      )
      return
    }

    const script = document.createElement("script")
    script.src = HEIC_TO_CDN_URL
    script.async = true
    script.onload = finish
    script.onerror = () => {
      window.__pdieHeicToLoader = undefined
      reject(
        new Error(
          "Não foi possível carregar o conversor HEIC. Verifique a internet do aparelho e tente novamente.",
        ),
      )
    }
    document.head.appendChild(script)
  })

  return window.__pdieHeicToLoader
}

const normalizeBlobToJpegDataUrl = async (blob: Blob, maxEdge = MAX_PHOTO_EDGE) => {
  const objectUrl = URL.createObjectURL(blob)

  try {
    const img = await loadImageElement(
      objectUrl,
      "Não foi possível abrir a imagem selecionada depois da conversão.",
    )
    const { width, height } = getImageDimensions(img, maxEdge)
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas 2D indisponível para processar a imagem.")

    ctx.drawImage(img, 0, 0, width, height)
    return canvasToJpegDataUrl(canvas)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

const convertHeicFileToJpegDataUrl = async (file: File) => {
  const heicTo = await ensureHeicToLoaded()

  if (heicTo.isHeic) {
    const confirmedHeic = await heicTo.isHeic(file).catch(() => true)
    if (!confirmedHeic && !isLikelyHeicFile(file)) {
      return normalizeBlobToJpegDataUrl(file)
    }
  }

  const converted = await heicTo({
    blob: file,
    type: "image/jpeg",
    quality: UPLOAD_JPEG_QUALITY,
  })

  const jpegBlob = Array.isArray(converted) ? converted[0] : converted
  if (!jpegBlob) {
    throw new Error("O conversor HEIC não retornou uma imagem JPG válida.")
  }

  return normalizeBlobToJpegDataUrl(jpegBlob)
}

const normalizeImageFileToJpegDataUrl = async (file: File) => {
  if (!isLikelyRegularImageFile(file)) {
    throw new Error("Selecione um arquivo de imagem válido.")
  }

  if (isLikelyHeicFile(file)) {
    try {
      return await convertHeicFileToJpegDataUrl(file)
    } catch (error) {
      console.error("Erro ao converter HEIC/HEIF:", error)
      throw new Error(
        "Não foi possível converter a imagem HEIC/HEIF neste aparelho. Tente novamente com internet ativa ou selecione outra foto HEIC válida.",
      )
    }
  }

  return normalizeBlobToJpegDataUrl(file)
}

export function PhotoCaptureWorkflow({ onComplete, onCancel, testInfo }: PhotoCaptureWorkflowProps) {
  const [photos, setPhotos] = useState<string[]>([])
  const [processedPhotos, setProcessedPhotos] = useState<string[]>([])
  const [photoAnnotations, setPhotoAnnotations] = useState<
    Record<number, Array<{ x: number; y: number; size: string; caption: string; color?: string }>>
  >({})
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [isAnnotating, setIsAnnotating] = useState(false)
  const [currentAnnotatingPhoto, setCurrentAnnotatingPhoto] = useState<string | null>(null)
  const [currentAnnotatingIndex, setCurrentAnnotatingIndex] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const totalPhotos = 6

  // Modificar a função addCaptionToPhoto para aumentar o tamanho da fonte e sobrepor a legenda
  const addCaptionToPhoto = async (
    photoSrc: string,
    index: number,
    annotations?: Array<{ x: number; y: number; size: string; caption: string; color?: string }>,
  ): Promise<string> => {
    const img = await loadImageElement(photoSrc, "Não foi possível carregar a foto para inserir a legenda.")
    const { width, height } = getImageDimensions(img)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      throw new Error("Não foi possível obter o contexto do canvas")
    }

    ctx.drawImage(img, 0, 0, width, height)

    const captionHeight = Math.min(Math.max(height * 0.3, 150), 280)
    const gradient = ctx.createLinearGradient(0, height - captionHeight, 0, height)
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.5)")
    gradient.addColorStop(0.7, "rgba(0, 0, 0, 0.9)")
    gradient.addColorStop(1, "rgba(0, 0, 0, 1)")
    ctx.fillStyle = gradient
    ctx.fillRect(0, height - captionHeight, width, captionHeight)

    const padding = Math.max(14, Math.round(width * 0.018))
    const mainFontSize = Math.max(18, Math.min(28, Math.round(width * 0.022)))
    const annotationFontSize = Math.max(16, Math.min(24, Math.round(width * 0.018)))
    const lineHeight = Math.round(mainFontSize * 1.25)

    ctx.fillStyle = "#FFFFFF"
    ctx.font = `bold ${mainFontSize}px Arial`

    let y = height - captionHeight + lineHeight
    ctx.fillText(
      `Exp #${testInfo.experimentNumber} - Rep #${testInfo.repetitionNumber} - Teste #${testInfo.testNumber}`,
      padding,
      y,
    )
    y += lineHeight

    ctx.fillText(`Dia: ${testInfo.day}º - Cepa: ${testInfo.strain} - Foto ${index + 1}`, padding, y)
    y += lineHeight

    if (testInfo.unit || testInfo.testLot) {
      ctx.fillText(
        `${testInfo.unit ? (testInfo.unit === "americana" ? "Americana" : "Salto") : ""} ${testInfo.testLot ? `- Lote: ${testInfo.testLot}` : ""}`,
        padding,
        y,
      )
      y += lineHeight
    }

    const hasAnnotations = annotations && annotations.length > 0
    if (hasAnnotations) {
      y += Math.round(lineHeight * 0.25)
      ctx.fillText("Anotações:", padding, y)
      y += lineHeight

      annotations.forEach((annotation, idx) => {
        if (annotation.caption) {
          const annotationColor = annotation.color || FLUORESCENT_COLORS[idx % FLUORESCENT_COLORS.length]
          const markerRadius = Math.max(8, Math.round(annotationFontSize * 0.5))

          ctx.fillStyle = annotationColor
          ctx.beginPath()
          ctx.arc(padding + markerRadius, y - markerRadius / 2, markerRadius, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = "#FFFFFF"
          ctx.font = `bold ${Math.max(12, Math.round(annotationFontSize * 0.7))}px Arial`
          ctx.textAlign = "center"
          ctx.fillText(`${idx + 1}`, padding + markerRadius, y - 1)

          ctx.textAlign = "left"
          ctx.font = `bold ${annotationFontSize}px Arial`
          ctx.fillText(`${annotation.caption}`, padding + markerRadius * 2 + 8, y)
          y += Math.round(annotationFontSize * 1.35)
        }
      })
    }

    return canvasToJpegDataUrl(canvas, CAPTION_JPEG_QUALITY)
  }

  // Modificar a função handlePhotoCaptureComplete para passar as anotações para a função addCaptionToPhoto
  const processAllPhotos = async () => {
    try {
      setIsProcessing(true)
      const processed = []
      const toAnnotations = photoAnnotations

      // Filtrar fotos vazias
      const validPhotos = photos.filter((photo) => photo && photo.length > 0)

      for (let i = 0; i < validPhotos.length; i++) {
        // Obter anotações para esta foto, se existirem
        const photoAnnotations = toAnnotations && toAnnotations[i] ? toAnnotations[i] : undefined
        const processedPhoto = await addCaptionToPhoto(validPhotos[i], i, photoAnnotations)
        processed.push(processedPhoto)
      }

      setProcessedPhotos(processed)
      return processed
    } catch (error) {
      console.error("Erro ao processar fotos:", error)
      return photos.filter((photo) => photo && photo.length > 0)
    } finally {
      setIsProcessing(false)
    }
  }

  // Uploads são normalizados para JPG e reduzidos antes de entrar no mosaico.
  // Isso evita falhas em celulares com fotos muito grandes ou formatos pouco compatíveis.


  const setPhotoAtIndex = (index: number, imageSrc: string) => {
    const newPhotos = [...photos]
    newPhotos[index] = imageSrc
    setPhotos(newPhotos)

    setPhotoAnnotations((current) => {
      if (!current[index]) return current
      const next = { ...current }
      delete next[index]
      return next
    })

    const allPhotosSelected = newPhotos.filter(Boolean).length === totalPhotos
    if (index < totalPhotos - 1 && !allPhotosSelected) {
      setCurrentPhotoIndex(index + 1)
    } else {
      setCurrentPhotoIndex(index)
    }
  }

  const handleCapture = (imageSrc: string) => {
    try {
      setPhotoAtIndex(currentPhotoIndex, imageSrc)
      setIsCameraOpen(false)
    } catch (error) {
      console.error("Erro ao capturar foto:", error)
      setIsCameraOpen(false)
    }
  }

  const handleUpload = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0]
      event.target.value = ""

      if (!file) return

      setUploadingIndex(index)
      const imageSrc = await normalizeImageFileToJpegDataUrl(file)
      setPhotoAtIndex(index, imageSrc)
    } catch (error) {
      console.error("Erro ao carregar foto:", error)
      alert(error instanceof Error ? error.message : "Não foi possível carregar a foto selecionada.")
    } finally {
      setUploadingIndex((current) => (current === index ? null : current))
    }
  }

  const handleRetake = (index: number) => {
    try {
      setCurrentPhotoIndex(index)
      setIsCameraOpen(true)
    } catch (error) {
      console.error("Erro ao iniciar recaptura:", error)
    }
  }

  const handleNext = () => {
    try {
      if (currentPhotoIndex < totalPhotos - 1) {
        setCurrentPhotoIndex(currentPhotoIndex + 1)
        setIsCameraOpen(true)
      }
    } catch (error) {
      console.error("Erro ao avançar para próxima foto:", error)
    }
  }

  const handleComplete = async () => {
    try {
      // Garantir que temos um array completo de fotos
      const completePhotos = [...photos]

      // Filtrar fotos nulas ou vazias
      const finalPhotos = completePhotos.filter((photo) => photo && photo.length > 0)

      // Só completar se tivermos pelo menos uma foto
      if (finalPhotos.length > 0) {
        // Processar as fotos com legendas
        const processedPhotos = await processAllPhotos()
        onComplete(processedPhotos, photoAnnotations)
      } else {
        // Mostrar algum feedback visual se não houver fotos
        alert("Por favor, capture pelo menos uma foto antes de concluir.")
      }
    } catch (error) {
      console.error("Erro ao processar fotos:", error)
      alert("Ocorreu um erro ao processar as fotos. Por favor, tente novamente.")
    }
  }

  // Função para iniciar a anotação de uma foto
  const handleStartAnnotation = (index: number) => {
    try {
      if (!photos[index]) {
        console.error("No photo found at index:", index)
        alert("Não foi possível encontrar a foto para anotação. Tente novamente.")
        return
      }

      // Armazenar a foto original antes de iniciar a anotação
      setCurrentAnnotatingPhoto(photos[index])
      setCurrentAnnotatingIndex(index)
      setIsAnnotating(true)
    } catch (err) {
      console.error("Error starting annotation:", err)
      alert("Não foi possível iniciar a anotação. Por favor, tente novamente.")
    }
  }

  // Função para salvar a foto anotada
  const handleSaveAnnotation = (
    annotatedImageSrc: string,
    annotations: Array<{ x: number; y: number; size: string; caption: string; color?: string }>,
  ) => {
    try {
      if (currentAnnotatingIndex !== null) {
        const newPhotos = [...photos]
        newPhotos[currentAnnotatingIndex] = annotatedImageSrc
        setPhotos(newPhotos)

        // Salvar as anotações para esta foto
        const newPhotoAnnotations = { ...photoAnnotations }
        newPhotoAnnotations[currentAnnotatingIndex] = annotations
        setPhotoAnnotations(newPhotoAnnotations)
      }
    } catch (err) {
      console.error("Error saving annotation:", err)
    } finally {
      // Sempre limpar o estado, mesmo em caso de erro
      setIsAnnotating(false)
      setCurrentAnnotatingPhoto(null)
      setCurrentAnnotatingIndex(null)
    }
  }

  // Função para cancelar a anotação
  const handleCancelAnnotation = () => {
    setIsAnnotating(false)
    setCurrentAnnotatingPhoto(null)
    setCurrentAnnotatingIndex(null)
  }

  const isComplete = photos.filter((photo) => photo && photo.length > 0).length > 0

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {isCameraOpen ? (
        <CameraInterface
          onCapture={handleCapture}
          onClose={() => setIsCameraOpen(false)}
          photoCount={totalPhotos}
          currentPhotoIndex={currentPhotoIndex}
        />
      ) : isAnnotating && currentAnnotatingPhoto ? (
        <PhotoAnnotationEditor
          imageSrc={currentAnnotatingPhoto}
          onSave={handleSaveAnnotation}
          onCancel={handleCancelAnnotation}
          onBack={handleCancelAnnotation}
        />
      ) : (
        <>
          <div className="flex items-center justify-between p-4 border-b">
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold">
              Fotos do {testInfo.day}º dia - {testInfo.testType || `Teste #${testInfo.testNumber}`}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleComplete}
              disabled={!isComplete || isProcessing}
              className={cn((!isComplete || isProcessing) && "opacity-50 cursor-not-allowed")}
            >
              {isProcessing ? (
                <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="h-5 w-5" />
              )}
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: totalPhotos }).map((_, index) => (
                <div key={index} className="aspect-square relative border rounded-md overflow-hidden bg-muted/30">
                  <input
                    id={`photo-upload-${testInfo.day}-${index}`}
                    type="file"
                    accept="image/*,.heic,.heif"
                    className="hidden"
                    onChange={(event) => handleUpload(index, event)}
                    disabled={uploadingIndex !== null}
                  />
                  {photos[index] ? (
                    <>
                      {/* Usar um elemento img simples em vez de background-image */}
                      <div className="w-full h-full relative">
                        <img
                          src={photos[index] || "/placeholder.svg"}
                          alt={`Foto ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {/* Indicador de anotações */}
                        {photoAnnotations[index] && photoAnnotations[index].length > 0 && (
                          <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs rounded-full">
                            {photoAnnotations[index].length} anotações
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/50 transition-opacity">
                        <div className="flex flex-col items-center gap-2 sm:flex-row">
                          <Button
                            variant="outline"
                            size="icon"
                            className="bg-black/70 text-white border-white h-9 w-9"
                            onClick={() => handleStartAnnotation(index)}
                            title="Anotar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-black/70 text-white border-white"
                            onClick={() => handleRetake(index)}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Refazer
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-black/70 text-white border-white"
                            onClick={() => document.getElementById(`photo-upload-${testInfo.day}-${index}`)?.click()}
                            disabled={uploadingIndex !== null}
                          >
                            {uploadingIndex === index ? (
                              <div className="h-4 w-4 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-1" />
                            )}
                            {uploadingIndex === index ? "Carregando" : "Upload"}
                          </Button>
                        </div>
                      </div>
                      <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 text-xs rounded">
                        Foto {index + 1}
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3">
                      <span className="text-lg font-medium">Foto {index + 1}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentPhotoIndex(index)
                          setIsCameraOpen(true)
                        }}
                      >
                        <Camera className="h-4 w-4 mr-1" />
                        Capturar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white/90"
                        onClick={() => document.getElementById(`photo-upload-${testInfo.day}-${index}`)?.click()}
                        disabled={uploadingIndex !== null}
                      >
                        {uploadingIndex === index ? (
                          <div className="h-4 w-4 mr-1 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-1" />
                        )}
                        {uploadingIndex === index ? "Carregando" : "Upload"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 border-t">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {photos.filter((p) => p).length} de {totalPhotos} fotos capturadas
              </div>
              {!isComplete && (
                <Button onClick={handleNext} disabled={photos[currentPhotoIndex] === undefined}>
                  {photos[currentPhotoIndex] === undefined ? "Capturar Foto Atual" : "Próxima Foto"}
                </Button>
              )}
              {isComplete && (
                <Button onClick={handleComplete} disabled={isProcessing}>
                  {isProcessing ? "Processando..." : "Concluir"}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
