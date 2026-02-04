import { buildTestPhotoPath } from "@/lib/pdi/storage-path"

type SaveMergedInput = {
  supabase: any
  userId: string
  testId: string
  day: 7 | 14
  dataUrls: string[] // 6 imagens (data:image/...)
}

/** cria mosaico 3x2 e devolve Blob jpg */
export async function createMosaicBlob(imageDataUrls: string[]) {
  const cols = 3
  const rows = 2
  const cellW = 1000
  const cellH = 750
  const quality = 0.9

  const load = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })

  const imgs = await Promise.all(imageDataUrls.slice(0, 6).map((u) => load(u)))

  const canvas = document.createElement("canvas")
  canvas.width = cols * cellW
  canvas.height = rows * cellH
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D indisponível")

  ctx.fillStyle = "#111827"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const drawCover = (img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) => {
    const iw = img.naturalWidth || img.width
    const ih = img.naturalHeight || img.height
    const ir = iw / ih
    const dr = dw / dh

    let sx = 0, sy = 0, sw = iw, sh = ih
    if (ir > dr) {
      sw = Math.round(ih * dr)
      sx = Math.round((iw - sw) / 2)
    } else {
      sh = Math.round(iw / dr)
      sy = Math.round((ih - sh) / 2)
    }
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
  }

  imgs.forEach((img, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = col * cellW
    const y = row * cellH
    const gutter = 6
    drawCover(img, x + gutter, y + gutter, cellW - gutter * 2, cellH - gutter * 2)
  })

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar JPG"))), "image/jpeg", quality)
  })

  return blob
}

async function listDayFiles(supabase: any, userId: string, testId: string, day: 7 | 14) {
  const folder = `${userId}/${testId}`
  const { data, error } = await supabase.storage.from("test-photos").list(folder, { limit: 1000 })
  if (error) return { folder, paths: [] as string[] }

  const paths =
    (data ?? [])
      .filter((o: any) => typeof o?.name === "string" && o.name.startsWith(`day${day}_`))
      .map((o: any) => `${folder}/${o.name}`)

  return { folder, paths }
}

export async function saveMergedPhotosForDay({ supabase, userId, testId, day, dataUrls }: SaveMergedInput) {
  const valid = dataUrls.filter((p) => typeof p === "string" && p.startsWith("data:image/")).slice(0, 6)
  if (valid.length !== 6) {
    throw new Error(`Você precisa capturar 6 fotos do dia ${day} antes de salvar.`)
  }

  // candidatos a apagar (arquivos antigos do dia) – só apaga depois do sucesso
  const existingDayFiles = await listDayFiles(supabase, userId, testId, day)

  // também pega o merged atual no DB (para segurança)
  const { data: currentMerged } = await supabase
    .from("test_photos")
    .select("id, storage_path")
    .eq("test_id", testId)
    .eq("day", day)
    .eq("kind", "merged")
    .order("created_at", { ascending: false })
    .maybeSingle()

  const oldMergedPath = currentMerged?.storage_path ?? null

  // 1) gera mosaico
  const mosaicBlob = await createMosaicBlob(valid)
  const newPath = buildTestPhotoPath({
    userId,
    testId,
    day,
    index: 99,
    ext: "jpg",
    timestamp: Date.now(),
  })

  // 2) upload do novo mosaico
  const { error: upError } = await supabase.storage.from("test-photos").upload(newPath, mosaicBlob, {
    contentType: "image/jpeg",
    upsert: true,
  })
  if (upError) throw upError

  // 3) upsert DB (1 registro merged por dia)
  const { error: dbError } = await supabase.from("test_photos").upsert(
    {
      test_id: testId,
      day,
      storage_path: newPath,
      kind: "merged",
      photo_index: null,
    },
    { onConflict: "test_id,day,kind" } // funciona com o unique index parcial quando kind='merged'
  )
  if (dbError) {
    // rollback best-effort
    await supabase.storage.from("test-photos").remove([newPath])
    throw dbError
  }

  // 4) agora sim apaga arquivos antigos do dia (inclui singles antigos e merged antigo)
  const toDelete = new Set<string>()

  for (const p of existingDayFiles.paths) {
    if (p !== newPath) toDelete.add(p)
  }

  if (oldMergedPath && oldMergedPath !== newPath) {
    toDelete.add(oldMergedPath)
  }

  if (toDelete.size) {
    await supabase.storage.from("test-photos").remove(Array.from(toDelete))
  }

  // 5) limpa registros antigos do DB do mesmo dia (mantém só merged)
  // (se você tiver singles antigos no banco de versões anteriores)
  await supabase.from("test_photos").delete().eq("test_id", testId).eq("day", day).neq("kind", "merged")
}
