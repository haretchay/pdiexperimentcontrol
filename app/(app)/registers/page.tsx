import Link from "next/link"
import { Database, ShieldCheck, UserCog } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageTitle } from "@/components/page-title"

export default function RegistersPage() {
  return (
    <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
      <PageTitle title="Cadastros" />

      <div className="overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-800 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white/80">
            <Database className="h-4 w-4" />
            Administração do sistema
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Cadastros</h1>
          <p className="max-w-2xl text-sm leading-6 text-white/75">
            Centralize os cadastros de apoio do PDI - Test Control. Nesta etapa, o cadastro de usuários já está disponível
            com convite seguro enviado por administradores.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Link href="/registers/users" className="group block">
          <Card className="h-full border-blue-100 shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-300 group-hover:shadow-md">
            <CardHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 text-blue-700">
                <UserCog className="h-6 w-6" />
              </div>
              <CardTitle>Usuários</CardTitle>
              <CardDescription>Gerar convites, controlar perfis e liberar acessos autorizados.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Disponível
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
