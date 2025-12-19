"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider.tsx"
import { ZoomIn, ZoomOut, Zap, ZapOff, X, CameraIcon, RefreshCw } from "lucide-react"

interface CameraInterfaceProps {
  onCapture: (imageSrc: string) => void
  onClose: () => void
  photoCount?: number
  currentPhotoIndex?: number
}

export function CameraInterface({ onCapture, onClose, photoCount = 6, currentPhotoIndex = 0 }: CameraInterfaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isFlashOn, setIsFlashOn] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [hasCamera, setHasCamera] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null)

  // Initialize camera
  useEffect(() => {
    async function setupCamera() {
      try {
        setIsLoading(true)

        // Limpar stream anterior se existir
        if (stream) {
          stream.getTracks().forEach((track) => track.stop())
        }

        // Tentar obter a lista de dispositivos de mídia disponíveis
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter((device) => device.kind === "videoinput")

        // Definir as constraints com base no facingMode atual
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        }

        // Se não houver câmeras ou apenas uma, simplificar as constraints
        if (videoDevices.length <= 1) {
          constraints.video = {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
        setHasCameraPermission(true)

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          setStream(mediaStream)
          setHasCamera(true)

          // Wait for video to be ready
          videoRef.current.onloadedmetadata = () => {
            setIsLoading(false)
            setIsCameraReady(true)
          }
        }
      } catch (error) {
        console.error("Error accessing camera:", error)

        // Tentar novamente com constraints mais simples se falhar
        try {
          const simpleConstraints = {
            video: true,
            audio: false,
          }

          const simpleStream = await navigator.mediaDevices.getUserMedia(simpleConstraints)
          setHasCameraPermission(true)

          if (videoRef.current) {
            videoRef.current.srcObject = simpleStream
            setStream(simpleStream)
            setHasCamera(true)

            videoRef.current.onloadedmetadata = () => {
              setIsLoading(false)
              setIsCameraReady(true)
            }
          }
        } catch (fallbackError) {
          console.error("Fallback camera access also failed:", fallbackError)
          setHasCameraPermission(false)
          setHasCamera(false)
          setIsLoading(false)
        }
      }
    }

    setupCamera()

    // Cleanup function
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [facingMode])

  // Toggle camera function
  const toggleCamera = async () => {
    setIsLoading(true)
    setIsCameraReady(false)
    setFacingMode(facingMode === "environment" ? "user" : "environment")
    // A câmera será reinicializada no useEffect
  }

  // Apply zoom effect
  useEffect(() => {
    if (videoRef.current && isCameraReady) {
      videoRef.current.style.transform = `scale(${zoomLevel})`
    }
  }, [zoomLevel, isCameraReady])

  // Apply flash effect
  useEffect(() => {
    if (isFlashOn && isCameraReady) {
      // Simulate flash with a white overlay
      // In a real app, you would use the torch/flash if available
      const track = stream?.getVideoTracks()[0]
     const capabilities = track?.getCapabilities()

if (capabilities && "torch" in capabilities) {
  track
    ?.applyConstraints({
      advanced: [{ torch: false }] as any,
    })
    .catch(() => {})
}

    } else if (stream && isCameraReady) {
      const track = stream.getVideoTracks()[0]
      if (track) {
        track
  ?.applyConstraints({
    advanced: [{ torch: false }] as any,
  })
  .catch(() => {})

      }
    }
  }, [isFlashOn, stream, isCameraReady])

  const capturePhoto = () => {
    try {
      if (videoRef.current && canvasRef.current && isCameraReady) {
        const video = videoRef.current
        const canvas = canvasRef.current
        const context = canvas.getContext("2d")

        if (context) {
          // Set canvas dimensions to match video
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight

          // Draw the current video frame to the canvas
          context.drawImage(video, 0, 0, canvas.width, canvas.height)

          // Convert canvas to data URL with error handling
          try {
            const imageSrc = canvas.toDataURL("image/jpeg", 0.8)
            if (imageSrc && imageSrc.startsWith("data:image/")) {
              onCapture(imageSrc)
            } else {
              console.error("Formato de imagem inválido")
              alert("Erro ao capturar foto. Por favor, tente novamente.")
            }
          } catch (e) {
            console.error("Erro ao converter canvas para imagem:", e)
            alert("Erro ao processar a imagem capturada. Por favor, tente novamente.")
          }
        }
      }
    } catch (error) {
      console.error("Erro ao capturar foto:", error)
      alert("Ocorreu um erro ao capturar a foto. Por favor, tente novamente.")
    }
  }

  const handleZoomChange = (value: number[]) => {
    setZoomLevel(value[0])
  }

  // Mensagem de erro personalizada com base no tipo de erro
  if (!hasCamera || hasCameraPermission === false) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-4">
        <div className="bg-background rounded-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-bold mb-4">Câmera não disponível</h2>
          <p className="mb-4">
            {hasCameraPermission === false
              ? "Permissão para acessar a câmera foi negada. Por favor, verifique as configurações do seu navegador e permita o acesso à câmera."
              : "Não foi possível acessar a câmera do dispositivo. Verifique se seu dispositivo possui uma câmera funcional ou tente em outro dispositivo."}
          </p>
          <Button onClick={onClose} className="w-full">
            Fechar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Camera preview */}
      <div className="relative flex-1 overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute w-full h-full object-cover"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: "center",
          }}
        />

        <canvas ref={canvasRef} className="hidden" />

        {/* Flash effect overlay */}
        {isFlashOn && <div className="absolute inset-0 bg-white bg-opacity-20 pointer-events-none"></div>}

        {/* Photo counter */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
          Foto {currentPhotoIndex + 1} de {photoCount}
        </div>

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 bg-black/50 text-white hover:bg-black/70"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Controls */}
      <div className="bg-black p-4 flex flex-col gap-4">
        {/* Zoom controls */}
        <div className="flex items-center gap-2 px-4">
          <ZoomOut className="h-4 w-4 text-white" />
          <Slider value={[zoomLevel]} min={1} max={3} step={0.1} onValueChange={handleZoomChange} className="flex-1" />
          <ZoomIn className="h-4 w-4 text-white" />
          <span className="text-white text-sm ml-2">{zoomLevel.toFixed(1)}x</span>
        </div>

        {/* Bottom controls */}
        <div className="flex justify-between items-center px-8">
          {/* Flash toggle */}
          <Button variant="ghost" size="icon" className="text-white" onClick={() => setIsFlashOn(!isFlashOn)}>
            {isFlashOn ? <Zap className="h-6 w-6" /> : <ZapOff className="h-6 w-6" />}
          </Button>

          {/* Capture button */}
          <Button
            variant="outline"
            size="icon"
            className="h-16 w-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/30"
            onClick={capturePhoto}
            disabled={!isCameraReady || isLoading}
          >
            <CameraIcon className="h-8 w-8 text-white" />
          </Button>

          {/* Toggle camera button */}
          <Button variant="ghost" size="icon" className="text-white" onClick={toggleCamera} disabled={isLoading}>
            <RefreshCw className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  )
}
