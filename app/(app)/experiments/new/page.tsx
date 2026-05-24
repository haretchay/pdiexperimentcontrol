"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarDays, Check, FlaskConical, Hash, Loader2, Minus, Plus, Sparkles, TestTube2 } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { createMissingTestsForExperiment } from "@/lib/pdi/tests"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

const MIN_COUNT = 1
const MAX_COUNT = 99

type FungusOption = {
  id: string
  scientific_name: string
  optimal_temperature: number | null
  min_temperature: number | null
  max_temperature: number | null
  acronyms: string[] | null
}

function normalizeVariable(value: string) {
  return value.toUpperCase().replace(/\s+/g, "")
}

function formatTemperature(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--"
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function formatExperimentNumber(value: number) {
  return String(value || 0).padStart(3, "0")
}

function clampCount(value: number) {
  if (!Number.isFinite(value)) return MIN_COUNT
  return Math.max(MIN_COUNT, Math.min(MAX_COUNT, Math.round(value)))
}

function getTodayDateInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function CountSelector({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: number
  onChange: (value: number) => void
}) {
  const quickValues = [1, 2, 3, 4, 5, 6]

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <Label className="text-sm font-bold text-slate-900 dark:text-slate-50">{label}</Label>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex h-10 min-w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 px-3 text-lg font-black text-white shadow-md">
          {value}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-2xl"
          onClick={() => onChange(clampCount(value - 1))}
          disabled={value <= MIN_COUNT}
        >
          <Minus className="h-4 w-4" />
          <span className="sr-only">Diminuir</span>
        </Button>

        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          value={String(value)}
          onChange={(event) => onChange(clampCount(Number(event.target.value)))}
          className="h-11 rounded-2xl text-center text-lg font-black [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        <Button type="button" size="icon" className="h-11 w-11 rounded-2xl" onClick={() => onChange(clampCount(value + 1))}>
          <Plus className="h-4 w-4" />
          <span className="sr-only">Aumentar</span>
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {quickValues.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={
              item === value
                ? "rounded-xl bg-blue-600 px-2 py-2 text-xs font-bold text-white shadow-sm"
                : "rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            }
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function NewExperimentPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [nextNumber, setNextNumber] = useState<number>(1)
  const [startDate, setStartDate] = useState(() => getTodayDateInputValue())
  const [testCount, setTestCount] = useState(1)
  const [repetitionCount, setRepetitionCount] = useState(1)
  const [fungi, setFungi] = useState<FungusOption[]>([])
  const [selectedFungusId, setSelectedFungusId] = useState("")
  const [selectedAcronym, setSelectedAcronym] = useState("")
  const [strainVariable, setStrainVariable] = useState("")
  const [setupError, setSetupError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        setInitialLoading(true)

        const [{ data: numberRows, error: numberError }, { data: fungusRows, error: fungusError }] = await Promise.all([
          supabase.from("experiments").select("number").order("number", { ascending: false }).limit(1),
          supabase
            .from("fungi")
            .select("id, scientific_name, optimal_temperature, min_temperature, max_temperature, acronyms")
            .order("scientific_name", { ascending: true }),
        ])

        if (cancelled) return

        if (!numberError && numberRows && numberRows.length > 0) {
          const last = Number((numberRows[0] as { number?: number }).number ?? 0)
          setNextNumber(last + 1)
        } else {
          setNextNumber(1)
        }

        if (fungusError) {
          setSetupError(
            "Não foi possível carregar o cadastro de fungos. Confira se o script de banco foi executado e se há fungos cadastrados.",
          )
          setFungi([])
        } else {
          const rows = (fungusRows ?? []) as FungusOption[]
          setFungi(rows)
          setSetupError(rows.length === 0 ? "Cadastre pelo menos um fungo em Cadastros > Cadastro Parâmetros > Cadastro de Fungos." : null)
        }
      } finally {
        if (!cancelled) setInitialLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [supabase])

  const selectedFungus = useMemo(() => fungi.find((fungus) => fungus.id === selectedFungusId) ?? null, [fungi, selectedFungusId])
  const acronymOptions = useMemo(() => (Array.isArray(selectedFungus?.acronyms) ? selectedFungus.acronyms : []), [selectedFungus])
  const strain = useMemo(() => `${selectedAcronym}${strainVariable}`.trim(), [selectedAcronym, strainVariable])
  const totalTests = testCount * repetitionCount

  function selectFungus(fungusId: string) {
    setSelectedFungusId(fungusId)
    setSelectedAcronym("")
    setStrainVariable("")
  }

  async function onSubmit() {
    if (!startDate) {
      alert("Informe a data de início do experimento.")
      return
    }

    if (!selectedFungus) {
      alert("Selecione o fungo do experimento.")
      return
    }

    if (!selectedAcronym) {
      alert("Selecione a sigla/cepa do fungo.")
      return
    }

    if (!strainVariable.trim()) {
      alert("Informe a variável da cepa.")
      return
    }

    setLoading(true)
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) {
        router.push("/auth/login")
        return
      }

      const now = new Date().toISOString()
      const payload = {
        number: nextNumber,
        strain,
        fungus_id: selectedFungus.id,
        strain_acronym: selectedAcronym,
        strain_variable: strainVariable,
        start_date: startDate,
        test_count: testCount,
        repetition_count: repetitionCount,
        created_by: user.id,
        updated_by: user.id,
        created_at: now,
        updated_at: now,
      }

      const { data: exp, error } = await supabase.from("experiments").insert(payload).select("id").single()
      if (error) throw error
      if (!exp?.id) throw new Error("Falha ao criar experimento: id não retornou.")

      await createMissingTestsForExperiment(supabase, {
        experimentId: exp.id,
        repetitionCount,
        testCount,
        createdBy: user.id,
        defaultStrain: strain,
      })

      router.push(`/experiments/${exp.id}`)
    } catch (e: any) {
      console.error(e)
      alert(e?.message ?? "Erro ao criar experimento.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/70 px-3 py-4 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/30 sm:px-5 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push("/experiments")}
            className="rounded-full border border-slate-200 bg-white/80 shadow-sm hover:bg-white dark:border-slate-800 dark:bg-slate-950/80"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>
        </div>

        <Card className="overflow-hidden border-0 bg-white shadow-xl shadow-blue-950/5 dark:bg-slate-950">
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 px-4 py-6 text-white sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <Badge className="mb-3 border-white/20 bg-white/15 text-white hover:bg-white/20">
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  Cadastro de experimento
                </Badge>
                <h1 className="text-2xl font-black tracking-tight sm:text-4xl">Novo Experimento #{formatExperimentNumber(nextNumber)}</h1>
                <p className="mt-2 max-w-2xl text-sm text-blue-50">
                  Selecione o fungo cadastrado, escolha a sigla da cepa e informe a variável para formar automaticamente a CEPA do experimento.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
                <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                  <div className="text-xs text-blue-100">Testes totais</div>
                  <div className="mt-1 text-3xl font-black">{totalTests}</div>
                  <div className="text-[11px] text-blue-100/90">{repetitionCount} rep. × {testCount} testes</div>
                </div>
                <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                  <div className="text-xs text-blue-100">CEPA</div>
                  <div className="mt-1 truncate text-3xl font-black">{strain || "--"}</div>
                  <div className="truncate text-[11px] text-blue-100/90">{selectedFungus?.scientific_name ?? "Selecione um fungo"}</div>
                </div>
              </div>
            </div>
          </div>

          <CardContent className="space-y-5 p-4 sm:p-6 lg:p-8">
            {setupError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                {setupError}
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CalendarDays className="h-5 w-5 text-blue-600" />
                    Data e quantidade
                  </CardTitle>
                  <CardDescription>Defina a data inicial e a estrutura de testes/repetições.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Data de início</Label>
                    <Input id="startDate" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-12 rounded-2xl" />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <CountSelector
                      label="Nº de testes"
                      description="Quantidade de testes por repetição."
                      value={testCount}
                      onChange={setTestCount}
                    />
                    <CountSelector
                      label="Nº de repetições"
                      description="Quantidade de repetições do experimento."
                      value={repetitionCount}
                      onChange={setRepetitionCount}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FlaskConical className="h-5 w-5 text-purple-600" />
                    Fungo e cepa
                  </CardTitle>
                  <CardDescription>O nome científico e as siglas são carregados do Cadastro de Fungos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <Label className="mb-2 block">Fungo</Label>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {initialLoading ? (
                        <div className="col-span-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900">
                          Carregando fungos...
                        </div>
                      ) : (
                        fungi.map((fungus) => {
                          const active = fungus.id === selectedFungusId
                          return (
                            <button
                              key={fungus.id}
                              type="button"
                              onClick={() => selectFungus(fungus.id)}
                              className={
                                active
                                  ? "rounded-2xl border border-blue-500 bg-blue-50 p-3 text-left shadow-md ring-2 ring-blue-200 dark:bg-blue-950/30 dark:ring-blue-900"
                                  : "rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/60 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-900 dark:hover:bg-blue-950/20"
                              }
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="min-w-0 truncate font-bold text-slate-950 dark:text-white">{fungus.scientific_name}</p>
                                {active ? <Check className="h-4 w-4 shrink-0 text-blue-600" /> : null}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Ótima: {formatTemperature(fungus.optimal_temperature)} ºC • Faixa: {formatTemperature(fungus.min_temperature)}–{formatTemperature(fungus.max_temperature)} ºC
                              </p>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {selectedFungus ? (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <Label className="text-sm font-bold">Sigla da cepa</Label>
                          <p className="text-xs text-muted-foreground">Selecione uma sigla cadastrada para o fungo.</p>
                        </div>
                        <Badge variant="outline" className="w-fit bg-white dark:bg-slate-950">
                          {acronymOptions.length} sigla(s)
                        </Badge>
                      </div>

                      <div className="mb-4 flex flex-wrap gap-2">
                        {acronymOptions.map((acronym) => (
                          <button
                            key={acronym}
                            type="button"
                            onClick={() => setSelectedAcronym(acronym)}
                            className={
                              selectedAcronym === acronym
                                ? "rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-black text-white shadow-md"
                                : "rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                            }
                          >
                            {acronym}
                          </button>
                        ))}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
                        <div className="space-y-2">
                          <Label htmlFor="strainVariable">Variável</Label>
                          <Input
                            id="strainVariable"
                            value={strainVariable}
                            onChange={(event) => setStrainVariable(normalizeVariable(event.target.value))}
                            placeholder="Ex: 01, A1, 123"
                            className="h-12 rounded-2xl text-lg font-black uppercase"
                          />
                        </div>
                        <div className="rounded-2xl border border-blue-100 bg-white p-3 dark:border-blue-950 dark:bg-slate-950">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CEPA formada</p>
                          <div className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-950 dark:text-white">
                            <Hash className="h-5 w-5 text-blue-600" />
                            {strain || "--"}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">Formato: sigla + variável.</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => router.push("/experiments")} disabled={loading} className="rounded-2xl">
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={onSubmit}
                disabled={loading || initialLoading || fungi.length === 0}
                className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 font-bold text-white shadow-md shadow-blue-950/20 hover:from-blue-700 hover:to-purple-700"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube2 className="mr-2 h-4 w-4" />}
                {loading ? "Criando..." : "Criar Experimento"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
