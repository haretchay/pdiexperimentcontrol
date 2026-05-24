"use client"

import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent } from "react"
import { Button } from "@/components/ui/button"
import { Maximize2, Minus, Move, Plus, RotateCcw } from "lucide-react"

type Point = {
  x: number
  y: number
}

type ActivePointer = Point & {
  id: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundZoom(value: number) {
  return Number(value.toFixed(2))
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function center(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  }
}

/**
 * Visualizador de imagem com zoom por scroll, pinça no celular e arraste.
 * Mantém a mesma assinatura usada pelas páginas de Mídias e Visualização do Teste.
 */
export function ZoomableImage({
  src,
  title,
  maxZoom = 5,
  minZoom = 1,
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
  const initial = clamp(initialZoom, minZoom, maxZoom)
  const [zoom, setZoom] = useState(initial)
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isPinching, setIsPinching] = useState(false)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const activePointersRef = useRef<Map<number, ActivePointer>>(new Map())
  const lastDragPointRef = useRef<Point | null>(null)
  const pinchStartRef = useRef<{
    distance: number
    zoom: number
    position: Point
    center: Point
  } | null>(null)

  const zoomLabel = useMemo(() => `${zoom.toFixed(2)}x`, [zoom])

  const resetView = useCallback(() => {
    setZoom(initial)
    setPosition({ x: 0, y: 0 })
    setIsDragging(false)
    setIsPinching(false)
    activePointersRef.current.clear()
    lastDragPointRef.current = null
    pinchStartRef.current = null
  }, [initial])

  const setZoomFromPoint = useCallback(
    (nextZoomValue: number, point: Point | null) => {
      const viewport = viewportRef.current
      const nextZoom = roundZoom(clamp(nextZoomValue, minZoom, maxZoom))

      setZoom((currentZoom) => {
        if (!viewport || !point || nextZoom === currentZoom) return nextZoom

        const rect = viewport.getBoundingClientRect()
        const localPoint = {
          x: point.x - rect.left,
          y: point.y - rect.top,
        }

        setPosition((currentPosition) => {
          const contentPoint = {
            x: (localPoint.x - currentPosition.x) / currentZoom,
            y: (localPoint.y - currentPosition.y) / currentZoom,
          }

          return {
            x: localPoint.x - contentPoint.x * nextZoom,
            y: localPoint.y - contentPoint.y * nextZoom,
          }
        })

        return nextZoom
      })
    },
    [maxZoom, minZoom],
  )

  const changeZoom = useCallback(
    (delta: number, point: Point | null = null) => {
      setZoomFromPoint(zoom + delta, point)
    },
    [setZoomFromPoint, zoom],
  )

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault()
      const direction = event.deltaY > 0 ? -1 : 1
      const step = event.ctrlKey ? 0.08 : 0.18
      setZoomFromPoint(zoom + direction * step, { x: event.clientX, y: event.clientY })
    },
    [setZoomFromPoint, zoom],
  )

  const getActivePointers = useCallback(() => Array.from(activePointersRef.current.values()), [])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    const pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
    activePointersRef.current.set(event.pointerId, pointer)

    const active = getActivePointers()
    if (active.length === 1) {
      setIsDragging(true)
      setIsPinching(false)
      lastDragPointRef.current = pointer
      return
    }

    if (active.length >= 2) {
      const [a, b] = active
      setIsDragging(false)
      setIsPinching(true)
      lastDragPointRef.current = null
      pinchStartRef.current = {
        distance: Math.max(distance(a, b), 1),
        zoom,
        position,
        center: center(a, b),
      }
    }
  }, [getActivePointers, position, zoom])

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!activePointersRef.current.has(event.pointerId)) return
      event.preventDefault()

      activePointersRef.current.set(event.pointerId, {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      })

      const active = getActivePointers()

      if (active.length >= 2 && pinchStartRef.current) {
        const [a, b] = active
        const currentDistance = Math.max(distance(a, b), 1)
        const pinchStart = pinchStartRef.current
        const nextZoom = roundZoom(clamp(pinchStart.zoom * (currentDistance / pinchStart.distance), minZoom, maxZoom))
        const currentCenter = center(a, b)
        const viewport = viewportRef.current

        if (!viewport) {
          setZoom(nextZoom)
          return
        }

        const rect = viewport.getBoundingClientRect()
        const startLocalCenter = {
          x: pinchStart.center.x - rect.left,
          y: pinchStart.center.y - rect.top,
        }
        const currentLocalCenter = {
          x: currentCenter.x - rect.left,
          y: currentCenter.y - rect.top,
        }
        const contentPoint = {
          x: (startLocalCenter.x - pinchStart.position.x) / pinchStart.zoom,
          y: (startLocalCenter.y - pinchStart.position.y) / pinchStart.zoom,
        }

        setZoom(nextZoom)
        setPosition({
          x: currentLocalCenter.x - contentPoint.x * nextZoom,
          y: currentLocalCenter.y - contentPoint.y * nextZoom,
        })
        return
      }

      if (active.length === 1 && lastDragPointRef.current) {
        const last = lastDragPointRef.current
        const current = active[0]
        const delta = {
          x: current.x - last.x,
          y: current.y - last.y,
        }

        setPosition((currentPosition) => ({
          x: currentPosition.x + delta.x,
          y: currentPosition.y + delta.y,
        }))
        lastDragPointRef.current = current
      }
    },
    [getActivePointers, maxZoom, minZoom],
  )

  const finishPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const active = getActivePointers()

    if (active.length === 1) {
      setIsDragging(true)
      setIsPinching(false)
      lastDragPointRef.current = active[0]
      pinchStartRef.current = null
      return
    }

    if (active.length === 0) {
      setIsDragging(false)
      setIsPinching(false)
      lastDragPointRef.current = null
      pinchStartRef.current = null
    }
  }, [getActivePointers])

  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const targetZoom = zoom > minZoom + 0.2 ? minZoom : Math.min(maxZoom, 2.5)
      setZoomFromPoint(targetZoom, { x: event.clientX, y: event.clientY })
    },
    [maxZoom, minZoom, setZoomFromPoint, zoom],
  )

  const cursorClass = isDragging || isPinching ? "cursor-grabbing" : "cursor-grab"

  return (
    <div className={"space-y-3 " + (className ?? "")}>
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">
            <Move className="h-4 w-4" />
          </span>
          <div>
            <div className="font-semibold text-slate-900 dark:text-white">Zoom e navegação</div>
            <div>Mouse: role para zoom e arraste a imagem. Celular: pinça e arraste com os dedos.</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="icon" className="h-9 w-9 rounded-xl" onClick={() => changeZoom(-0.25)} aria-label="Diminuir zoom">
            <Minus className="h-4 w-4" />
          </Button>
          <div className="min-w-16 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            {zoomLabel}
          </div>
          <Button type="button" variant="secondary" size="icon" className="h-9 w-9 rounded-xl" onClick={() => changeZoom(0.25)} aria-label="Aumentar zoom">
            <Plus className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl" onClick={resetView}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Resetar
          </Button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`relative h-[70vh] min-h-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-inner dark:border-slate-800 ${cursorClass}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onDoubleClick={handleDoubleClick}
        style={{ touchAction: "none" }}
      >
        <div
          className="absolute left-0 top-0 will-change-transform"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          <img
            src={src}
            alt={title}
            draggable={false}
            className="block max-h-[70vh] max-w-full select-none object-contain"
          />
        </div>

        <div className="pointer-events-none absolute bottom-3 right-3 hidden items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur sm:flex">
          <Maximize2 className="h-3.5 w-3.5" />
          Duplo clique alterna o zoom
        </div>
      </div>
    </div>
  )
}
