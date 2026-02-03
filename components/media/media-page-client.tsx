"use client"

import { useEffect, useMemo, useState } from "react"
import { PageTitle } from "@/components/page-title"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
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
    day7: null | { url: string | null; missing: boolean; storagePath: string; createdAt: string }
    day14: null | { url: string | null; missing: boolean; storagePath: string; createdAt: string }
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

function MediaCard({
  title,
  date,
  item,
  dialogTitle,
}: {
  title: string
  date: string
  item: MediaTest["merged"]["day7"]
  dialogTitle: string
}) {
  if (!item) return <div className="text-sm text-muted-foreground">Sem imagem mesclada.</div>

  if (item.missing) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">Data: {date}</div>
        <div className="text-sm text-muted-foreground">
          Arquivo não encontrado no Storage (referência antiga no banco).
        </div>
      </div>
    )
  }

  if (!item.url) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">Data: {date}</div>
        <div className="text-sm text-muted-foreground">Sem URL para exibir.</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">Data: {date}</div>

      <Dialog>
        <DialogTrigger asChild>
          <button className="w-full overflow-hidden rounded-md border bg-background hover:bg-accent transition">
            <img src={item.url} alt={title} className="w-full h-auto" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <ZoomableImage src={item.url} title={title} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function MediaPageClient({ initialExperiments }: { initialExperiments: MediaExperiment[] }) {
  const [selectedId, setSelectedId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [tests, setTests] = useState<MediaTest[] | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [onlyWithMedia, setOnlyWithMedia] = useState(true)

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
            throw new Error("Muitas requisições ao Supabase (429). Aguarde alguns segundos e recarregue.")
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

  const filtered = useMemo(() => {
    const list = tests ?? []
    const q = query.trim().toLowerCase()

    return list
      .filter((t) => {
        const hasMedia = Boolean(t.merged.day7?.url || t.merged.day14?.url) && !(t.merged.day7?.missing || t.merged.day14?.missing)
        if (onlyWithMedia && !hasMedia) return false
        if (!q) return true

        const key = `rep ${t.repetitionNumber} teste ${t.testNumber} ${(t.strain ?? "").toLowerCase()}`
        return key.includes(q)
      })
  }, [tests, query, onlyWithMedia])

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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              placeholder="Buscar (ex: rep 1, teste 2, cepa...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <div className="flex items-center gap-2 md:justify-center">
              <Switch checked={onlyWithMedia} onCheckedChange={setOnlyWithMedia} id="onlyWithMedia" />
              <Label htmlFor="onlyWithMedia" className="text-sm">
                Mostrar só com mídia
              </Label>
            </div>

            <div className="flex md:justify-end">
              <Button variant="secondary" onClick={() => { setQuery(""); setOnlyWithMedia(true) }}>
                Limpar filtros
              </Button>
            </div>
          </div>
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
          {filtered.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Nenhuma mídia</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Não há imagens mescladas (merged) para o filtro atual.
              </CardContent>
            </Card>
          ) : (
            filtered.map((t) => (
              <Card key={t.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    Repetição {t.repetitionNumber} • Teste {t.testNumber}
                    {t.strain ? <span className="text-muted-foreground"> — {t.strain}</span> : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <MediaCard
                      title="7º dia (mesclado)"
                      date={fmtDate(t.date7Day)}
                      item={t.merged.day7}
                      dialogTitle={`Repetição ${t.repetitionNumber} • Teste ${t.testNumber} — 7º dia (mesclado)`}
                    />

                    <MediaCard
                      title="14º dia (mesclado)"
                      date={fmtDate(t.date14Day)}
                      item={t.merged.day14}
                      dialogTitle={`Repetição ${t.repetitionNumber} • Teste ${t.testNumber} — 14º dia (mesclado)`}
                    />
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
