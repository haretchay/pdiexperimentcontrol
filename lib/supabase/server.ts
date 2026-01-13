import "server-only"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export function createClient() {
  const cookieStore = cookies()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    console.error("[v0] Missing Supabase environment variables")
    console.error("[v0] NEXT_PUBLIC_SUPABASE_URL:", url ? "SET" : "MISSING")
    console.error("[v0] NEXT_PUBLIC_SUPABASE_ANON_KEY:", anon ? "SET" : "MISSING")

    // Fornecer valores default para preview funcionar (não seguro para produção)
    return createServerClient(url || "https://placeholder.supabase.co", anon || "placeholder-anon-key", {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // pode falhar em Server Components (ok)
          }
        },
      },
    })
  }

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // pode falhar em Server Components (ok)
        }
      },
    },
  })
}
