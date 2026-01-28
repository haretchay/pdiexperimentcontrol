"use client"

import { useEffect, useMemo, useState } from "react"
import { PageTitle } from "@/components/page-title"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Loader2, ZoomIn, ZoomOut } from "lucide-react"

type MediaExperiment = {
  id: string
  number: string
  strain: string
  startDate: string
  testCount: number
  repetitionCount: number
}

type MediaTest = {
  id: string
  repetitionNumber: number
  testNumber: number
  strain: string | null
  date7Day: string | null
  date14Day: string | null
  merged: {
    day7: null | { url: string | null; storagePath: string; createdAt: string }
    day14: null | { url: string | null; storagePath: string; createdAt: string }
  }
}

function fmtDate(d?: string | null) {
  if (!d) return "—"
  try {
    return new Date(d).toLocaleDateString("pt-BR")
  } catch {
    return "—"
  }
}

function ZoomableImage({ src, title }: { src: string; title: string }) {
  const [zoom, setZoom] = useState(1)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}>
          <ZoomOut className="h-4 w-4 mr-1" /> -
        </Button>

        <div className="flex-1">
          <Slider value={[zoom]} min={1} max={3} step={0.05} onValueChange={(v) => setZoom(v[0] ?? 1)} />
        </div>

        <Button type="button" variant="secondary" size="sm" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}>
          <ZoomIn className="h-4 w-4 mr-1" /> +
        </Button>

        <div className="text-xs text-muted-foreground w-14 text-right">{zoom.toFixed(2)}x</div>
      </div>

      <div className="overflow-auto rounded-md border bg-background">
        <div className="p-2">
          <img
            src={src}
            alt={title}
            className="block max-h-[70vh] w-auto origin-top-left"
            style={{ transform: `scale(${zoom})` }}
          />
        </div>
      </div>
    </div>
  )
}

export function MediaPageClient({ initialExperiments }: { initialExperiments: MediaExperiment[] }) {
  const [selectedId, setSelectedId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [tests, setTests] = useState<MediaTest[] | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const selected = useMemo(
    () => initialExperiments.find((e) => e.id === selectedId),
    [initialExperiments, selectedId]
  )

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!selectedId) {
        setTests(null)
        setErrorMsg(null)
        return
      }

      setLoading(true)
      setErrorMsg(null)
      setTests(null)

      try {
        const res = await fetch(`/api/media/experiment/${selectedId}`, { cache: "no-store" })
        if (!res.ok) {
          const txt = await res.text()
          if (txt.includes("rate_limit")) {
            throw new Error("Muitas requisições ao Supabase (429). Aguarde alguns segundos e tente novamente.")
          }
          throw new Error("Falha ao carregar mídias.")
        }

        const json = (await res.json()) as { tests: MediaTest[] }
        if (cancelled) return
        setTests(json.tests ?? [])
      } catch (e: any) {
        if (cancelled) return
        setErrorMsg(e?.message ?? "Erro ao carregar mídias.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  return (
    <div className="container mx-auto p-4">
      <PageTitle title="Mídias" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Selecionar experimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Selecione um experimento" />
            </SelectTrigger>
            <SelectContent>
              {initialExperiments.map((exp) => (
                <SelectItem key={exp.id} value={exp.id}>
                  #{exp.number} — {exp.strain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selected ? (
            <div className="text-sm text-muted-foreground">
              <div>
                <strong>Início:</strong> {new Date(selected.startDate).toLocaleDateString("pt-BR")}
              </div>
              <div>
                <strong>Testes:</strong> {selected.testCount} | <strong>Repetições:</strong> {selected.repetitionCount}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Selecione um experimento para visualizar as mídias.</div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando mídias...
        </div>
      ) : null}

      {errorMsg ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Erro</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{errorMsg}</CardContent>
        </Card>
      ) : null}

      {tests ? (
        <div className="space-y-4">
          {tests.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Nenhuma mídia</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Ainda não há imagens mescladas (merged) para este experimento.
              </CardContent>
            </Card>
          ) : (
            tests.map((t) => (
              <Card key={t.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    Repetição {t.repetitionNumber} • Teste {t.testNumber}
                    {t.strain ? <span className="text-muted-foreground"> — {t.strain}</span> : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">7º dia</div>
                      <div className="text-xs text-muted-foreground">Data: {fmtDate(t.date7Day)}</div>

                      {t.merged.day7?.url ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="w-full overflow-hidden rounded-md border bg-background hover:bg-accent transition">
                              <img src={t.merged.day7.url} alt="7º dia (mesclado)" className="w-full h-auto" />
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl">
                            <DialogHeader>
                              <DialogTitle>
                                Repetição {t.repetitionNumber} • Teste {t.testNumber} — 7º dia (mesclado)
                              </DialogTitle>
                            </DialogHeader>
                            <ZoomableImage src={t.merged.day7.url} title="7º dia (mesclado)" />
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <div className="text-sm text-muted-foreground">Sem imagem mesclada.</div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">14º dia</div>
                      <div className="text-xs text-muted-foreground">Data: {fmtDate(t.date14Day)}</div>

                      {t.merged.day14?.url ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="w-full overflow-hidden rounded-md border bg-background hover:bg-accent transition">
                              <img src={t.merged.day14.url} alt="14º dia (mesclado)" className="w-full h-auto" />
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl">
                            <DialogHeader>
                              <DialogTitle>
                                Repetição {t.repetitionNumber} • Teste {t.testNumber} — 14º dia (mesclado)
                              </DialogTitle>
                            </DialogHeader>
                            <ZoomableImage src={t.merged.day14.url} title="14º dia (mesclado)" />
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <div className="text-sm text-muted-foreground">Sem imagem mesclada.</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
