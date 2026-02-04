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

function expLabel(n: number) {
  return `#${String(n).padStart(3, "0")}`
}

export function MediaPageClient() {
  const [items, setItems] = useState<MediaPhoto[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // filtros
  const [q, setQ] = useState("")
  const [expId, setExpId] = useState<string>("all")
  const [month, setMonth] = useState<string>("all")
  const [week, setWeek] = useState<string>("all")
  const [sort, setSort] = useState<string>("newest")

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setErrorMsg(null)
        const res = await fetch("/api/media/all", { cache: "no-store" })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error ?? "Falha ao carregar mídias")
        if (cancelled) return
        setItems((json?.photos ?? []) as MediaPhoto[])
      } catch (e: any) {
        if (cancelled) return
        setErrorMsg(e?.message ?? "Erro ao carregar mídias")
        setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const experiments = useMemo(() => {
    const map = new Map<string, { id: string; number: number; strain: string | null }>()
    for (const p of items ?? []) {
      map.set(p.experiment.id, { id: p.experiment.id, number: p.experiment.number, strain: p.experiment.strain ?? null })
    }
    return Array.from(map.values()).sort((a, b) => b.number - a.number)
  }, [items])

  const months = useMemo(() => {
    const set = new Set<string>()
    for (const p of items ?? []) set.add(monthKey(p.createdAt))
    return Array.from(set.values()).filter(Boolean).sort((a, b) => (a < b ? 1 : -1))
  }, [items])

  const weeks = useMemo(() => {
    const set = new Set<string>()
    for (const p of items ?? []) set.add(weekKey(p.createdAt))
    return Array.from(set.values()).filter(Boolean).sort((a, b) => (a < b ? 1 : -1))
  }, [items])

  const filtered = useMemo(() => {
    const qn = q.trim().toLowerCase()
    let arr = (items ?? []).filter((p) => {
      // sempre mostrar só com mídia (conforme pedido: sem toggle)
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

    if (sort === "newest") arr = arr.sort(byCreated)
    if (sort === "oldest") arr = arr.sort((a, b) => -byCreated(a, b))
    if (sort === "wet_desc") arr = arr.sort((a, b) => (b.test.wetWeight ?? -Infinity) - (a.test.wetWeight ?? -Infinity) || byCreated(a, b))
    if (sort === "dry_desc") arr = arr.sort((a, b) => (b.test.dryWeight ?? -Infinity) - (a.test.dryWeight ?? -Infinity) || byCreated(a, b))
    if (sort === "conidium_desc")
      arr = arr.sort(
        (a, b) => (b.test.extractedConidiumWeight ?? -Infinity) - (a.test.extractedConidiumWeight ?? -Infinity) || byCreated(a, b)
      )

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
        <CardHeader>
          <CardTitle>Mídias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4">
              <Label className="text-sm">Buscar</Label>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Digite cepa, exp (#001), lote, rep, teste..."
              />
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
                      {expLabel(e.number)}{e.strain ? ` — ${e.strain}` : ""}
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
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger>
                  <SelectValue placeholder="Mais novos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Mais novos</SelectItem>
                  <SelectItem value="oldest">Mais antigos</SelectItem>
                  <SelectItem value="wet_desc">Peso úmido (maior)</SelectItem>
                  <SelectItem value="dry_desc">Peso seco (maior)</SelectItem>
                  <SelectItem value="conidium_desc">Peso conídio (maior)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {items ? (
                <span>
                  Exibindo <span className="font-medium text-foreground">{filtered.length}</span> foto(s) mesclada(s)
                </span>
              ) : (
                <span>Carregando…</span>
              )}
            </div>
            <Button variant="secondary" onClick={clear}>
              Limpar filtros
            </Button>
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
        <Card>
          <CardHeader>
            <CardTitle>Erro</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{errorMsg}</CardContent>
        </Card>
      ) : null}

      {items ? (
        filtered.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Nenhuma mídia</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Não há fotos mescladas para o filtro atual.</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <Dialog>
                    <DialogTrigger asChild>
                      <div className="relative bg-black cursor-pointer group">
                        <div className="relative w-full aspect-[3/2]">
                          {/* img simples para evitar warning de dimensão (recharts) e permitir fallback */}
                          <img
                            src={p.url ?? "/placeholder.svg"}
                            alt={`Foto ${p.day}º dia`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                          <div className="flex items-center gap-2 text-white text-sm">
                            <ZoomIn className="h-5 w-5" />
                            Ampliar
                          </div>
                        </div>
                        <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 text-xs rounded">
                          Dia {p.day}º
                        </div>
                      </div>
                    </DialogTrigger>

                    <DialogContent className="max-w-5xl">
                      <DialogTitle>{`Exp. ${expLabel(p.experiment.number)} • Rep. ${p.test.repetitionNumber} • Teste ${p.test.testNumber} • Dia ${p.day}º`}</DialogTitle>
                      <DialogDescription className="sr-only">Visualização ampliada da foto mesclada.</DialogDescription>
                      <ZoomableImage src={p.url ?? "/placeholder.svg"} title={`Foto ${p.day}º dia`} />
                    </DialogContent>
                  </Dialog>

                  <div className="p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Exp. {expLabel(p.experiment.number)}</Badge>
                      <Badge variant="outline">Rep. {p.test.repetitionNumber}</Badge>
                      <Badge variant="outline">Teste {p.test.testNumber}</Badge>
                      {p.test.strain ? <Badge>{p.test.strain}</Badge> : p.experiment.strain ? <Badge>{p.experiment.strain}</Badge : null}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
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

                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      <span>Data 7º: {fmtDate(p.test.date7Day)}</span>
                      <span>Data 14º: {fmtDate(p.test.date14Day)}</span>
                      <span>Inserido: {fmtDate(p.createdAt)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : null}
    </div>
  )
}
