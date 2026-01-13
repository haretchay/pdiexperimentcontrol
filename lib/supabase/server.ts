import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * IMPORTANTE: Com Fluid Compute, não coloque este cliente em uma variável global.
 * Sempre crie um novo cliente dentro de cada função ao usá-lo.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // O método "setAll" foi chamado de um Server Component.
          // Isso pode ser ignorado se você tiver middleware atualizando
          // as sessões do usuário.
        }
      },
    },
  })
}
