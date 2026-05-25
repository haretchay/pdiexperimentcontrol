"use client"

import type React from "react"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  Save,
  Search,
  Thermometer,
  Trash2,
  X,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export interface FungusView {
  id: string
  scientific_name: string
  optimal_temperature: number
  min_temperature: number
  max_temperature: number
  acronyms: string[]
  created_by: string | null
  created_by_name: string | null
  experiment_count: number
  created_at: string
  updated_at: string
}

interface FungiRegisterClientProps {
  fungi: FungusView[]
  setupError?: string | null
}

interface FungusFormState {
  scientificName: string
  optimalTemperature: string
  minTemperature: string
  maxTemperature: string
  acronyms: string[]
}

const emptyForm: FungusFormState = {
  scientificName: "",
  optimalTemperature: "",
  minTemperature: "",
  maxTemperature: "",
  acronyms: [""],
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatTemp(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function sanitizeTemperatureInput(value: string) {
  let sanitized = value.replace(/[^0-9,.-]/g, "")
  sanitized = sanitized.replace(/\./g, ",")

  const isNegative = sanitized.startsWith("-")
  sanitized = sanitized.replace(/-/g, "")
  if (isNegative) sanitized = `-${sanitized}`

  const [integerPartRaw, decimalPartRaw = ""] = sanitized.split(",")
  const integerPart = integerPartRaw.slice(0, 3)
  const decimalPart = decimalPartRaw.slice(0, 1)

  if (sanitized.includes(",")) return `${integerPart},${decimalPart}`
  return integerPart
}

function normalizeAcronym(value: string) {
  return value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 6)
}

function validateForm(form: FungusFormState) {
  const scientificName = form.scientificName.trim()
  const acronyms = form.acronyms.map((item) => normalizeAcronym(item)).filter(Boolean)
  const uniqueAcronyms = Array.from(new Set(acronyms))

  if (scientificName.length < 3) return "Informe o nome científico do fungo."
  if (!form.optimalTemperature) return "Informe a temperatura ótima."
  if (!form.minTemperature) return "Informe a temperatura mínima."
  if (!form.maxTemperature) return "Informe a temperatura máxima."
  if (uniqueAcronyms.length === 0) return "Informe pelo menos uma sigla."

  const invalidAcronym = uniqueAcronyms.find((item) => !/^[A-Z]{3,6}$/.test(item))
  if (invalidAcronym) return "Cada sigla deve ter de 3 a 6 letras maiúsculas."

  const min = Number(form.minTemperature.replace(",", "."))
  const max = Number(form.maxTemperature.replace(",", "."))
  const optimal = Number(form.optimalTemperature.replace(",", "."))

  if (![min, max, optimal].every(Number.isFinite)) return "Confira os valores de temperatura."
  if (min > max) return "A temperatura mínima não pode ser maior que a máxima."
  if (optimal < min || optimal > max) return "A temperatura ótima deve ficar dentro da faixa mínima e máxima."

  return null
}

function TemperatureInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder ?? "0,0"}
        className="h-10 pr-9 text-left tabular-nums"
        onChange={(event) => onChange(sanitizeTemperatureInput(event.target.value))}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">ºC</span>
    </div>
  )
}

