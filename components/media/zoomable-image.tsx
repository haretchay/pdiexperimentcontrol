// SUBSTITUIR ARQUIVO COMPLETO: components/media/zoomable-image.tsx

"use client"

import { useCallback, useRef, useState, type PointerEvent, type WheelEvent } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Maximize2, Move, RotateCcw, ZoomIn, ZoomOut } from "lucide-react"

const DEFAULT_MIN_ZOOM = 1
const DEFAULT_MAX_ZOOM = 6

type Point = { x: number; y: number }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: Point, b: Point) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function roundZoom(value: number) {
  return Math.round(value * 100) / 100
}

/**
 * Visualizador de imagem em tela cheia/área total.
 * Desktop: scroll do mouse dá zoom; clicar e segurar arrasta.
 * Mobile: pinça dá zoom; arraste com dedo move a imagem.
 */
export function ZoomableImage({
  src,
  title,
  maxZoom = DEFAULT_MAX_ZOOM,
  minZoom = DEFAULT_MIN_ZOOM,
  initialZoom = 1,
  className,
}: {
  src: string
  title: string
  maxZoom?: number
  minZoom?: number
  initialZoom?: number
  className?: string
}) {
  const [zoom, setZoom] = useState(() => clamp(initialZoom, minZoom, maxZoom))
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const pointersRef = useRef(new Map<number, Point>())
  const lastPanPointRef = useRef<Point | null>(null)
  const pinchStartRef = useRef<{ distance: number; zoom: number; center: Point; position: Point } | null>(null)

  const reset = useCallback(() => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
    pointersRef.current.clear()
    lastPanPointRef.current = null
    pinchStartRef.current = null
    setIsDragging(false)
  }, [])

  const applyZoom = useCallback(
    (nextZoom: number, origin?: Point) => {
      setZoom((currentZoom) => {
        const clamped = roundZoom(clamp(nextZoom, minZoom, maxZoom))

        // Quando volta ao tamanho normal, centraliza novamente.
        if (clamped <= 1) {
          setPosition({ x: 0, y: 0 })
          return 1
        }

        // Aproxima o zoom do ponto usado pelo mouse/dedo, deixando a navegação mais natural.
        if (origin) {
          const ratio = clamped / Math.max(currentZoom, 0.01)
          setPosition((currentPosition) => ({
            x: origin.x - (origin.x - currentPosition.x) * ratio,
            y: origin.y - (origin.y - currentPosition.y) * ratio,
          }))
        }

        return clamped
      })
    },
    [maxZoom, minZoom],
  )

  function zoomIn() {
    applyZoom(zoom + 0.35)
  }

  function zoomOut() {
    applyZoom(zoom - 0.35)
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const origin = {
      x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2,
    }
    const delta = event.deltaY < 0 ? 0.35 : -0.35
    applyZoom(zoom + delta, origin)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = { x: event.clientX, y: event.clientY }
    pointersRef.current.set(event.pointerId, point)
    setIsDragging(true)

    if (pointersRef.current.size === 1) {
      lastPanPointRef.current = point
      pinchStartRef.current = null
      return
    }

    if (pointersRef.current.size === 2) {
      const points = Array.from(pointersRef.current.values())
      pinchStartRef.current = {
        distance: distance(points[0], points[1]),
        zoom,
        center: midpoint(points[0], points[1]),
        position,
      }
      lastPanPointRef.current = null
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return

    const nextPoint = { x: event.clientX, y: event.clientY }
    pointersRef.current.set(event.pointerId, nextPoint)

    if (pointersRef.current.size >= 2) {
      const points = Array.from(pointersRef.current.values())
      const pinchStart = pinchStartRef.current
      if (!pinchStart) return

      const currentDistance = distance(points[0], points[1])
      const currentCenter = midpoint(points[0], points[1])
      const nextZoom = clamp(pinchStart.zoom * (currentDistance / Math.max(pinchStart.distance, 1)), minZoom, maxZoom)

      setZoom(roundZoom(nextZoom))
      setPosition({
        x: pinchStart.position.x + (currentCenter.x - pinchStart.center.x),
        y: pinchStart.position.y + (currentCenter.y - pinchStart.center.y),
      })
      return
    }

    const lastPoint = lastPanPointRef.current
    if (!lastPoint) return

    const dx = nextPoint.x - lastPoint.x
    const dy = nextPoint.y - lastPoint.y
    lastPanPointRef.current = nextPoint

    if (zoom > 1) {
      setPosition((current) => ({ x: current.x + dx, y: current.y + dy }))
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId)

    if (pointersRef.current.size === 1) {
      lastPanPointRef.current = Array.from(pointersRef.current.values())[0] ?? null
      pinchStartRef.current = null
      return
    }

    if (pointersRef.current.size === 0) {
      lastPanPointRef.current = null
      pinchStartRef.current = null
      setIsDragging(false)
    }
  }

  function handleDoubleClick() {
    if (zoom > 1) reset()
    else applyZoom(Math.min(2.5, maxZoom))
  }

  return (
    <div className={cn("flex min-h-0 flex-col bg-slate-950 text-white", className)}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950/95 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-300 sm:text-sm">
          <Move className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="hidden truncate sm:inline">Scroll/pinça para zoom • Clique e arraste para mover</span>
          <span className="truncate sm:hidden">Pinça para zoom • arraste para mover</span>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" size="icon" variant="secondary" className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
            <span className="sr-only">Reduzir zoom</span>
          </Button>
          <div className="w-14 text-center text-xs font-semibold text-slate-200">{zoom.toFixed(2)}x</div>
          <Button type="button" size="icon" variant="secondary" className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
            <span className="sr-only">Aumentar zoom</span>
          </Button>
          <Button type="button" size="icon" variant="secondary" className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            <span className="sr-only">Resetar visualização</span>
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_38%),#020617]",
          zoom > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in",
        )}
        style={{ touchAction: "none" }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4">
          <img
            src={src || "/placeholder.svg"}
            alt={title}
            draggable={false}
            className="max-h-full max-w-full select-none object-contain shadow-2xl"
            style={{
              transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 120ms ease-out",
            }}
          />
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 hidden items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs text-slate-200 backdrop-blur sm:flex">
          <Maximize2 className="h-3.5 w-3.5" />
          Duplo clique para alternar zoom
        </div>
      </div>
    </div>
  )
}
