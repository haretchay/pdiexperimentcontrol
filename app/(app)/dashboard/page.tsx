import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardClient } from "@/components/dashboard/dashboard-client"
import { getExperiments, getTestsByExperiment } from "@/lib/supabase/experiments"

export const runtime = "nodejs"

function isRateLimitError(err: unknown) {
  const msg = String((err as any)?.message ?? err ?? "")
  const status = (err as any)?.status

  return (
    status === 429 ||
    msg.includes("Too Many") ||
    msg.includes("Too many") ||
    msg.includes("rate limit") ||
    msg.includes("Unexpected token 'T'") // quando a resposta começa com "Too Many R..."
  )
}

export default async function DashboardPage() {
  const supabase = createClient()

  // 1) Autenticação (não entrar em loop por causa de 429)
  try {
    const { data, error } = await supabase.auth.getUser()

    if (error) {
      // Se for rate limit, não redireciona pro login (evita looping)
      if (isRateLimitError(error)) {
        return (
          <div className="p-6">
            <h1 className="text-xl font-semibold">Muitas requisições ao Supabase</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Você atingiu temporariamente o limite de requisições do Supabase (429).
              Aguarde alguns segundos e recarregue a página.
            </p>
            <p className="mt-4 text-sm">
              Se isso continuar acontecendo, é sinal de que algum componente está chamando
              getUser/getSession em loop (vamos corrigir isso em seguida).
            </p>
          </div>
        )
      }

      console.error("[v0] Error getting user:", error)
      redirect("/auth/login")
    }

    const user = data.user
    if (!user) {
      redirect("/auth/login")
    }
  } catch (err) {
    // Alguns 429 voltam como texto e estouram como exceção/parse — trate como rate limit também
    if (isRateLimitError(err)) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-semibold">Muitas requisições ao Supabase</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O Supabase respondeu com rate-limit (429) e a requisição foi interrompida.
            Aguarde alguns segundos e recarregue a página.
          </p>
          <p className="mt-4 text-sm">
            Próximo passo: vamos identificar onde o app está disparando chamadas repetidas
            de autenticação no client.
          </p>
        </div>
      )
    }

    console.error("[v0] Exception getting user:", err)
    redirect("/auth/login")
  }

  // 2) Carregamento dos dados (se falhar, mantém vazio sem derrubar a página)
  let experiments: any[] = []
  let experimentData: any[] = []

  try {
    experiments = await getExperiments(supabase)

    experimentData = await Promise.all(
      experiments.map(async (experiment) => {
        const tests = await getTestsByExperiment(supabase, experiment.id)
        return {
          ...experiment,
          testsData: tests,
          completedTests: tests.length,
        }
      }),
    )
  } catch (error) {
    console.error("[v0] Error loading experiments:", error)
  }

  return <DashboardClient experiments={experiments} experimentData={experimentData} />
}
