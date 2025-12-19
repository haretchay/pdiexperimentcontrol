import type { SupabaseClient } from "@supabase/supabase-js"

export async function listExperiments(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("experiments")
    .select("*")
    .order("id", { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function createExperiment(
  supabase: SupabaseClient,
  input: {
    number: number
    start_date?: string
    strain?: string
    repetition_count: number
    test_count: number
    test_types?: string[]
  }
) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("experiments")
    .insert({ user_id: auth.user.id, ...input })
    .select("*")
    .single()

  if (error) throw error
  return data
}
