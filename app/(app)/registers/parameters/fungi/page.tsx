import Link from "next/link"
import { ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FungiRegisterClient, type FungusView } from "@/components/registers/fungi-register-client"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireActiveUser } from "@/lib/supabase/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type FungusRow = {
  id: string
  scientific_name: string
  optimal_temperature: number
  min_temperature: number
  max_temperature: number
  acronyms: string[] | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type ProfileRow = {
  user_id: string
  full_name: string | null
}

export default async function FungiRegisterPage() {
  const auth = await requireActiveUser()

  if (!auth.ok) {
    return (
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Não foi possível carregar o cadastro de fungos</CardTitle>
            <CardDescription>Tente recarregar a página em alguns segundos.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (auth.profile.role !== "admin") {
    return (
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <Card className="mx-auto max-w-2xl border-amber-200 bg-amber-50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription className="text-amber-800/80">
              Apenas usuários com função admin podem acessar o cadastro de fungos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild variant="outline" className="border-amber-300 bg-white">
              <Link href="/registers/parameters">Voltar para Cadastro Parâmetros</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const admin = createAdminClient()

  if (!admin) {
    return (
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle>Configuração pendente</CardTitle>
            <CardDescription className="text-red-800/80">
              Configure SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente para administrar o cadastro de fungos.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const { data, error } = await admin
    .from("fungi")
    .select("id, scientific_name, optimal_temperature, min_temperature, max_temperature, acronyms, created_by, created_at, updated_at")
    .order("scientific_name", { ascending: true })

  let setupError: string | null = null
  const rows = (data ?? []) as FungusRow[]

  if (error) {
    setupError =
      "Não foi possível carregar os fungos. Execute o script scripts/010_create_fungi_parameters.sql no Supabase e atualize a página."
  }

  const createdByIds = Array.from(new Set(rows.map((row) => row.created_by).filter((id): id is string => Boolean(id))))
  const fungusIds = rows.map((row) => row.id)
  let profilesById = new Map<string, string>()
  let experimentCountByFungusId = new Map<string, number>()

  if (createdByIds.length > 0) {
    const { data: profiles } = await admin.from("profiles").select("user_id, full_name").in("user_id", createdByIds)
    profilesById = new Map((profiles ?? []).map((profile: ProfileRow) => [profile.user_id, profile.full_name ?? "Usuário sem nome"]))
  }

  if (fungusIds.length > 0) {
    const { data: linkedExperiments } = await admin.from("experiments").select("fungus_id").in("fungus_id", fungusIds)

    for (const experiment of linkedExperiments ?? []) {
      const fungusId = (experiment as { fungus_id?: string | null }).fungus_id
      if (!fungusId) continue
      experimentCountByFungusId.set(fungusId, (experimentCountByFungusId.get(fungusId) ?? 0) + 1)
    }
  }

  const fungi: FungusView[] = rows.map((row) => ({
    id: row.id,
    scientific_name: row.scientific_name,
    optimal_temperature: Number(row.optimal_temperature),
    min_temperature: Number(row.min_temperature),
    max_temperature: Number(row.max_temperature),
    acronyms: Array.isArray(row.acronyms) ? row.acronyms : [],
    created_by: row.created_by,
    created_by_name: row.created_by ? profilesById.get(row.created_by) ?? null : null,
    experiment_count: experimentCountByFungusId.get(row.id) ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))

  return (
    <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
      <FungiRegisterClient fungi={fungi} setupError={setupError} />
    </div>
  )
}
