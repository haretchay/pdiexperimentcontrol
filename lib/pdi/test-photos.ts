import type { SupabaseClient } from "@supabase/supabase-js"
import { SignedUrlCache } from "@/lib/pdi/signed-url-cache"
import { assertValidTestPhotoPath, buildTestPhotoPath } from "@/lib/pdi/storage-path"

export type TestPhotoRow = {
  id: string
  test_id: string
  day: 7 | 14
  storage_path: string
  created_at: string
}

const isDataUrlImage = (s?: string) => typeof s === "string" && s.startsWith("data:image/")

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value ?? ""))
}

export async function getTestPhotos(
  supabase: SupabaseClient,
  testId: string,
): Promise<TestPhotoRow[]> {
  const { data, error } = await supabase
    .from("test_photos")
    .select("id, test_id, day, storage_path, created_at")
    .eq("test_id", testId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as TestPhotoRow[]
}

export async function getSignedUrlsForPaths(
  supabase: SupabaseClient,
  paths: string[],
  opts?: { ttlSeconds?: number; cache?: SignedUrlCache },
) {
  const ttl = opts?.ttlSeconds ?? 3600
  const cache = opts?.cache

  const unique = Array.from(new Set(paths.filter(Boolean)))

  const results = await Promise.all(
    unique.map(async (path) => {
      const cached = cache?.get(path)
      if (cached) return { path, url: cached }

      const { data, error } = await supabase.storage.from("test-photos").createSignedUrl(path, ttl)
      if (error || !data?.signedUrl) {
        console.error("[photos] createSignedUrl error:", error)
        return { path, url: "" }
      }

      cache?.set(path, data.signedUrl, ttl)
      return { path, url: data.signedUrl }
    }),
  )

  const map = new Map(results.map((r) => [r.path, r.url] as const))
  return paths.map((p) => map.get(p) || "")
}

/**
 * Substitui as fotos de um dia (7 ou 14):
 * - faz upload das novas
 * - grava no banco
 * - só depois remove as antigas
 *
 * Isso evita o bug de "apagou as antigas e falhou no meio".
 */
export async function replaceDayPhotos(params: {
  supabase: SupabaseClient
  userId: string
  testId: string
  day: 7 | 14
  photos: string[] // data URLs
}) {
  const { supabase, userId, testId, day, photos } = params

  if (!isUuid(userId)) throw new Error(`replaceDayPhotos: userId invalido (UUID). Recebido: "${String(userId)}"`)
  if (!isUuid(testId)) throw new Error(`replaceDayPhotos: testId invalido (UUID). Recebido: "${String(testId)}"`)

  // Se tiver algum dataURL, exigimos que TODAS sejam dataURL (evita misturar url antiga + nova)
  const hasAnyData = photos.some((p) => isDataUrlImage(p))
  if (!hasAnyData) return { uploaded: 0 }
  if (!photos.every((p) => isDataUrlImage(p))) {
    throw new Error(
      "Mistura de fotos antigas (URL) com fotos novas (data:image). Para substituir, recapture todas as fotos desse dia.",
    )
  }

  // Busca antigas
  const { data: old, error: oldErr } = await supabase
    .from("test_photos")
    .select("id, storage_path")
    .eq("test_id", testId)
    .eq("day", day)

  if (oldErr) throw oldErr
  const oldRows = (old ?? []) as any[]
  const oldPaths = oldRows.map((r) => r.storage_path).filter(Boolean)

  // Upload novas
  const uploadedPaths: string[] = []

  try {
    for (let i = 0; i < photos.length; i++) {
      const dataUrl = photos[i]
      const res = await fetch(dataUrl)
      const blob = await res.blob()

      const filePath = buildTestPhotoPath({
        userId,
        testId,
        day,
        index: i + 1,
        ext: "jpg",
      })

      assertValidTestPhotoPath(filePath, { userId, testId })

      const { error: uploadError } = await supabase.storage.from("test-photos").upload(filePath, blob, {
        contentType: "image/jpeg",
        upsert: true,
      })

      if (uploadError) throw uploadError
      uploadedPaths.push(filePath)
    }

    // Gravar banco (1 insert)
    const payload = uploadedPaths.map((p) => ({ test_id: testId, day, storage_path: p }))
    const { error: insErr } = await supabase.from("test_photos").insert(payload)
    if (insErr) throw insErr

    // Remover antigas somente após novo insert
    if (oldRows.length) {
      const oldIds = oldRows.map((r) => r.id).filter(Boolean)
      if (oldIds.length) {
        await supabase.from("test_photos").delete().in("id", oldIds)
      }
      if (oldPaths.length) {
        await supabase.storage.from("test-photos").remove(oldPaths)
      }
    }

    return { uploaded: uploadedPaths.length }
  } catch (err) {
    // rollback: tenta apagar uploads novos se falhou antes de apagar antigos
    if (uploadedPaths.length) {
      try {
        await supabase.storage.from("test-photos").remove(uploadedPaths)
      } catch {
        // best effort
      }
    }
    throw err
  }
}
