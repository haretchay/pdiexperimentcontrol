import Link from "next/link"
import { ArrowRight, FlaskConical, Settings2 } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageTitle } from "@/components/page-title"

export default function RegisterParametersPage() {
  return (
    <div className="w-full space-y-5 px-4 py-4 sm:px-6 lg:px-8">
      <PageTitle title="Cadastro Parâmetros" />

      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-800 p-5 text-white shadow-xl">
        <div className="flex flex-col gap-2">
          <div className="inline-flex w-fit items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
            <Settings2 className="mr-2 h-3.5 w-3.5" /> Parâmetros do sistema
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">Cadastros diversos</h1>
          <p className="max-w-3xl text-sm leading-6 text-white/80">
            Central para manter os parâmetros usados em telas operacionais, relatórios e regras de preenchimento do PDI - Test Control.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link href="/registers/parameters/fungi" className="group block">
          <Card className="h-full rounded-2xl border-blue-100/80 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg dark:border-slate-800 dark:hover:border-blue-800">
            <CardHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-700 text-white shadow-md">
                <FlaskConical className="h-6 w-6" />
              </div>
              <CardTitle>Cadastro de Fungos</CardTitle>
              <CardDescription>
                Cadastre nome científico, temperaturas de referência e siglas utilizadas para identificação dos fungos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="inline-flex items-center text-sm font-medium text-blue-700 group-hover:text-purple-700 dark:text-blue-300 dark:group-hover:text-purple-300">
                Abrir fungos <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
