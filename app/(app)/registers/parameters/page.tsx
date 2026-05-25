import Link from "next/link"
import { ArrowRight, FlaskConical, Settings2, Biohazard, Ruler, Snowflake } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageTitle } from "@/components/page-title"

const parameterCards = [
  {
    title: "Cadastro de Fungos",
    description: "Cadastre nome científico, temperaturas de referência e siglas utilizadas para identificação dos fungos.",
    href: "/registers/parameters/fungi",
    actionLabel: "Abrir fungos",
    icon: FlaskConical,
    available: true,
  },
  {
    title: "Cadastro de Contaminantes",
    description: "Parâmetros para padronizar contaminantes usados nos testes e nos lançamentos de descarte.",
    href: "#",
    actionLabel: "Em construção",
    icon: Biohazard,
    available: false,
  },
  {
    title: "Cadastro de Unidades",
    description: "Cadastro das unidades operacionais e laboratoriais que serão utilizadas nos formulários.",
    href: "#",
    actionLabel: "Em construção",
    icon: Ruler,
    available: false,
  },
  {
    title: "Cadastro de Câmaras Frias",
    description: "Cadastro das câmaras frias para organizar locais de armazenamento e acompanhamento dos testes.",
    href: "#",
    actionLabel: "Em construção",
    icon: Snowflake,
    available: false,
  },
] as const

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {parameterCards.map((card) => {
          const Icon = card.icon
          const content = (
            <Card className={`h-full rounded-2xl border-blue-100/80 shadow-sm transition-all dark:border-slate-800 ${
              card.available
                ? "hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg dark:hover:border-blue-800"
                : "border-dashed bg-slate-50/70 opacity-90 dark:bg-slate-950/30"
            }`}>
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-700 text-white shadow-md">
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`inline-flex items-center text-sm font-medium ${
                  card.available
                    ? "text-blue-700 group-hover:text-purple-700 dark:text-blue-300 dark:group-hover:text-purple-300"
                    : "text-muted-foreground"
                }`}>
                  {card.actionLabel}
                  {card.available ? <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" /> : null}
                </div>
              </CardContent>
            </Card>
          )

          if (!card.available) {
            return (
              <div key={card.title} className="block cursor-not-allowed">
                {content}
              </div>
            )
          }

          return (
            <Link key={card.title} href={card.href} className="group block">
              {content}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
