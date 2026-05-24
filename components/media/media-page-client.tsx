"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Camera, FilterX, ImageIcon, Loader2, Search, Sparkles, ZoomIn } from "lucide-react"
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

type SortKey = "newest" | "oldest" | "experiment"
type DayFilter = "all" | "7" | "14"
type UnitFilter = "all" | "Salto" | "Americana"

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const text = String(value)
  const [year, month, day] = text.slice(0, 10).split("-").map(Number)
  if (year && month && day && text.length <= 10) return new Date(year, month - 1, day)
  const fallback = new Date(text)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function fmtDate(value: string | null | undefined) {
  const date = parseDate(value)
  if (!date) return "--/--/--"
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "--/--/--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fmtDate(value)
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
}

function fmtNum(value: number | null | undefined, suffix = " g") {
  if (value === null || value === undefined) return "-"
  const n = Number(value)
  if (!Number.isFinite(n)) return "-"
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${suffix}`
}

function expLabel(number: number) {
  return `Exp. #${String(number).padStart(3, "0")}`
}

function monthKey(value: string) {
  const date = parseDate(value)
  if (!date) return ""
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function weekKey(value: string) {
  const date = parseDate(value)
  if (!date) return ""
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number)
  if (!year || !month) return key
  const date = new Date(year, month - 1, 1)
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function normalizeUnit(value: string | null | undefined): UnitFilter | "other" {
  const text = String(value ?? "").trim().toLowerCase()
  if (text.includes("salto")) return "Salto"
  if (text.includes("americana")) return "Americana"
  return text ? "other" : "all"
}

function FilterButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className={
        active
          ? "h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-3 text-xs font-semibold text-white shadow-sm hover:from-blue-700 hover:to-purple-700"
          : "h-8 rounded-full border-slate-200 bg-white/80 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:bg-slate-950/70 dark:text-slate-200"
      }
    >
      {children}
    </Button>
  )
}

function FinalMetrics({ photo }: { photo: MediaPhoto }) {
  if (photo.day !== 14) return null

  return (
    <div className="grid grid-cols-3 gap-2 text-[11px]">
      <div className="rounded-xl border border-slate-200 bg-white/70 p-2 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="text-slate-500">Úmido</div>
        <div className="font-semibold text-slate-950 dark:text-white">{fmtNum(photo.test.wetWeight)}</div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white/70 p-2 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="text-slate-500">Seco</div>
        <div className="font-semibold text-slate-950 dark:text-white">{fmtNum(photo.test.dryWeight)}</div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white/70 p-2 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="text-slate-500">Conídio</div>
        <div className="font-semibold text-slate-950 dark:text-white">{fmtNum(photo.test.extractedConidiumWeight)}</div>
      </div>
    </div>
  )
}

