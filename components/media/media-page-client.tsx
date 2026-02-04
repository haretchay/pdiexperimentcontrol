"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, ZoomIn } from "lucide-react"
import { ZoomableImage } from "@/components/media/zoomable-image"

type MediaPhoto = {
  id: string
  day: 7 | 14
  storagePath: string
  url: string | null
  missing: boolean
  createdAt: string
  experiment: {
    id: string
    number: number
    strain: string | null
    startDate: string | null
  }
  test: {
    id: string
    repetitionNumber: number
    testNumber: number
    strain: string | null
    unit: string | null
    testLot: string | null
    matrixLot: string | null
    date7Day: string | null
    date14Day: string | null
    wetWeight: number | null
    dryWeight: number | null
    extractedConidiumWeight: number | null
  }
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "-"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString("pt-BR")
}

function fmtNum(v: number | null | undefined, suffix = " g") {
  if (v === null || v === undefined) return "-"
  const n = Number(v)
  if (Number.isNaN(n)) return "-"
  return `${n}${suffix}`
}

function expLabel(n: number) {
  return `#${String(n).padStart(3, "0")}`
}

function monthKey(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${d.getFullYear()}-${m}`
}

function weekKey(iso: string) {
  // ISO week (simplificado)
  const d0 = new Date(iso)
  if (Number.isNaN(d0.getTime())) return ""
  const d = new Date(Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}

type SortKey = "newest" | "oldest" | "wet_desc" | "dry_desc" | "conidium_desc"

export function MediaPageClient() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<MediaPhoto[]>([])
  const [error, setError] = useState<string | null>(null)

  // filtros
  const [q, setQ] = useState("")
  const [expId, setExpId] = useState("all")
  const [month, setMonth] = useState("all")
  const [week, setWeek] = useState("all")
  const [sort, setSort] = useState<SortKey>("newest")

  useEffect(() => {
    let mounted = true

    async function run() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch("/api/media/all", { method: "GET" })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `HTTP ${res.status}`)
        }
        const json = await res.json()
        const photos: MediaPhoto[] = Array.isArray(json?.photos) ? json.photos : []
        if (mounted) setItems(photos)
      } catch (e: any) {
        console.error("[media] fetch error:", e)
        if (mounted) setError(e?.message ?? "Erro ao carregar mídias.")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    run()
    return () => {
      mounted = false
    }
  }, [])

  const experiments = useMemo(() => {
    const map = new Map<string, { id: string; number: number; strain: string | null }>()
    for (const p of items) map.set(p.experiment.id, { id: p.experiment.id, number: p.experiment.number, strain: p.experiment.strain })
    return Array.from(map.values()).sort((a, b) => a.number - b.number)
  }, [items])

  const months = useMemo(() => {
    const set = new Set<string>()
    for (const p of items) set.add(monthKey(p.createdAt))
    return Array.from(set.values()).filter(Boolean).sort((a, b) => (a < b ? 1 : -1))
  }, [items])

  const weeks = useMemo(() => {
    const set = new Set<string>()
    for (const p of items) set.add(weekKey(p.createdAt))
    return Array.from(set.values()).filter(Boolean).sort((a, b) => (a < b ? 1 : -1))
  }, [items])

  const filtered = useMemo(() => {
    const qn = q.trim().toLowerCase()
    let arr = items.filter((p) => {
      // sem toggle: sempre mostrar só com mídia
      if (!p.url) return false

      if (expId !== "all" && p.experiment.id !== expId) return false
      if (month !== "all" && monthKey(p.createdAt) !== month) return false
      if (week !== "all" && weekKey(p.createdAt) !== week) return false

      if (!qn) return true

      const hay = [
        expLabel(p.experiment.number),
        p.experiment.strain ?? "",
        p.test.strain ?? "",
        p.test.testLot ?? "",
        p.test.matrixLot ?? "",
        String(p.test.repetitionNumber),
        String(p.test.testNumber),
        String(p.test.unit ?? ""),
      ]
        .join(" ")
        .toLowerCase()

      return hay.includes(qn)
    })

    const byCreated = (a: MediaPhoto, b: MediaPhoto) => {
      const da = new Date(a.createdAt).getTime()
      const db = new Date(b.createdAt).getTime()
      return db - da
    }

    if (sort === "newest") arr = arr.slice().sort(byCreated)
    if (sort === "oldest") arr = arr.slice().sort((a, b) => -byCreated(a, b))
    if (sort === "wet_desc") arr = arr.slice().sort((a, b) => (b.test.wetWeight ?? -Infinity) - (a.test.wetWeight ?? -Infinity) || byCreated(a, b))
    if (sort === "dry_desc") arr = arr.slice().sort((a, b) => (b.test.dryWeight ?? -Infinity) - (a.test.dryWeight ?? -Infinity) || byCreated(a, b))
    if (sort === "conidium_desc") {
      arr = arr.slice().sort(
        (a, b) =>
          (b.test.extractedConidiumWeight ?? -Infinity) - (a.test.extractedConidiumWeight ?? -Infinity) || byCreated(a, b)
      )
    }

    return arr
  }, [items, q, expId, month, week, sort])

  const clear = () => {
    setQ("")
    setExpId("all")
    setMonth("all")
    setWeek("all")
    setSort("newest")
  }

  return (
    <div className="container mx-auto max-w-7xl py-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Mídias</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{filtered.length} fotos</Badge>
            <Button variant="outline" onClick={clear} disabled={loading}>
              Limpar filtros
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4">
              <Label className="text-sm">Buscar</Label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Digite cepa, exp (#001), lote, rep, teste..." />
            </div>

            <div className="md:col-span-3">
              <Label className="text-sm">Experimento</Label>
              <Select value={expId} onValueChange={setExpId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {experiments.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {expLabel(e.number)} {e.strain ? `• ${e.strain}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label className="text-sm">Mês</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label className="text-sm">Semana</Label>
              <Select value={week} onValueChange={setWeek}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {weeks.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-1">
              <Label className="text-sm">Ordem</Label>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Novas</SelectItem>
                  <SelectItem value="oldest">Antigas</SelectItem>
                  <SelectItem value="wet_desc">↑ Peso úmido</SelectItem>
                  <SelectItem value="dry_desc">↑ Peso seco</SelectItem>
                  <SelectItem value="conidium_desc">↑ Peso conídio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-10">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando mídias...
            </div>
          ) : error ? (
            <div className="text-sm text-destructive py-6">
              Erro ao carregar mídias: {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10">Nenhuma mídia encontrada com os filtros atuais.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((p) => {
                const exp = expLabel(p.experiment.number)
                const title = `${exp} • Rep ${p.test.repetitionNumber} • Teste ${p.test.testNumber} • Dia ${p.day}º`
                const dref = p.day === 7 ? p.test.date7Day : p.test.date14Day

                return (
                  <Card key={p.id} className="overflow-hidden">
                    <div className="relative">
                      <div className="w-full aspect-[3/2] bg-muted/30">
                        {p.url ? (
                          <img src={p.url} alt={title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                            Sem imagem
                          </div>
                        )}
                      </div>

                      <div className="absolute top-2 left-2 flex gap-2">
                        <Badge>{exp}</Badge>
                        <Badge variant="secondary">{p.day}º dia</Badge>
                      </div>

                      <div className="absolute top-2 right-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="secondary" className="h-9 w-9">
                              <ZoomIn className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>

                          <DialogContent className="max-w-5xl">
                            <DialogTitle>{title}</DialogTitle>
                            <DialogDescription className="space-y-2">
                              <div className="text-xs text-muted-foreground">
                                Data: <span className="text-foreground">{fmtDate(dref)}</span> • Cepa:{" "}
                                <span className="text-foreground">{p.test.strain ?? p.experiment.strain ?? "-"}</span> • Unidade:{" "}
                                <span className="text-foreground">{p.test.unit ?? "-"}</span>
                              </div>
                              {p.url ? <ZoomableImage src={p.url} title={title} /> : null}

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                <div className="rounded-md border p-2">
                                  <div className="text-muted-foreground">Peso úmido</div>
                                  <div className="font-medium">{fmtNum(p.test.wetWeight)}</div>
                                </div>
                                <div className="rounded-md border p-2">
                                  <div className="text-muted-foreground">Peso seco</div>
                                  <div className="font-medium">{fmtNum(p.test.dryWeight)}</div>
                                </div>
                                <div className="rounded-md border p-2">
                                  <div className="text-muted-foreground">Peso conídio</div>
                                  <div className="font-medium">{fmtNum(p.test.extractedConidiumWeight)}</div>
                                </div>
                              </div>
                            </DialogDescription>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    <CardContent className="p-3 space-y-2">
                      <div className="text-sm font-medium">{title}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Data:</span> {fmtDate(dref)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cepa:</span> {p.test.strain ?? p.experiment.strain ?? "-"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Unid.:</span> {p.test.unit ?? "-"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Lote:</span> {p.test.testLot ?? "-"}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div className="rounded-md border p-2">
                          <div className="text-muted-foreground">Úmido</div>
                          <div className="font-medium">{fmtNum(p.test.wetWeight)}</div>
                        </div>
                        <div className="rounded-md border p-2">
                          <div className="text-muted-foreground">Seco</div>
                          <div className="font-medium">{fmtNum(p.test.dryWeight)}</div>
                        </div>
                        <div className="rounded-md border p-2">
                          <div className="text-muted-foreground">Conídio</div>
                          <div className="font-medium">{fmtNum(p.test.extractedConidiumWeight)}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
