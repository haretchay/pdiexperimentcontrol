import { assertValidTestPhotoPath, buildTestPhotoPath } from "@/lib/pdi/storage-path"

const TEST_PHOTOS_BUCKET = "test-photos"
const MOSAIC_COLS = 3
const MOSAIC_ROWS = 2
const MOSAIC_CELL_WIDTH = 1000
const MOSAIC_CELL_HEIGHT = 750
const MOSAIC_GUTTER = 6
const MOSAIC_BACKGROUND = "#111827"
const MOSAIC_QUALITY = 0.9
const MERGED_PHOTO_INDEX = 0

type Day = 7 | 14

type SaveMergedInput = {
  supabase: any
  userId: string
  testId: string
  day: Day
  dataUrls: string[]
}

type TestPhotoRow = {
  id: string
  storage_path: string | null
  kind?: "single" | "merged" | null
}

const isDataUrlImage = (value: unknown): value is string => {
  return typeof value === "string" && value.startsWith("data:image/")
}

function ensureBrowserCanvasAvailable() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("A geração do mosaico de fotos precisa ser executada no navegador.")
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Falha ao carregar uma das imagens para gerar o mosaico."))
    img.src = src
  })
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const imageWidth = img.naturalWidth || img.width
  const imageHeight = img.naturalHeight || img.height

  if (!imageWidth || !imageHeight) {
    throw new Error("Imagem inválida para geração do mosaico.")
  }

  const imageRatio = imageWidth / imageHeight
  const destinationRatio = dw / dh

  let renderWidth = dw
  let renderHeight = dh

  if (imageRatio > destinationRatio) {
    renderHeight = dw / imageRatio
  } else {
    renderWidth = dh * imageRatio
  }

  const x = dx + (dw - renderWidth) / 2
  const y = dy + (dh - renderHeight) / 2

  ctx.fillStyle = MOSAIC_BACKGROUND
  ctx.fillRect(dx, dy, dw, dh)
  ctx.drawImage(img, x, y, renderWidth, renderHeight)
}

/**
 * Cria um mosaico 3x2 com 6 fotos e devolve um Blob JPG.
 * As imagens são desenhadas no modo "contain", sem cortar bordas/legendas.
 */
export async function createMosaicBlob(imageDataUrls: string[]) {
  ensureBrowserCanvasAvailable()

  const validImages = imageDataUrls.filter(isDataUrlImage).slice(0, MOSAIC_COLS * MOSAIC_ROWS)

  if (validImages.length !== MOSAIC_COLS * MOSAIC_ROWS) {
    throw new Error("São necessárias exatamente 6 fotos válidas para gerar o mosaico.")
  }

  const images = await Promise.all(validImages.map(loadImage))

  const canvas = document.createElement("canvas")
  canvas.width = MOSAIC_COLS * MOSAIC_CELL_WIDTH
  canvas.height = MOSAIC_ROWS * MOSAIC_CELL_HEIGHT

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D indisponível.")

  ctx.fillStyle = MOSAIC_BACKGROUND
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  images.forEach((img, index) => {
    const col = index % MOSAIC_COLS
    const row = Math.floor(index / MOSAIC_COLS)
    const x = col * MOSAIC_CELL_WIDTH
    const y = row * MOSAIC_CELL_HEIGHT

    drawContain(
      ctx,
      img,
      x + MOSAIC_GUTTER,
      y + MOSAIC_GUTTER,
      MOSAIC_CELL_WIDTH - MOSAIC_GUTTER * 2,
      MOSAIC_CELL_HEIGHT - MOSAIC_GUTTER * 2,
    )
  })

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }

        reject(new Error("Falha ao gerar JPG do mosaico."))
      },
      "image/jpeg",
      MOSAIC_QUALITY,
    )
  })
}

async function listDayStorageFiles(supabase: any, userId: string, testId: string, day: Day) {
  const folder = `${userId}/${testId}`
  const { data, error } = await supabase.storage.from(TEST_PHOTOS_BUCKET).list(folder, { limit: 1000 })

  if (error) {
    console.warn("[merged-photos] Não foi possível listar arquivos antigos do dia:", error)
    return [] as string[]
  }

  return (data ?? [])
    .filter((object: any) => typeof object?.name === "string" && object.name.startsWith(`day${day}_`))
    .map((object: any) => `${folder}/${object.name}`)
}

async function listDayDatabaseRows(supabase: any, testId: string, day: Day) {
  const { data, error } = await supabase
    .from("test_photos")
    .select("id, storage_path, kind")
    .eq("test_id", testId)
    .eq("day", day)

  if (error) throw error
  return (data ?? []) as TestPhotoRow[]
}

/**
 * Salva somente o mosaico final de um dia (kind='merged') no bucket test-photos.
 *
 * Fluxo seguro:
 * 1. gera o novo mosaico;
 * 2. faz upload do novo arquivo;
 * 3. grava o novo registro no banco;
 * 4. só depois remove registros/arquivos antigos do mesmo dia.
 *
 * Isso evita perda das fotos antigas caso o upload ou insert falhe no meio do processo.
 */
export async function saveMergedPhotosForDay({ supabase, userId, testId, day, dataUrls }: SaveMergedInput) {
  const validImages = dataUrls.filter(isDataUrlImage).slice(0, MOSAIC_COLS * MOSAIC_ROWS)

  if (validImages.length !== MOSAIC_COLS * MOSAIC_ROWS) {
    throw new Error(`Você precisa capturar 6 fotos do dia ${day} antes de salvar.`)
  }

  const oldStoragePaths = await listDayStorageFiles(supabase, userId, testId, day)
  const oldDatabaseRows = await listDayDatabaseRows(supabase, testId, day)

  const mosaicBlob = await createMosaicBlob(validImages)
  const mergedPath = buildTestPhotoPath({
    userId,
    testId,
    day,
    index: 99,
    ext: "jpg",
    timestamp: Date.now(),
  })

  assertValidTestPhotoPath(mergedPath, { userId, testId })

  const { error: uploadError } = await supabase.storage.from(TEST_PHOTOS_BUCKET).upload(mergedPath, mosaicBlob, {
    contentType: "image/jpeg",
    upsert: true,
  })

  if (uploadError) throw uploadError

  const { error: upsertError } = await supabase.from("test_photos").upsert(
    {
      test_id: testId,
      day,
      storage_path: mergedPath,
      kind: "merged",
      photo_index: MERGED_PHOTO_INDEX,
    },
    { onConflict: "test_id,day,kind,photo_index" },
  )

  if (upsertError) {
    await supabase.storage.from(TEST_PHOTOS_BUCKET).remove([mergedPath])
    throw upsertError
  }

  // Modo econômico: mantemos somente o mosaico final do dia no banco.
  await supabase.from("test_photos").delete().eq("test_id", testId).eq("day", day).neq("kind", "merged")

  const pathsToRemove = new Set<string>()

  for (const path of oldStoragePaths) {
    if (path && path !== mergedPath) pathsToRemove.add(path)
  }

  for (const row of oldDatabaseRows) {
    const path = row.storage_path
    if (path && path !== mergedPath) pathsToRemove.add(path)
  }

  if (pathsToRemove.size) {
    await supabase.storage.from(TEST_PHOTOS_BUCKET).remove(Array.from(pathsToRemove))
  }

  return { uploaded: 1, mergedPath }
}
