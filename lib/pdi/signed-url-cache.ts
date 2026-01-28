import type { SupabaseClient } from "@supabase/supabase-js"

type CacheEntry = {
  url: string
  expiresAt: number
}

// Cache em memória (por aba). Evita chamar createSignedUrl repetidamente.
const cache = new Map<string, CacheEntry>()

// Margem de segurança antes de expirar
const SAFETY_MS = 30_000

function now() {
  return Date.now()
}

/**
 * Retorna signed URL com cache em memória.
 * Útil para páginas que carregam várias fotos e podem re-renderizar.
 */
export async function getSignedUrlCached(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  expiresInSeconds: number = 60 * 60,
): Promise<string> {
  const key = `${bucket}:${path}`
  const hit = cache.get(key)
  if (hit && hit.expiresAt - SAFETY_MS > now()) {
    return hit.url
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds)
  if (error || !data?.signedUrl) {
    console.error("[storage] createSignedUrl error:", error)
    return ""
  }

  cache.set(key, {
    url: data.signedUrl,
    expiresAt: now() + expiresInSeconds * 1000,
  })

  return data.signedUrl
}

export function clearSignedUrlCache(prefix?: string) {
  if (!prefix) {
    cache.clear()
    return
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}