export function MediaPageClient() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<MediaPhoto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [experimentId, setExperimentId] = useState("all")
  const [month, setMonth] = useState("all")
  const [week, setWeek] = useState("all")
  const [dayFilter, setDayFilter] = useState<DayFilter>("all")
  const [unitFilter, setUnitFilter] = useState<UnitFilter>("all")
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
    for (const photo of items) {
      map.set(photo.experiment.id, {
        id: photo.experiment.id,
        number: photo.experiment.number,
        strain: photo.experiment.strain,
      })
    }
    return Array.from(map.values()).sort((a, b) => b.number - a.number)
  }, [items])

  const months = useMemo(() => {
    const set = new Set<string>()
    for (const photo of items) set.add(monthKey(photo.createdAt))
    return Array.from(set.values()).filter(Boolean).sort((a, b) => (a < b ? 1 : -1))
  }, [items])

  const weeks = useMemo(() => {
    const set = new Set<string>()
    for (const photo of items) set.add(weekKey(photo.createdAt))
    return Array.from(set.values()).filter(Boolean).sort((a, b) => (a < b ? 1 : -1))
  }, [items])

  const stats = useMemo(() => {
    const total = items.filter((photo) => photo.url).length
    const day7 = items.filter((photo) => photo.url && photo.day === 7).length
    const day14 = items.filter((photo) => photo.url && photo.day === 14).length
    const units = new Set(items.map((photo) => normalizeUnit(photo.test.unit)).filter((unit) => unit !== "all" && unit !== "other"))
    return { total, day7, day14, experiments: experiments.length, units: units.size }
  }, [items, experiments.length])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let arr = items.filter((photo) => {
      if (!photo.url) return false
      if (experimentId !== "all" && photo.experiment.id !== experimentId) return false
      if (month !== "all" && monthKey(photo.createdAt) !== month) return false
      if (week !== "all" && weekKey(photo.createdAt) !== week) return false
      if (dayFilter !== "all" && String(photo.day) !== dayFilter) return false
      if (unitFilter !== "all" && normalizeUnit(photo.test.unit) !== unitFilter) return false

      if (!q) return true

      const haystack = [
        expLabel(photo.experiment.number),
        photo.experiment.strain ?? "",
        photo.test.strain ?? "",
        photo.test.testLot ?? "",
        photo.test.matrixLot ?? "",
        photo.test.unit ?? "",
        `rep ${photo.test.repetitionNumber}`,
        `teste ${photo.test.testNumber}`,
        `dia ${photo.day}`,
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(q)
    })

    const byCreated = (a: MediaPhoto, b: MediaPhoto) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()

    if (sort === "newest") arr = arr.slice().sort(byCreated)
    if (sort === "oldest") arr = arr.slice().sort((a, b) => -byCreated(a, b))
    if (sort === "experiment") {
      arr = arr.slice().sort((a, b) => {
        const expDiff = b.experiment.number - a.experiment.number
        if (expDiff !== 0) return expDiff
        if (a.test.repetitionNumber !== b.test.repetitionNumber) return a.test.repetitionNumber - b.test.repetitionNumber
        if (a.test.testNumber !== b.test.testNumber) return a.test.testNumber - b.test.testNumber
        return a.day - b.day
      })
    }

    return arr
  }, [items, query, experimentId, month, week, dayFilter, unitFilter, sort])

  function clearFilters() {
    setQuery("")
    setExperimentId("all")
    setMonth("all")
    setWeek("all")
    setDayFilter("all")
    setUnitFilter("all")
    setSort("newest")
  }

  return (
    <div className="w-full overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8">
      <section className="mb-5 overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white shadow-lg">
        <div className="relative p-5 sm:p-6">
          <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-0 left-1/2 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
                <Sparkles className="h-3.5 w-3.5" />
                Galeria técnica dos testes
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mídias</h1>
                <p className="mt-1 max-w-2xl text-sm text-blue-50">
                  Consulte as fotos consolidadas do 7º e 14º dia, filtrando por experimento, período, unidade e cepa.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[560px]">
              <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                <div className="text-xs text-blue-100">Fotos</div>
                <div className="mt-1 text-2xl font-bold">{stats.total}</div>
              </div>
              <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                <div className="text-xs text-blue-100">7º dia</div>
                <div className="mt-1 text-2xl font-bold">{stats.day7}</div>
              </div>
              <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                <div className="text-xs text-blue-100">14º dia</div>
                <div className="mt-1 text-2xl font-bold">{stats.day14}</div>
              </div>
              <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                <div className="text-xs text-blue-100">Experimentos</div>
                <div className="mt-1 text-2xl font-bold">{stats.experiments}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Card className="mb-5 border-slate-200/80 bg-white/90 shadow-sm backdrop-blur dark:bg-slate-950/70">
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por cepa, lote, unidade, rep, teste..."
                  className="h-10 rounded-2xl pl-9"
                />
              </div>
            </div>

            <div className="lg:col-span-3">
              <Select value={experimentId} onValueChange={setExperimentId}>
                <SelectTrigger className="h-10 rounded-2xl">
                  <SelectValue placeholder="Experimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os experimentos</SelectItem>
                  {experiments.map((experiment) => (
                    <SelectItem key={experiment.id} value={experiment.id}>
                      {expLabel(experiment.number)} {experiment.strain ? `• ${experiment.strain}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:col-span-3">
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="h-10 rounded-2xl">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {months.map((item) => (
                    <SelectItem key={item} value={item}>
                      {monthLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={week} onValueChange={setWeek}>
                <SelectTrigger className="h-10 rounded-2xl">
                  <SelectValue placeholder="Semana" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as semanas</SelectItem>
                  {weeks.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:col-span-2">
              <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
                <SelectTrigger className="h-10 rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Mais novas</SelectItem>
                  <SelectItem value="oldest">Mais antigas</SelectItem>
                  <SelectItem value="experiment">Por experimento</SelectItem>
                </SelectContent>
              </Select>

              <Button type="button" variant="outline" onClick={clearFilters} disabled={loading} className="h-10 rounded-2xl">
                <FilterX className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Dia</span>
              <FilterButton active={dayFilter === "all"} onClick={() => setDayFilter("all")}>Todos</FilterButton>
              <FilterButton active={dayFilter === "7"} onClick={() => setDayFilter("7")}>7º dia</FilterButton>
              <FilterButton active={dayFilter === "14"} onClick={() => setDayFilter("14")}>14º dia</FilterButton>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unidade</span>
              <FilterButton active={unitFilter === "all"} onClick={() => setUnitFilter("all")}>Todas</FilterButton>
              <FilterButton active={unitFilter === "Salto"} onClick={() => setUnitFilter("Salto")}>Salto</FilterButton>
              <FilterButton active={unitFilter === "Americana"} onClick={() => setUnitFilter("Americana")}>Americana</FilterButton>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 bg-white/90 shadow-sm dark:bg-slate-950/70">
        <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ImageIcon className="h-5 w-5 text-blue-600" />
              Galeria de fotos
            </CardTitle>
            <CardDescription>{filtered.length} mídia(s) encontrada(s) com os filtros atuais.</CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
            {loading ? "Carregando" : `${filtered.length} foto(s)`}
          </Badge>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando mídias...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Erro ao carregar mídias: {error}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-800">
              <Camera className="mb-3 h-10 w-10 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Nenhuma mídia encontrada</h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">Ajuste os filtros ou aguarde novas fotos consolidadas dos testes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((photo) => {
                const exp = expLabel(photo.experiment.number)
                const title = `${exp} • Rep ${photo.test.repetitionNumber} • Teste ${photo.test.testNumber} • ${photo.day}º dia`
                const referenceDate = photo.day === 7 ? photo.test.date7Day : photo.test.date14Day
                const strain = photo.test.strain ?? photo.experiment.strain ?? "-"

                return (
                  <Card key={photo.id} className="group overflow-hidden border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-950/80">
                    <div className="relative">
                      <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-slate-900">
                        {photo.url ? (
                          <img src={photo.url} alt={title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">Sem imagem</div>
                        )}
                      </div>

                      <div className="absolute left-2 top-2 flex flex-wrap gap-2">
                        <Badge className="rounded-full bg-blue-600 text-white shadow-sm">{exp}</Badge>
                        <Badge className={photo.day === 7 ? "rounded-full bg-cyan-600 text-white" : "rounded-full bg-purple-600 text-white"}>
                          {photo.day}º dia
                        </Badge>
                      </div>

                      <div className="absolute right-2 top-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full bg-white/90 text-slate-800 shadow-sm hover:bg-white">
                              <ZoomIn className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>

                          <DialogContent className="max-w-5xl">
                            <DialogTitle>{title}</DialogTitle>
                            <DialogDescription asChild>
                              <div className="space-y-3">
                                <div className="text-xs text-slate-500">
                                  Data: <span className="font-medium text-slate-950 dark:text-white">{fmtDate(referenceDate)}</span> • Cepa:{" "}
                                  <span className="font-medium text-slate-950 dark:text-white">{strain}</span> • Unidade:{" "}
                                  <span className="font-medium text-slate-950 dark:text-white">{photo.test.unit ?? "-"}</span>
                                </div>
                                {photo.url ? <ZoomableImage src={photo.url} title={title} /> : null}
                                {photo.day === 14 ? <FinalMetrics photo={photo} /> : null}
                              </div>
                            </DialogDescription>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    <CardContent className="space-y-3 p-4">
                      <div>
                        <div className="line-clamp-1 text-sm font-semibold text-slate-950 dark:text-white">{title}</div>
                        <div className="mt-1 text-xs text-slate-500">Criada em {fmtDateTime(photo.createdAt)}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-900/70">
                          <span className="block text-slate-500">Data ref.</span>
                          <span className="font-semibold text-slate-950 dark:text-white">{fmtDate(referenceDate)}</span>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-900/70">
                          <span className="block text-slate-500">Unidade</span>
                          <span className="font-semibold text-slate-950 dark:text-white">{photo.test.unit ?? "-"}</span>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-900/70">
                          <span className="block text-slate-500">Cepa</span>
                          <span className="font-semibold text-slate-950 dark:text-white">{strain}</span>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-900/70">
                          <span className="block text-slate-500">Lote</span>
                          <span className="font-semibold text-slate-950 dark:text-white">{photo.test.testLot ?? "-"}</span>
                        </div>
                      </div>

                      {photo.day === 14 ? <FinalMetrics photo={photo} /> : null}
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
