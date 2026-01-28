"use client"

import { useEffect, useMemo, useState } from "react"
import { PageTitle } from "@/components/page-title"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, ZoomIn, ZoomOut, Image as ImageIcon, RefreshCcw } from "lucide-react"

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
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
        >
          <ZoomOut className="h-4 w-4 mr-1" /> -
        </Button>

        <div className="flex-1">
          <Slider value={[zoom]} min={1} max={3} step={0.05} onValueChange={(v) => setZoom(v[0] ?? 1)} />
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
        >
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

function MediaThumb({
  title,
  dateLabel,
  url,
  dialogTitle,
}: {
  title: string
  dateLabel: string
  url: string | null
  dialogTitle: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{dateLabel}</div>
      </div>

      {url ? (
        <Dialog>
          <DialogTrigger asChild>
            <button className="w-full overflow-hidden rounded-md border bg-background hover:bg-accent transition">
              <img src={url} alt={title} className="w-full h-auto" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
            </DialogHeader>
            <ZoomableImage src={url} title={title} />
          </DialogContent>
        </Dialog>
      ) : (
        <div className="flex items-center gap-2 rounded-md border bg-background p-3 text-sm text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          Sem imagem mesclada.
        </div>
      )}
    </div>
  )
}

export function MediaPageClient({ initialExperiments }: { initialExperiments: MediaExperiment[] }) {
  const [selectedId, setSelectedId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [tests, setTests] = useState<MediaTest[] | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [onlyWithMedia, setOnlyWithMedia] = useState(false)

  const selected = useMemo(
    () => initialExperiments.find((e) => e.id === selectedId),
    [initialExperiments, selectedId]
  )

  const fetchMedia = async () => {
    if (!selectedId) return

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
      setTests(json.tests ?? [])
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Erro ao carregar mídias.")
    } finally {
      setLoading(false)
    }
  }

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
        if (!cancelled) setTests(json.tests ?? [])
      } catch (e: any) {
        if (!cancelled) setErrorMsg(e?.message ?? "Erro ao carregar mídias.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const stats = useMemo(() => {
    const list = tests ?? []
    const with7 = list.filter((t) => !!t.merged.day7?.url).length
    const with14 = list.filter((t) => !!t.merged.day14?.url).length
    const withAny = list.filter((t) => !!t.merged.day7?.url || !!t.merged.day14?.url).length
    return { total: list.length, with7, with14, withAny }
  }, [tests])

  const filtered = useMemo(() => {
    const list = tests ?? []
    const q = search.trim().toLowerCase()

    return list.filter((t) => {
      const hasAny = !!t.merged.day7?.url || !!t.merged.day14?.url
      if (onlyWithMedia && !hasAny) return false

      if (!q) return true

      const key = `${t.repetitionNumber} ${t.testNumber} ${t.strain ?? ""}`.toLowerCase()
      return key.includes(q)
    })
  }, [tests, search, onlyWithMedia])

  return (
    <div className="container mx-auto p-4">
      <PageTitle title="Mídias" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Selecionar experimento</CardTitle>
          <CardDescription>Visualize as fotos mescladas (mosaico) do 7º e 14º dia por teste.</CardDescription>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="text-muted-foreground">
                <strong className="text-foreground">Início:</strong>{" "}
                {new Date(selected.startDate).toLocaleDateString("pt-BR")}
              </div>
              <div className="text-muted-foreground">
                <strong className="text-foreground">Testes:</strong> {selected.testCount} •{" "}
                <strong className="text-foreground">Repetições:</strong> {selected.repetitionCount}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Total: {stats.total}</Badge>
                <Badge variant="secondary">7º: {stats.with7}</Badge>
                <Badge variant="secondary">14º: {stats.with14}</Badge>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Selecione um experimento para visualizar as mídias.</div>
          )}
        </CardContent>
      </Card>

      {selectedId ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-3 md:items-center">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por repetição, teste ou cepa..."
              className="md:max-w-sm"
            />
            <Button
              type="button"
              variant={onlyWithMedia ? "default" : "secondary"}
              onClick={() => setOnlyWithMedia((v) => !v)}
            >
              {onlyWithMedia ? "Mostrando só com mídia" : "Mostrar só com mídia"}
            </Button>

            <div className="flex-1" />

            <Button type="button" variant="secondary" onClick={fetchMedia} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
              Recarregar
            </Button>
          </CardContent>
        </Card>
      ) : null}

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
          {filtered.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Nenhuma mídia encontrada</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {tests.length === 0
                  ? "Ainda não há registros para este experimento."
                  : "Nenhum item corresponde aos filtros atuais."}
              </CardContent>
            </Card>
          ) : (
            filtered.map((t) => {
              const any = !!t.merged.day7?.url || !!t.merged.day14?.url
              return (
                <Card key={t.id} className={any ? "" : "opacity-90"}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Repetição {t.repetitionNumber} • Teste {t.testNumber}
                      {t.strain ? <span className="text-muted-foreground"> — {t.strain}</span> : null}
                    </CardTitle>
                    <CardDescription>
                      {any ? (
                        <span className="text-muted-foreground">Mosaicos disponíveis.</span>
                      ) : (
                        <span className="text-muted-foreground">Sem mosaicos ainda (salve fotos para gerar).</span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <MediaThumb
                        title="7º dia (mesclado)"
                        dateLabel={`Data: ${fmtDate(t.date7Day)}`}
                        url={t.merged.day7?.url ?? null}
                        dialogTitle={`Repetição ${t.repetitionNumber} • Teste ${t.testNumber} — 7º dia (mesclado)`}
                      />
                      <MediaThumb
                        title="14º dia (mesclado)"
                        dateLabel={`Data: ${fmtDate(t.date14Day)}`}
                        url={t.merged.day14?.url ?? null}
                        dialogTitle={`Repetição ${t.repetitionNumber} • Teste ${t.testNumber} — 14º dia (mesclado)`}
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