export function FungiRegisterClient({ fungi, setupError }: FungiRegisterClientProps) {
  const router = useRouter()
  const [form, setForm] = useState<FungusFormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(setupError ?? null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filteredFungi = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return fungi
    return fungi.filter((fungus) => {
      return (
        fungus.scientific_name.toLowerCase().includes(term) ||
        fungus.acronyms.some((acronym) => acronym.toLowerCase().includes(term)) ||
        (fungus.created_by_name ?? "").toLowerCase().includes(term)
      )
    })
  }, [fungi, query])

  const stats = useMemo(() => {
    const allAcronyms = new Set<string>()
    for (const fungus of fungi) {
      for (const acronym of fungus.acronyms) allAcronyms.add(acronym)
    }

    const temperatures = fungi.map((fungus) => fungus.optimal_temperature).filter((value) => Number.isFinite(value))
    const averageOptimal = temperatures.length
      ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length
      : null

    return {
      total: fungi.length,
      acronyms: allAcronyms.size,
      averageOptimal,
    }
  }, [fungi])

  function updateForm<K extends keyof FungusFormState>(key: K, value: FungusFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateAcronym(index: number, value: string) {
    setForm((current) => {
      const next = [...current.acronyms]
      next[index] = normalizeAcronym(value)
      return { ...current, acronyms: next }
    })
  }

  function addAcronym() {
    setForm((current) => ({ ...current, acronyms: [...current.acronyms, ""] }))
  }

  function removeAcronym(index: number) {
    setForm((current) => {
      const next = current.acronyms.filter((_, itemIndex) => itemIndex !== index)
      return { ...current, acronyms: next.length ? next : [""] }
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setSuccess(null)
  }

  function startEditing(fungus: FungusView) {
    setEditingId(fungus.id)
    setForm({
      scientificName: fungus.scientific_name,
      optimalTemperature: formatTemp(fungus.optimal_temperature),
      minTemperature: formatTemp(fungus.min_temperature),
      maxTemperature: formatTemp(fungus.max_temperature),
      acronyms: fungus.acronyms.length ? fungus.acronyms : [""],
    })
    setError(null)
    setSuccess(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const validationError = validateForm(form)
    if (validationError) {
      setError(validationError)
      return
    }

    const acronyms = Array.from(new Set(form.acronyms.map((item) => normalizeAcronym(item)).filter(Boolean)))
    const payload = {
      scientificName: form.scientificName.trim(),
      optimalTemperature: form.optimalTemperature,
      minTemperature: form.minTemperature,
      maxTemperature: form.maxTemperature,
      acronyms,
    }

    setSaving(true)
    try {
      const url = editingId ? `/api/registers/fungi/${editingId}` : "/api/registers/fungi"
      const method = editingId ? "PATCH" : "POST"
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string }

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Não foi possível salvar o cadastro do fungo.")
      }

      setSuccess(editingId ? "Cadastro do fungo atualizado com sucesso." : "Fungo cadastrado com sucesso.")
      setEditingId(null)
      setForm(emptyForm)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o cadastro do fungo.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(fungus: FungusView) {
    if (fungus.experiment_count > 0) {
      setError(
        `Este fungo já está vinculado a ${fungus.experiment_count} experimento${fungus.experiment_count === 1 ? "" : "s"} e não pode ser excluído.`,
      )
      setSuccess(null)
      return
    }

    const confirmed = window.confirm(`Deseja excluir o cadastro de ${fungus.scientific_name}?`)
    if (!confirmed) return

    setError(null)
    setSuccess(null)
    setDeletingId(fungus.id)

    try {
      const response = await fetch(`/api/registers/fungi/${fungus.id}`, { method: "DELETE" })
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string }

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Não foi possível excluir o cadastro do fungo.")
      }

      if (editingId === fungus.id) resetForm()
      setSuccess("Cadastro do fungo excluído com sucesso.")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o cadastro do fungo.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-800 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white/80">
              <Thermometer className="h-4 w-4" />
              Parâmetros biológicos
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Cadastro de Fungos</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              Mantenha os fungos padronizados com nome científico, temperaturas de referência e siglas usadas nos testes.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 lg:min-w-[420px]">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">Fungos</p>
              <p className="mt-2 text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">Siglas</p>
              <p className="mt-2 text-2xl font-bold">{stats.acronyms}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">Temp. ótima média</p>
              <p className="mt-2 text-2xl font-bold">{stats.averageOptimal === null ? "-" : `${formatTemp(stats.averageOptimal)}ºC`}</p>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {success ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
        <Card className="border-blue-100 shadow-sm">
          <CardHeader>
            <CardTitle>{editingId ? "Editar fungo" : "Novo fungo"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="scientificName">Nome Científico do Fungo</Label>
                <Input
                  id="scientificName"
                  value={form.scientificName}
                  autoComplete="off"
                  placeholder="Ex.: Penicillium spp."
                  onChange={(event) => updateForm("scientificName", event.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="optimalTemperature">Temp. Ótima</Label>
                  <TemperatureInput
                    id="optimalTemperature"
                    value={form.optimalTemperature}
                    onChange={(value) => updateForm("optimalTemperature", value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minTemperature">Temp. mín</Label>
                  <TemperatureInput
                    id="minTemperature"
                    value={form.minTemperature}
                    onChange={(value) => updateForm("minTemperature", value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxTemperature">Temp. máx</Label>
                  <TemperatureInput
                    id="maxTemperature"
                    value={form.maxTemperature}
                    onChange={(value) => updateForm("maxTemperature", value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Sigla</Label>
                    <p className="text-xs text-slate-500">Clique em adicionar para acrescentar mais campos de sigla.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addAcronym}>
                    <Plus className="mr-1 h-4 w-4" /> Adicionar
                  </Button>
                </div>

                <div className="space-y-2">
                  {form.acronyms.map((acronym, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={acronym}
                        autoComplete="off"
                        maxLength={6}
                        placeholder={index === 0 ? "Ex.: PENIC" : "Nova sigla"}
                        className="font-semibold uppercase tracking-wide"
                        onChange={(event) => updateAcronym(index, event.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => removeAcronym(index)}
                        disabled={form.acronyms.length === 1}
                        aria-label="Remover sigla"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={saving} className="bg-gradient-to-r from-blue-600 to-purple-700 text-white hover:from-blue-700 hover:to-purple-800">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {editingId ? "Salvar alterações" : "Cadastrar fungo"}
                </Button>
                {editingId ? (
                  <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                    Cancelar edição
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Fungos cadastrados</CardTitle>
              <CardDescription>Consulte, edite ou remova parâmetros já cadastrados.</CardDescription>
            </div>
            <div className="relative w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, sigla ou usuário"
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredFungi.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-slate-50 p-8 text-center text-sm text-slate-500">
                Nenhum fungo encontrado.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFungi.map((fungus) => (
                  <div
                    key={fungus.id}
                    className={cn(
                      "rounded-2xl border bg-white p-4 shadow-sm transition-all",
                      editingId === fungus.id ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-200 hover:shadow-md",
                    )}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900">{fungus.scientific_name}</h3>
                          {fungus.acronyms.map((acronym) => (
                            <Badge key={acronym} variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                              {acronym}
                            </Badge>
                          ))}
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border bg-slate-50 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Temperatura ótima</p>
                            <p className="mt-1 text-lg font-bold text-slate-900">{formatTemp(fungus.optimal_temperature)} ºC</p>
                          </div>
                          <div className="rounded-xl border bg-slate-50 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Faixa mínima</p>
                            <p className="mt-1 text-lg font-bold text-slate-900">{formatTemp(fungus.min_temperature)} ºC</p>
                          </div>
                          <div className="rounded-xl border bg-slate-50 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Faixa máxima</p>
                            <p className="mt-1 text-lg font-bold text-slate-900">{formatTemp(fungus.max_temperature)} ºC</p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span>Criado por: {fungus.created_by_name || "-"}</span>
                          <span>Data da criação: {formatDateTime(fungus.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 lg:shrink-0">
                        <Button type="button" variant="outline" size="sm" onClick={() => startEditing(fungus)}>
                          <Edit3 className="mr-1 h-4 w-4" /> Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(fungus)}
                          disabled={deletingId === fungus.id || fungus.experiment_count > 0}
                          title={
                            fungus.experiment_count > 0
                              ? `Este fungo está vinculado a ${fungus.experiment_count} experimento${fungus.experiment_count === 1 ? "" : "s"}.`
                              : "Excluir fungo"
                          }
                        >
                          {deletingId === fungus.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
