import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"

/**
 * Supabase admin client (Service Role) for server-only operations.
 * - Bypasses RLS
 * - Must NEVER be imported into client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
  }
  // If the service key isn't configured, we return null so callers can fall back
  // to the normal (RLS-bound) server client.
  if (!serviceKey) return null

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
