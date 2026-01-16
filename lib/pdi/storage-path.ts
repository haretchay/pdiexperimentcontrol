export type BuildTestPhotoPathArgs = {
  userId: string
  testId: string
  day: 7 | 14
  /** indice 1-based: 1,2,3... */
  index: number
  /** sem ponto. padrao: jpg */
  ext?: "jpg" | "jpeg" | "png" | "webp"
  /** ms. padrao: Date.now() */
  timestamp?: number
}

type AssertArgs = {
  userId: string
  testId?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FILE_RE = /^day(7|14)_photo\d+_\d+\.(jpg|jpeg|png|webp)$/i

function normalize(s: unknown) {
  return String(s ?? "").trim()
}

export function buildTestPhotoPath(args: BuildTestPhotoPathArgs): string {
  const userId = normalize(args.userId)
  const testId = normalize(args.testId)

  if (!UUID_RE.test(userId)) throw new Error("buildTestPhotoPath: userId invalido")
  if (!UUID_RE.test(testId)) throw new Error("buildTestPhotoPath: testId invalido")

  const day = args.day
  if (day !== 7 && day !== 14) throw new Error("buildTestPhotoPath: day deve ser 7 ou 14")

  const index = Number(args.index)
  if (!Number.isFinite(index) || index < 1) throw new Error("buildTestPhotoPath: index deve ser >= 1")

  const ext = (args.ext ?? "jpg").toLowerCase() as BuildTestPhotoPathArgs["ext"]
  if (!["jpg", "jpeg", "png", "webp"].includes(ext)) throw new Error("buildTestPhotoPath: ext invalida")

  const timestamp = Number(args.timestamp ?? Date.now())
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error("buildTestPhotoPath: timestamp invalido")

  const fileName = `day${day}_photo${index}_${timestamp}.${ext}`
  const path = `${userId}/${testId}/${fileName}`

  // Validacao final (garante que o que geramos realmente bate com o padrao)
  assertValidTestPhotoPath(path, { userId, testId })

  return path
}

export function assertValidTestPhotoPath(path: string, args: AssertArgs): void {
  const p = normalize(path)
  const userId = normalize(args.userId)
  const testId = args.testId ? normalize(args.testId) : undefined

  if (!p) throw new Error("storage_path vazio")
  if (p.startsWith("/")) throw new Error("storage_path nao pode comecar com '/'")
  if (p.includes("..")) throw new Error("storage_path nao pode conter '..'")

  const parts = p.split("/")
  if (parts.length !== 3) throw new Error("storage_path deve ter 3 segmentos: <userId>/<testId>/<file>")

  const [uid, tid, file] = parts

  if (!UUID_RE.test(uid)) throw new Error("storage_path: userId (segmento 1) nao parece UUID")
  if (!UUID_RE.test(tid)) throw new Error("storage_path: testId (segmento 2) nao parece UUID")

  if (!UUID_RE.test(userId)) throw new Error("assert: userId informado nao parece UUID")
  if (uid.toLowerCase() !== userId.toLowerCase()) throw new Error("storage_path nao pertence ao userId atual")

  if (testId) {
    if (!UUID_RE.test(testId)) throw new Error("assert: testId informado nao parece UUID")
    if (tid.toLowerCase() !== testId.toLowerCase()) throw new Error("storage_path nao pertence ao testId atual")
  }

  if (!FILE_RE.test(file)) throw new Error("storage_path filename fora do padrao day7/14_photoX_timestamp.ext")
}
