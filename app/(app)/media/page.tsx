import { createClient } from "@/lib/supabase/server"
import { getExperiments } from "@/lib/supabase/experiments"
import { MediaPageClient } from "@/components/media/media-page-client"

export default async function MediaPage() {
  let experiments = []

  try {
    const supabase = await createClient()
    experiments = await getExperiments(supabase)
  } catch (error) {
    console.error("[v0] Error loading experiments:", error)
    // Return empty array on error to allow UI to render
  }

  const items =
    (experiments ?? []).map((exp) => ({
      id: exp.id,
      number: String(exp.number).padStart(3, "0"),
      strain: exp.strain,
      startDate: exp.startDate,
      testCount: exp.testCount,
      repetitionCount: exp.repetitionCount,
    })) ?? []

  return <MediaPageClient initialExperiments={items} />
}
