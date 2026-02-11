// SUBSTITUIR ARQUIVO COMPLETO: components/media/zoomable-image.tsx

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ZoomIn, ZoomOut } from "lucide-react"

/**
 * Zoom simples (slider + botões) usando CSS transform.
 * Usado na página de Mídias e na visualização do Teste.
 */
export function ZoomableImage({
  src,
  title,
  maxZoom = 3,
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
  const [zoom, setZoom] = useState(initialZoom)

  return (
    <div className={"space-y-3 " + (className ?? "")}> 
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setZoom((z) => Math.max(minZoom, +(z - 0.25).toFixed(2)))}
        >
          <ZoomOut className="h-4 w-4 mr-1" /> -
        </Button>

        <div className="flex-1">
          <Slider
            value={[zoom]}
            min={minZoom}
            max={maxZoom}
            step={0.05}
            onValueChange={(v) => setZoom(v[0] ?? 1)}
          />
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setZoom((z) => Math.min(maxZoom, +(z + 0.25).toFixed(2)))}
        >
          <ZoomIn className="h-4 w-4 mr-1" /> +
        </Button>

        <div className="text-xs text-muted-foreground w-14 text-right">{zoom.toFixed(2)}x</div>
      </div>

      <div className="overflow-auto rounded-md border bg-background">
        <div className="p-2">
          {/* img (e não next/image) para permitir transform scale com origin */}
          <img
            src={src}
            alt={title}
            className="block w-auto max-h-[78vh] origin-top-left"
            style={{ transform: `scale(${zoom})` }}
          />
        </div>
      </div>
    </div>
  )
}
