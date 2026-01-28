export type SignedUrlEntry = {
  url: string
  expiresAtMs: number
}

/**
 * Cache simples em memória (por aba) para evitar criar signed URL repetidamente.
 * Observação: em refresh perde (por design), mas já corta loops de chamadas.
 */
export class SignedUrlCache {
  private map = new Map<string, SignedUrlEntry>()

  get(path: string): string | null {
    const entry = this.map.get(path)
    if (!entry) return null
    if (Date.now() > entry.expiresAtMs) {
      this.map.delete(path)
      return null
    }
    return entry.url
  }

  set(path: string, url: string, ttlSeconds: number) {
    const ttl = Math.max(1, ttlSeconds)
    this.map.set(path, { url, expiresAtMs: Date.now() + ttl * 1000 })
  }

  clear() {
    this.map.clear()
  }
}
