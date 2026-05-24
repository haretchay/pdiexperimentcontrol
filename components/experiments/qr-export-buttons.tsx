"use client"

import { useMemo, useState } from "react"
import jsPDF from "jspdf"
import QRCode from "qrcode"
import { Download, QrCode } from "lucide-react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"

type QrTestItem = {
  repetitionNumber: number
  testNumber: number
  strain: string | null
  testLot: string | null
  matrixLot: string | null
}

type Props = {
  experimentId: string
  experimentNumber: number
  experimentStrain: string | null
  tests: QrTestItem[]
}

function buildTestUrl(origin: string, experimentId: string, repetitionNumber: number, testNumber: number) {
  return `${origin}/experiments/${experimentId}/repetition/${repetitionNumber}/test/${testNumber}/view`
}

function legendLine(expNumber: number, t: QrTestItem) {
  const strain = t.strain ?? "-"
  const testLot = t.testLot ?? "-"
  const matrixLot = t.matrixLot ?? "-"
  return `Exp #${String(expNumber).padStart(3, "0")} • Rep ${t.repetitionNumber} • Teste ${t.testNumber}\nCepa: ${strain} • Lote teste: ${testLot} • Lote matriz: ${matrixLot}`
}

export function ExportExperimentQRCodesButton({ experimentId, experimentNumber, experimentStrain, tests }: Props) {
  const [busy, setBusy] = useState(false)

  const sorted = useMemo(() => {
    return [...(tests ?? [])].sort((a, b) => {
      if (a.repetitionNumber !== b.repetitionNumber) return a.repetitionNumber - b.repetitionNumber
      return a.testNumber - b.testNumber
    })
  }, [tests])

  async function handleExport() {
    try {
      setBusy(true)

      if (!sorted.length) {
        toast({ title: "Sem testes", description: "Este experimento ainda não possui testes para gerar QR Code." })
        return
      }

      const origin = window.location.origin

      // PDF em A4 (mm). Grid 2 colunas x 3 linhas por página.
      const doc = new jsPDF({ unit: "mm", format: "a4" })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()

      const marginX = 12
      const marginTop = 14
      const gapX = 10
      const gapY = 12

      const cols = 2
      const rows = 3
      const cellW = (pageW - marginX * 2 - gapX * (cols - 1)) / cols
      const cellH = (pageH - marginTop * 2 - gapY * (rows - 1)) / rows

      const qrSize = Math.min(48, cellW) // mm
      const legendFont = 9

      // Cabeçalho
      doc.setFontSize(14)
      const expStr = `Experimento #${String(experimentNumber).padStart(3, "0")}`
      const strainStr = experimentStrain ? ` — ${experimentStrain}` : ""
      doc.text(`${expStr}${strainStr}`, marginX, 10)

      let idx = 0
      for (const t of sorted) {
        const pageIndex = Math.floor(idx / (cols * rows))
        const posInPage = idx % (cols * rows)

        if (idx > 0 && posInPage === 0) {
          doc.addPage()
          doc.setFontSize(14)
          doc.text(`${expStr}${strainStr}`, marginX, 10)
        }

        const col = posInPage % cols
        const row = Math.floor(posInPage / cols)

        const x0 = marginX + col * (cellW + gapX)
        const y0 = marginTop + row * (cellH + gapY)

        const url = buildTestUrl(origin, experimentId, t.repetitionNumber, t.testNumber)
        const qrDataUrl = await QRCode.toDataURL(url, {
          margin: 1,
          errorCorrectionLevel: "M",
          width: 512,
        })

        const qrX = x0 + (cellW - qrSize) / 2
        const qrY = y0 + 2

        doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize)

        doc.setFontSize(legendFont)
        const legend = legendLine(experimentNumber, t)
        const legendY = qrY + qrSize + 6
        const lines = doc.splitTextToSize(legend, cellW)
        doc.text(lines, x0 + 2, legendY)

        // Borda leve para cada item
        doc.setDrawColor(220)
        doc.roundedRect(x0, y0, cellW, cellH, 2, 2)

        idx++
      }

      doc.save(`experimento_${String(experimentNumber).padStart(3, "0")}_qrcodes.pdf`)
    } catch (e: any) {
      console.error(e)
      toast({
        title: "Erro ao gerar QR Codes",
        description: e?.message ?? "Não foi possível gerar o PDF.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      onClick={handleExport}
      disabled={busy}
      variant="outline"
      className="gap-2 rounded-xl border-white/40 bg-white text-blue-700 shadow-sm hover:bg-blue-50 hover:text-blue-800 dark:border-slate-700 dark:bg-slate-950 dark:text-blue-200 dark:hover:bg-slate-900 dark:hover:text-blue-100"
    >
      <QrCode className="h-4 w-4" />
      <span className="hidden sm:inline">Exportar QR Codes</span>
      <span className="sm:hidden">QR</span>
      {busy ? <Download className="h-4 w-4 opacity-40" /> : null}
    </Button>
  )
}

// Backwards-compatible alias (older pages imported `QrExportButtons`).
export const QrExportButtons = ExportExperimentQRCodesButton
