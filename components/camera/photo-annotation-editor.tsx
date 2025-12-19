"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Check, X, Circle, ArrowLeft } from "lucide-react"

// Atualizar a interface para incluir legendas
interface PhotoAnnotationEditorProps {
  imageSrc: string
  onSave: (
    annotatedImageSrc: string,
    annotations: Array<{ x: number; y: number; size: string; caption: string }>,
  ) => void
  onCancel: () => void
  onBack: () => void
}

// Array de cores fluorescentes para as anotações
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

export function PhotoAnnotationEditor({ imageSrc, onSave, onCancel, onBack }: PhotoAnnotationEditorProps) {
  const [circleSize, setCircleSize] = useState<"small" | "medium" | "large">("medium")
  // Atualizar a estrutura de dados das anotações para incluir legendas
  const [annotations, setAnnotations] = useState<
    Array<{ x: number; y: number; size: string; caption: string; color: string }>
  >([])
  const [currentAnnotation, setCurrentAnnotation] = useState<number | null>(null)
  const [captionInput, setCaptionInput] = useState("")
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Função para obter o tamanho do círculo com base no tamanho selecionado
  const getCircleSize = (size: string): number => {
    switch (size) {
      case "small":
        return 40 // Aumentado para 40
      case "large":
        return 120 // Aumentado para 120
      case "medium":
      default:
        return 80 // Aumentado para 80
    }
  }

  // Atualizar as dimensões da imagem quando ela carregar
  useEffect(() => {
    if (imageRef.current && imageRef.current.complete) {
      setImageSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      })
    }
  }, [imageSrc])

  // Função para adicionar uma anotação ao clicar na imagem
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Atribuir uma cor com base no índice da anotação (cíclico)
    const colorIndex = annotations.length % FLUORESCENT_COLORS.length
    const color = FLUORESCENT_COLORS[colorIndex]

    const newAnnotation = { x, y, size: circleSize, caption: "", color }
    setAnnotations([...annotations, newAnnotation])
    setCurrentAnnotation(annotations.length)
    setCaptionInput("")
  }

  // Função para salvar a legenda da anotação atual
  const saveCaption = () => {
    if (currentAnnotation !== null && captionInput.trim() !== "") {
      const updatedAnnotations = [...annotations]
      updatedAnnotations[currentAnnotation].caption = captionInput.trim()
      setAnnotations(updatedAnnotations)
      setCurrentAnnotation(null)
      setCaptionInput("")
    }
  }

  // Função para desfazer a última anotação
  const handleUndo = () => {
    if (annotations.length > 0) {
      setAnnotations(annotations.slice(0, -1))
      setCurrentAnnotation(null)
      setCaptionInput("")
    }
  }

  // Função para editar uma anotação existente
  const handleEditAnnotation = (index: number) => {
    setCurrentAnnotation(index)
    setCaptionInput(annotations[index].caption)
  }

  // Modificar o renderCustomizedLabel para usar a cor específica da anotação
  // Atualizar a função handleSave para usar as cores específicas das anotações

  const handleSave = () => {
    try {
      if (!imageSize) {
        console.error("Tamanho da imagem não disponível")
        onSave(imageSrc, annotations) // Passar as anotações mesmo em caso de fallback
        return
      }

      // Criar um canvas temporário para desenhar a imagem com anotações
      const canvas = document.createElement("canvas")
      canvas.width = imageSize.width
      canvas.height = imageSize.height
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        console.error("Contexto de canvas não disponível")
        onSave(imageSrc, annotations) // Passar as anotações mesmo em caso de fallback
        return
      }

      // Carregar a imagem original
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        // Desenhar a imagem original no canvas
        ctx.drawImage(img, 0, 0, imageSize.width, imageSize.height)

        // Calcular a escala entre o tamanho exibido e o tamanho real da imagem
        const containerWidth = containerRef.current?.clientWidth || imageSize.width
        const scaleX = imageSize.width / containerWidth

        // Desenhar as anotações
        annotations.forEach((annotation, index) => {
          const realX = annotation.x * scaleX
          const realY = annotation.y * scaleX // Usar a mesma escala para manter a proporção
          const realSize = getCircleSize(annotation.size) * scaleX

          // Desenhar o círculo com a cor específica da anotação
          ctx.beginPath()
          ctx.arc(realX, realY, realSize / 2, 0, Math.PI * 2)
          ctx.strokeStyle = annotation.color
          ctx.lineWidth = 6 // Linha grossa para melhor visibilidade
          ctx.stroke()

          // Adicionar número ao canto superior externo do círculo
          const numberSize = Math.max(16, realSize / 4)
          const numberX = realX - (realSize / 2) * 0.7 // Posicionar no canto superior esquerdo do círculo
          const numberY = realY - (realSize / 2) * 0.7 // Posicionar no canto superior do círculo

          // Desenhar um círculo de fundo para o número
          ctx.beginPath()
          ctx.arc(numberX, numberY, numberSize / 1.5, 0, Math.PI * 2)
          ctx.fillStyle = annotation.color
          ctx.fill()

          // Adicionar o número
          ctx.fillStyle = "#FFFFFF"
          ctx.font = `bold ${numberSize}px Arial`
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          ctx.fillText(`${index + 1}`, numberX, numberY)
        })

        // Converter o canvas para uma string de dados de imagem
        const annotatedImageSrc = canvas.toDataURL("image/jpeg", 0.9)
        onSave(annotatedImageSrc, annotations) // Passar as anotações junto com a imagem
      }

      img.onerror = () => {
        console.error("Erro ao carregar a imagem para anotação")
        onSave(imageSrc, annotations) // Passar as anotações mesmo em caso de fallback
      }

      img.src = imageSrc
    } catch (error) {
      console.error("Erro ao salvar anotações:", error)
      onSave(imageSrc, annotations) // Passar as anotações mesmo em caso de erro
    }
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5 text-white" />
        </Button>
        <h2 className="text-lg font-semibold text-white">Marcar Contaminantes</h2>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-5 w-5 text-white" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto flex flex-col items-center justify-center p-4">
        <div
          ref={containerRef}
          className="relative w-full max-w-2xl border border-gray-700 rounded-md overflow-hidden"
          onClick={handleImageClick}
          style={{ cursor: "crosshair" }}
        >
          {/* Usar um elemento img simples para exibir a imagem */}
          <img
            ref={imageRef}
            src={imageSrc || "/placeholder.svg"}
            alt="Imagem para anotação"
            className="w-full h-auto block"
            onLoad={() => {
              if (imageRef.current) {
                setImageSize({
                  width: imageRef.current.naturalWidth,
                  height: imageRef.current.naturalHeight,
                })
              }
            }}
          />

          {/* Renderizar as anotações como elementos absolutos */}
          {annotations.map((annotation, index) => {
            const size = getCircleSize(annotation.size)
            return (
              <div
                key={index}
                className="absolute rounded-full flex items-center justify-center"
                style={{
                  left: `${annotation.x}px`,
                  top: `${annotation.y}px`,
                  width: `${size}px`,
                  height: `${size}px`,
                  transform: "translate(-50%, -50%)",
                  borderWidth: "4px",
                  borderStyle: "solid",
                  borderColor: annotation.color,
                  backgroundColor: "transparent",
                  cursor: "pointer",
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleEditAnnotation(index)
                }}
              >
                {/* Número posicionado no canto superior externo do círculo */}
                <div
                  className="absolute flex items-center justify-center rounded-full"
                  style={{
                    top: `-${size * 0.15}px`,
                    left: `-${size * 0.15}px`,
                    width: `${size * 0.4}px`,
                    height: `${size * 0.4}px`,
                    backgroundColor: annotation.color,
                    color: "white",
                    fontWeight: "bold",
                    fontSize: `${Math.max(12, size * 0.25)}px`,
                    zIndex: 10,
                  }}
                >
                  {index + 1}
                </div>

                {/* Remover a exibição da legenda aqui, pois será incluída na legenda da foto */}
              </div>
            )
          })}
        </div>
      </div>

      {/* Área de entrada de legenda */}
      {currentAnnotation !== null && (
        <div className="p-4 bg-gray-900 border-t border-gray-800">
          <div className="flex flex-col gap-2">
            <label className="text-white text-sm">Legenda para anotação #{currentAnnotation + 1}:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={captionInput}
                onChange={(e) => setCaptionInput(e.target.value)}
                placeholder="Descreva o contaminante..."
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                autoFocus
              />
              <Button onClick={saveCaption} className="bg-green-600 hover:bg-green-700">
                Salvar
              </Button>
              <Button variant="outline" onClick={() => setCurrentAnnotation(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-gray-800 bg-black">
        <div className="flex flex-col gap-4">
          <div className="flex justify-center gap-2">
            <Button
              variant={circleSize === "small" ? "default" : "outline"}
              onClick={() => setCircleSize("small")}
              className="flex items-center gap-2"
            >
              <Circle className="h-3 w-3" />
              <span>Pequeno</span>
            </Button>
            <Button
              variant={circleSize === "medium" ? "default" : "outline"}
              onClick={() => setCircleSize("medium")}
              className="flex items-center gap-2"
            >
              <Circle className="h-4 w-4" />
              <span>Médio</span>
            </Button>
            <Button
              variant={circleSize === "large" ? "default" : "outline"}
              onClick={() => setCircleSize("large")}
              className="flex items-center gap-2"
            >
              <Circle className="h-5 w-5" />
              <span>Grande</span>
            </Button>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleUndo} disabled={annotations.length === 0}>
              Desfazer
            </Button>
            <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
              <Check className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
