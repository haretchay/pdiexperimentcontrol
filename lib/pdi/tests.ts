import type { SupabaseClient } from "@supabase/supabase-js"

export async function upsertTest(
  supabase: SupabaseClient,
  input: { experiment_id: number; repetition: number; test_number: number; data: Record<string, any> }
) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("tests")
    .upsert(
      { user_id: auth.user.id, ...input },
      { onConflict: "experiment_id,repetition,test_number" }
    )
    .select("*")
    .single()

  if (error) throw error
  return data
}

export async function listTestsByExperiment(supabase: SupabaseClient, experimentId: number) {
  const { data, error } = await supabase
    .from("tests")
    .select("*")
    .eq("experiment_id", experimentId)

  if (error) throw error
  return data ?? []
}
