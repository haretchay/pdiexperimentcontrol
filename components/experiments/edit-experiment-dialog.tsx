"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Check, Edit, FlaskConical, Hash, Loader2, Minus, Plus, TestTube2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

type FungusOption = {
  id: string
  scientific_name: string
  optimal_temperature: number | null
  min_temperature: number | null
  max_temperature: number | null
  acronyms: string[] | null
}

type ExistingTestRow = {
  id: string
  repetition_number: number
  test_number: number
  strain: string | null
}

type Props = {
  experimentId: string
  experimentNumber: number
  startDate: string
  testCount: number
  repetitionCount: number
  strain: string
  fungusId?: string | null
  strainAcronym?: string | null
  strainVariable?: string | null
  onSaved?: () => void
}

function normalizeVariable(value: string) {
  return value.toUpperCase().replace(/\s+/g, "")
}

function clampIncrement(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(99, Math.round(value)))
}

function formatExperimentNumber(value: number) {
  return String(value || 0).padStart(3, "0")
}

function formatTemperature(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--"
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function IncrementControl({
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
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3">
        <Label className="text-sm font-bold text-slate-900 dark:text-slate-50">{label}</Label>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-2xl"
          onClick={() => onChange(clampIncrement(value - 1))}
          disabled={value <= 0}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          value={String(value)}
          onChange={(event) => onChange(clampIncrement(Number(event.target.value)))}
          className="h-10 rounded-2xl text-center text-lg font-black [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <Button type="button" size="icon" className="h-10 w-10 rounded-2xl" onClick={() => onChange(clampIncrement(value + 1))}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function EditExperimentDialog({
  experimentId,
  experimentNumber,
  startDate,
  testCount,
  repetitionCount,
  strain,
  fungusId,
  strainAcronym,
  strainVariable,
  onSaved,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fungi, setFungi] = useState<FungusOption[]>([])
  const [dateValue, setDateValue] = useState(startDate)
  const [selectedAcronym, setSelectedAcronym] = useState(strainAcronym ?? "")
  const [variable, setVariable] = useState(strainVariable ?? "")
  const [legacyStrain, setLegacyStrain] = useState(strain)
  const [testsToAdd, setTestsToAdd] = useState(0)
  const [repetitionsToAdd, setRepetitionsToAdd] = useState(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    ;(async () => {
      const { data, error } = await supabase
        .from("fungi")
        .select("id, scientific_name, optimal_temperature, min_temperature, max_temperature, acronyms")
        .order("scientific_name", { ascending: true })

      if (cancelled) return

      if (error) {
        toast({
          title: "Não foi possível carregar fungos",
          description: error.message,
          variant: "destructive",
        })
        setFungi([])
      } else {
        setFungi((data ?? []) as FungusOption[])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, supabase, toast])

  useEffect(() => {
    if (!open) return
    setDateValue(startDate)
    setSelectedAcronym(strainAcronym ?? "")
    setVariable(strainVariable ?? "")
    setLegacyStrain(strain)
    setTestsToAdd(0)
    setRepetitionsToAdd(0)
  }, [open, startDate, strain, strainAcronym, strainVariable])

  const selectedFungus = useMemo(() => fungi.find((fungus) => fungus.id === fungusId) ?? null, [fungi, fungusId])
  const acronymOptions = useMemo(() => (Array.isArray(selectedFungus?.acronyms) ? selectedFungus.acronyms : []), [selectedFungus])
  const newTestCount = testCount + testsToAdd
  const newRepetitionCount = repetitionCount + repetitionsToAdd
  const newStrain = fungusId ? `${selectedAcronym}${variable}`.trim() : legacyStrain.trim()

  async function save() {
    if (!dateValue) {
      toast({ title: "Informe a data do experimento", variant: "destructive" })
      return
    }

    if (fungusId) {
      if (!selectedAcronym) {
        toast({ title: "Selecione a cepa/sigla", variant: "destructive" })
        return
      }
      if (!variable.trim()) {
        toast({ title: "Informe a variável da cepa", variant: "destructive" })
        return
      }
    } else if (!legacyStrain.trim()) {
      toast({ title: "Informe a cepa", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error("Usuário não autenticado.")

      const { data: existingRows, error: existingError } = await supabase
        .from("tests")
        .select("id, repetition_number, test_number, strain")
        .eq("experiment_id", experimentId)

      if (existingError) throw existingError

      const existing = (existingRows ?? []) as ExistingTestRow[]
      const existingKeys = new Set(existing.map((row) => `${row.repetition_number}_${row.test_number}`))
      const now = new Date().toISOString()

      const testsToInsert: Array<{
        experiment_id: string
        repetition_number: number
        test_number: number
        strain: string | null
        created_by: string
        created_at: string
        updated_at: string
      }> = []

      for (let repetition = 1; repetition <= newRepetitionCount; repetition++) {
        for (let test = 1; test <= newTestCount; test++) {
          const key = `${repetition}_${test}`
          if (!existingKeys.has(key)) {
            testsToInsert.push({
              experiment_id: experimentId,
              repetition_number: repetition,
              test_number: test,
              strain: newStrain || null,
              created_by: user.id,
              created_at: now,
              updated_at: now,
            })
          }
        }
      }

      const updatePayload = {
        start_date: dateValue,
        test_count: newTestCount,
        repetition_count: newRepetitionCount,
        strain: newStrain,
        strain_acronym: fungusId ? selectedAcronym : null,
        strain_variable: fungusId ? variable : null,
        updated_by: user.id,
        updated_at: now,
      }

      const { error: experimentError } = await supabase.from("experiments").update(updatePayload).eq("id", experimentId)
      if (experimentError) throw experimentError

      if (testsToInsert.length > 0) {
        const { error: insertError } = await supabase.from("tests").insert(testsToInsert)
        if (insertError) throw insertError
      }

      const testsToUpdate = existing.filter((row) => row.strain === null || row.strain === strain).map((row) => row.id)
      if (testsToUpdate.length > 0) {
        const { error: testsUpdateError } = await supabase
          .from("tests")
          .update({ strain: newStrain || null, updated_by: user.id, updated_at: now })
          .in("id", testsToUpdate)

        if (testsUpdateError) throw testsUpdateError
      }

      toast({ title: "Experimento atualizado", description: "As alterações foram salvas com sucesso." })
      setOpen(false)
      onSaved?.()
    } catch (error: any) {
      console.error(error)
      toast({
        title: "Erro ao atualizar experimento",
        description: error?.message ?? "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="gap-2 rounded-xl bg-white text-blue-700 shadow-sm hover:bg-blue-50 dark:bg-slate-950 dark:text-blue-200 dark:hover:bg-slate-900"
      >
        <Edit className="h-4 w-4" />
        Editar experimento
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <FlaskConical className="h-6 w-6 text-blue-600" />
              Editar Experimento #{formatExperimentNumber(experimentNumber)}
            </DialogTitle>
            <DialogDescription>
              Altere a data, acrescente testes ou repetições e ajuste a cepa/variável. A quantidade existente não pode ser reduzida.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="mb-3 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <CalendarDays className="h-5 w-5 text-blue-600" />
                  Data do experimento
                </div>
                <Input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} className="h-12 rounded-2xl bg-white dark:bg-slate-950" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <IncrementControl
                  label="Acrescentar testes"
                  description={`Atual: ${testCount}. Novo total: ${newTestCount}.`}
                  value={testsToAdd}
                  onChange={setTestsToAdd}
                />
                <IncrementControl
                  label="Acrescentar repetições"
                  description={`Atual: ${repetitionCount}. Novo total: ${newRepetitionCount}.`}
                  value={repetitionsToAdd}
                  onChange={setRepetitionsToAdd}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <FlaskConical className="h-5 w-5 text-purple-600" />
                    Cepa do experimento
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">O fungo não pode ser alterado nesta tela.</p>
                </div>
                <Badge variant="outline">CEPA: {newStrain || "--"}</Badge>
              </div>

              {fungusId ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fungo selecionado</p>
                    <p className="mt-1 font-bold text-slate-950 dark:text-white">{selectedFungus?.scientific_name ?? "Carregando fungo..."}</p>
                    {selectedFungus ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ótima: {formatTemperature(selectedFungus.optimal_temperature)} ºC • Faixa: {formatTemperature(selectedFungus.min_temperature)}–{formatTemperature(selectedFungus.max_temperature)} ºC
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <Label className="mb-2 block">Sigla da cepa</Label>
                    <div className="flex flex-wrap gap-2">
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
                          {selectedAcronym === acronym ? <Check className="mr-1 inline h-3.5 w-3.5" /> : null}
                          {acronym}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
                    <div className="space-y-2">
                      <Label htmlFor="editStrainVariable">Variável</Label>
                      <Input
                        id="editStrainVariable"
                        value={variable}
                        onChange={(event) => setVariable(normalizeVariable(event.target.value))}
                        placeholder="Ex: 01, A1, 123"
                        className="h-12 rounded-2xl text-lg font-black uppercase"
                      />
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-950 dark:bg-blue-950/30">
                      <p className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-200">CEPA formada</p>
                      <div className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-950 dark:text-white">
                        <Hash className="h-5 w-5 text-blue-600" />
                        {newStrain || "--"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="legacyStrain">Cepa</Label>
                  <Input
                    id="legacyStrain"
                    value={legacyStrain}
                    onChange={(event) => setLegacyStrain(normalizeVariable(event.target.value))}
                    className="h-12 rounded-2xl text-lg font-black uppercase"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este experimento é anterior ao vínculo com Cadastro de Fungos. O fungo não será alterado.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading} className="rounded-2xl">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={loading}
              className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 font-bold text-white hover:from-blue-700 hover:to-purple-700"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube2 className="mr-2 h-4 w-4" />}
              {loading ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
