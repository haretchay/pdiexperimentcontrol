import type { SupabaseClient } from "@supabase/supabase-js"
import { SignedUrlCache } from "@/lib/pdi/signed-url-cache"
import { assertValidTestPhotoPath, buildTestPhotoPath } from "@/lib/pdi/storage-path"

const ENABLE_INDIVIDUAL_PHOTOS = false
const MERGED_PHOTO_INDEX = 0

export type TestPhotoRow = {
  id: string
  test_id: string
  day: 7 | 14
  storage_path: string
  created_at: string
  kind?: "single" | "merged"
  photo_index?: number | null
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
    .select("id, test_id, day, storage_path, created_at, kind, photo_index")
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

  if (!ENABLE_INDIVIDUAL_PHOTOS) {
    throw new Error("Salvamento de fotos individuais está desativado (modo econômico).");
  }

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
    .eq("kind", "single")

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

    // Gravar banco por slot (test_id, day, kind, photo_index).
    // Isso evita duplicidade ao substituir fotos do mesmo dia.
    const payload = uploadedPaths.map((p, idx) => ({
      test_id: testId,
      day,
      storage_path: p,
      kind: "single",
      photo_index: idx + 1,
    }))

    const { error: insErr } = await supabase.from("test_photos").upsert(payload, {
      onConflict: "test_id,day,kind,photo_index",
    })
    if (insErr) throw insErr

    // Remove apenas registros antigos que não possuem mais posição correspondente.
    const newPhotoIndexes = new Set(payload.map((item) => item.photo_index))
    const staleRows = oldRows.filter((row) => !newPhotoIndexes.has(Number(row.photo_index)))
    const staleIds = staleRows.map((row) => row.id).filter(Boolean)

    if (staleIds.length) {
      await supabase.from("test_photos").delete().in("id", staleIds)
    }

    // Remove arquivos antigos somente depois do banco apontar para os arquivos novos.
    const newPaths = new Set(uploadedPaths)
    const oldPathsToRemove = oldPaths.filter((path) => path && !newPaths.has(path))
    if (oldPathsToRemove.length) {
      await supabase.storage.from("test-photos").remove(oldPathsToRemove)
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
/**
 * Substitui a foto MESCLADA (mosaico) de um dia (7 ou 14):
 * - faz upload do mosaico
 * - grava no banco com kind='merged'
 * - só depois remove a antiga (kind='merged')
 *
 * Nome do arquivo usa index=99 para continuar compatível com a validação de path.
 */
export async function replaceMergedDayPhoto(params: {
  supabase: SupabaseClient
  userId: string
  testId: string
  day: 7 | 14
  mosaicBlob: Blob
}) {
  const { supabase, userId, testId, day, mosaicBlob } = params

  if (!isUuid(userId)) throw new Error(`replaceMergedDayPhoto: userId invalido (UUID). Recebido: "${String(userId)}"`)
  if (!isUuid(testId)) throw new Error(`replaceMergedDayPhoto: testId invalido (UUID). Recebido: "${String(testId)}"`)

  // Arquivos antigos (limpeza após sucesso)
  const { data: old, error: oldErr } = await supabase
    .from("test_photos")
    .select("id, storage_path, kind")
    .eq("test_id", testId)
    .eq("day", day)

  if (oldErr) throw oldErr
  const oldRows = (old ?? []) as any[]
  const oldPaths = oldRows.map((r) => r.storage_path).filter(Boolean)

  // Pega o merged atual do DB para remover do Storage depois (best-effort)
  const currentMerged = oldRows.find((r) => r.kind === "merged")
  const oldMergedPath = currentMerged?.storage_path ?? null

  const mergedPath = buildTestPhotoPath({
    userId,
    testId,
    day,
    index: 99,
    ext: "jpg",
    timestamp: Date.now(),
  })

  assertValidTestPhotoPath(mergedPath, { userId, testId })

  // 1) Upload do novo mosaico
  const { error: upErr } = await supabase.storage.from("test-photos").upload(mergedPath, mosaicBlob, {
    contentType: "image/jpeg",
    upsert: true,
  })
  if (upErr) throw upErr

  // 2) UPSERT no DB (1 registro merged por dia)
  // Requer UNIQUE/INDEX em (test_id, day, kind, photo_index).
  // Para mosaico, usamos photo_index=0.
  const { error: upDbErr } = await supabase.from("test_photos").upsert(
    {
      test_id: testId,
      day,
      storage_path: mergedPath,
      kind: "merged",
      photo_index: MERGED_PHOTO_INDEX,
    },
    { onConflict: "test_id,day,kind,photo_index" },
  )

  if (upDbErr) {
    await supabase.storage.from("test-photos").remove([mergedPath])
    throw upDbErr
  }

  // 3) Remove quaisquer singles antigos do DB (modo econômico)
  await supabase.from("test_photos").delete().eq("test_id", testId).eq("day", day).neq("kind", "merged")

  // 4) Remove arquivos antigos do Storage APÓS salvar o novo (não remove o novo path)
  const toRemove = new Set<string>()
  for (const p of oldPaths) {
    if (p && p !== mergedPath) toRemove.add(p)
  }
  if (oldMergedPath && oldMergedPath !== mergedPath) toRemove.add(oldMergedPath)

  if (toRemove.size) {
    await supabase.storage.from("test-photos").remove(Array.from(toRemove))
  }

  return { uploaded: 1, mergedPath }
}
