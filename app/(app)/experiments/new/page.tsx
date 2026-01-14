"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const toNumber = (v: unknown) => {
  if (typeof v === "number") return v
  if (typeof v === "string" && v.trim() !== "") return Number(v)
  return v
}

const formSchema = z.object({
  startDate: z.string().min(1, { message: "Informe a data de início." }),
  strain: z.string().min(1, { message: "Informe a cepa." }),
  testCount: z.preprocess(toNumber, z.number().int().min(1, { message: "Quantidade de testes deve ser no mínimo 1." })),
  repetitionCount: z.preprocess(
    toNumber,
    z.number().int().min(1, { message: "Quantidade de repetições deve ser no mínimo 1." }),
  ),
})

type FormValues = z.infer<typeof formSchema>

export default function NewExperimentPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(false)
  const [nextNumber, setNextNumber] = useState<number>(1)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from("experiments")
        .select("number")
        .order("number", { ascending: false })
        .limit(1)

      if (!cancelled) {
        if (!error && data && data.length > 0) {
          const last = Number((data[0] as { number?: number }).number ?? 0)
          setNextNumber(last + 1)
        } else {
          setNextNumber(1)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      startDate: "",
      strain: "",
      testCount: 1,
      repetitionCount: 1,
    },
  })

  async function onSubmit(values: FormValues) {
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

      // cria experimento (o trigger do banco vai gerar os tests automaticamente)
      const payload = {
        number: nextNumber,
        strain: values.strain,
        start_date: values.startDate,
        test_count: values.testCount,
        repetition_count: values.repetitionCount,
        created_by: user.id,
      }

      const { data: exp, error } = await supabase.from("experiments").insert(payload).select("id").single()
      if (error) throw error
      if (!exp?.id) throw new Error("Falha ao criar experimento (id não retornou).")

      router.push(`/experiments/${exp.id}`)
    } catch (e: any) {
      console.error(e)
      alert(e?.message ?? "Erro ao criar experimento.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Novo Experimento</CardTitle>
          <CardDescription>Crie um experimento e os testes serão gerados automaticamente no Supabase</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 text-sm text-muted-foreground">
            Próximo número: <span className="font-medium">#{nextNumber}</span>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de início</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="strain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cepa</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Fungo X" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="testCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qtd. de testes</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          value={String(field.value ?? "")}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="repetitionCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qtd. de repetições</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          value={String(field.value ?? "")}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => router.push("/experiments")} disabled={loading}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : "Criar Experimento"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
