import Link from "next/link"
import { ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UsersAdminClient, type ProfileUserView, type UserInvitationView } from "@/components/registers/users-admin-client"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireActiveUser } from "@/lib/supabase/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function UsersRegisterPage() {
  const auth = await requireActiveUser()

  if (!auth.ok) {
    return (
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Não foi possível carregar usuários</CardTitle>
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
              Apenas usuários com função admin podem acessar o cadastro de usuários.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild variant="outline" className="border-amber-300 bg-white">
              <Link href="/registers">Voltar para Cadastros</Link>
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
              Configure SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente para administrar usuários e autorizações de cadastro.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const [{ data: invitations }, { data: profiles }, authUsersResult] = await Promise.all([
    admin
      .from("user_invitations")
      .select(
        "id, email, full_name, role, status, invited_by, accepted_user_id, expires_at, accepted_at, revoked_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("profiles")
      .select("user_id, full_name, role, status, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(300),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  const usersById = new Map<string, string | null>()
  for (const user of authUsersResult.data?.users ?? []) {
    usersById.set(user.id, user.email ?? null)
  }

  const profileViews: ProfileUserView[] = (profiles ?? []).map((profile) => ({
    ...profile,
    email: usersById.get(profile.user_id) ?? null,
  }))

  return (
    <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
      <UsersAdminClient invitations={(invitations ?? []) as UserInvitationView[]} profiles={profileViews} />
    </div>
  )
}
