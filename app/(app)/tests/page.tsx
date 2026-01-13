import { createClient } from "@/lib/supabase/server"
import { getAllTests, type TestRow } from "@/lib/supabase/tests"
import { TestsPageClient } from "@/components/tests/tests-page-client"

export type UITestRow = {
  id: string
  experimentId: string
  experimentNumber: string
  experimentStrain: string
  startDate: string
  repetitionNumber: number
  testNumber: number
  testType?: string
  unit?: string
  requisition?: string
  date7Day?: string
  date14Day?: string
}

function pad3(n: number) {
  return String(n).padStart(3, "0")
}

function mapRow(row: TestRow): UITestRow {
  const expNumber = row.experiments?.number ?? 0
  return {
    id: row.id,
    experimentId: row.experiment_id,
    experimentNumber: pad3(expNumber),
    experimentStrain: row.experiments?.strain ?? row.strain ?? "-",
    startDate: row.experiments?.start_date ?? "",
    repetitionNumber: row.repetition_number,
    testNumber: row.test_number,
    testType: row.test_type ?? undefined,
    unit: row.unit ?? undefined,
    requisition: row.requisition ?? undefined,
    date7Day: row.date_7_day ?? undefined,
    date14Day: row.date_14_day ?? undefined,
  }
}

export default async function TestsPage() {
  try {
    const supabase = await createClient()
    const rows = await getAllTests(supabase)
    const items = rows.map(mapRow)

    return <TestsPageClient initialTests={items} />
  } catch (error) {
    console.error("[v0] Error loading tests:", error)
    // Return empty state when Supabase is not configured or fails
    return <TestsPageClient initialTests={[]} />
  }
}
