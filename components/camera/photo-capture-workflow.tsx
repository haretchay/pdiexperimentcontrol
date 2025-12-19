"use client"

import { useState } from "react"
import { CameraInterface } from "./camera-interface"
import { PhotoAnnotationEditor } from "./photo-annotation-editor"
import { Button } from "@/components/ui/button"
import { Camera, RefreshCw, Check, X, Edit2 } from "lucide-react"
import { cn } from "@/lib/utils"

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
  const totalPhotos = 6

  // Modificar a função addCaptionToPhoto para aumentar o tamanho da fonte e sobrepor a legenda
  const addCaptionToPhoto = (
    photoSrc: string,
    index: number,
    annotations?: Array<{ x: number; y: number; size: string; caption: string; color?: string }>,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
          // Criar um canvas com as dimensões da imagem original
          const canvas = document.createElement("canvas")
          canvas.width = img.width
          canvas.height = img.height

          const ctx = canvas.getContext("2d")
          if (!ctx) {
            reject(new Error("Não foi possível obter o contexto do canvas"))
            return
          }

          // Desenhar a imagem original
          ctx.drawImage(img, 0, 0, img.width, img.height)

          // Calcular altura da área de legenda (30% da altura da imagem)
          const captionHeight = Math.min(Math.max(img.height * 0.3, 200), 300) // Entre 200 e 300px, ou 30% da altura

          // Criar gradiente para o fundo da legenda (transparente no topo, preto sólido embaixo)
          const gradient = ctx.createLinearGradient(0, img.height - captionHeight, 0, img.height)
          gradient.addColorStop(0, "rgba(0, 0, 0, 0.5)")
          gradient.addColorStop(0.7, "rgba(0, 0, 0, 0.9)")
          gradient.addColorStop(1, "rgba(0, 0, 0, 1)")

          // Desenhar o fundo da legenda
          ctx.fillStyle = gradient
          ctx.fillRect(0, img.height - captionHeight, img.width, captionHeight)

          // Configurar estilo do texto
          ctx.fillStyle = "#FFFFFF"
          ctx.font = "bold 28px Arial" // Fonte muito maior

          // Desenhar a legenda
          const padding = 20
          let y = img.height - captionHeight + 40 // Começar do topo da área de legenda

          // Primeira linha da legenda
          ctx.fillText(
            `Exp #${testInfo.experimentNumber} - Rep #${testInfo.repetitionNumber} - Teste #${testInfo.testNumber}`,
            padding,
            y,
          )
          y += 35 // Espaçamento maior entre linhas

          // Segunda linha da legenda
          ctx.fillText(`Dia: ${testInfo.day}º - Cepa: ${testInfo.strain} - Foto ${index + 1}`, padding, y)
          y += 35

          // Terceira linha da legenda (se disponível)
          if (testInfo.unit || testInfo.testLot) {
            ctx.fillText(
              `${testInfo.unit ? (testInfo.unit === "americana" ? "Americana" : "Salto") : ""} ${testInfo.testLot ? `- Lote: ${testInfo.testLot}` : ""}`,
              padding,
              y,
            )
            y += 35
          }

          // Adicionar legendas das anotações se existirem
          const hasAnnotations = annotations && annotations.length > 0
          if (hasAnnotations) {
            y += 10 // Espaço adicional antes das anotações
            ctx.fillText("Anotações:", padding, y)
            y += 35

            // Adicionar cada anotação
            annotations.forEach((annotation, idx) => {
              if (annotation.caption) {
                // Usar a cor da anotação se disponível, ou uma cor padrão
                const annotationColor = annotation.color || FLUORESCENT_COLORS[idx % FLUORESCENT_COLORS.length]

                // Desenhar um círculo colorido antes do texto
                ctx.fillStyle = annotationColor
                ctx.beginPath()
                ctx.arc(padding + 15, y - 10, 12, 0, Math.PI * 2)
                ctx.fill()

                // Número da anotação
                ctx.fillStyle = "#FFFFFF"
                ctx.font = "bold 16px Arial"
                ctx.textAlign = "center"
                ctx.fillText(`${idx + 1}`, padding + 15, y - 5)

                // Resetar alinhamento e fonte
                ctx.textAlign = "left"
                ctx.font = "bold 24px Arial"

                // Texto da anotação
                ctx.fillStyle = "#FFFFFF"
                ctx.fillText(`${annotation.caption}`, padding + 35, y)
                y += 30
              }
            })
          }

          // Converter o canvas para data URL
          const dataUrl = canvas.toDataURL("image/jpeg", 0.95)
          resolve(dataUrl)
        }

        img.onerror = () => {
          reject(new Error("Erro ao carregar a imagem"))
        }

        img.src = photoSrc
      } catch (error) {
        reject(error)
      }
    })
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

  const handleCapture = (imageSrc: string) => {
    try {
      const newPhotos = [...photos]
      newPhotos[currentPhotoIndex] = imageSrc
      setPhotos(newPhotos)
      setIsCameraOpen(false)

      // Verificar se todas as fotos foram capturadas
      const allPhotosCaptured = newPhotos.filter(Boolean).length === totalPhotos

      if (currentPhotoIndex === totalPhotos - 1 || allPhotosCaptured) {
        // Se estamos na última foto ou todas as fotos foram capturadas, não avançamos automaticamente
      } else {
        // Caso contrário, avançamos para a próxima foto
        setCurrentPhotoIndex(currentPhotoIndex + 1)
      }
    } catch (error) {
      console.error("Erro ao capturar foto:", error)
      setIsCameraOpen(false)
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
                        <div className="flex gap-2">
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
                        </div>
                      </div>
                      <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 text-xs rounded">
                        Foto {index + 1}
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-medium mb-2">Foto {index + 1}</span>
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
