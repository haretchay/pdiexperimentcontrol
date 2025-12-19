import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardClient } from "@/components/dashboard/dashboard-client"
import { getExperiments, getTestsByExperiment } from "@/lib/supabase/experiments"

export default async function DashboardPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const experiments = await getExperiments(supabase)

  const experimentData = await Promise.all(
    experiments.map(async (experiment) => {
      const tests = await getTestsByExperiment(supabase, experiment.id)
      return {
        ...experiment,
        testsData: tests,
        completedTests: tests.length,
      }
    })
  )

  return <DashboardClient experiments={experiments} experimentData={experimentData} />
}
