import { NextResponse } from "next/server"

import { requireAdminForRoute } from "@/lib/pdi/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type FungusPayload = {
  scientificName?: unknown
  optimalTemperature?: unknown
  minTemperature?: unknown
  maxTemperature?: unknown
  acronyms?: unknown
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeTemperature(value: unknown) {
  const text = normalizeText(value).replace(",", ".")
  if (!/^-?\d{1,3}(\.\d)?$/.test(text)) return null
  const number = Number(text)
  if (!Number.isFinite(number)) return null
  return Math.round(number * 10) / 10
}

function normalizeAcronyms(value: unknown) {
  const list = Array.isArray(value) ? value : []
  const acronyms = list
    .map((item) => normalizeText(item).replace(/[^a-zA-Z]/g, "").toUpperCase())
    .filter(Boolean)

  return Array.from(new Set(acronyms))
}

function validatePayload(payload: FungusPayload) {
  const scientificName = normalizeText(payload.scientificName)
  const optimalTemperature = normalizeTemperature(payload.optimalTemperature)
  const minTemperature = normalizeTemperature(payload.minTemperature)
  const maxTemperature = normalizeTemperature(payload.maxTemperature)
  const acronyms = normalizeAcronyms(payload.acronyms)

  if (scientificName.length < 3) return { ok: false as const, error: "Informe o nome científico do fungo." }
  if (optimalTemperature === null) return { ok: false as const, error: "Informe a temperatura ótima com no máximo 1 casa decimal." }
  if (minTemperature === null) return { ok: false as const, error: "Informe a temperatura mínima com no máximo 1 casa decimal." }
  if (maxTemperature === null) return { ok: false as const, error: "Informe a temperatura máxima com no máximo 1 casa decimal." }
  if (minTemperature > maxTemperature) return { ok: false as const, error: "A temperatura mínima não pode ser maior que a máxima." }
  if (optimalTemperature < minTemperature || optimalTemperature > maxTemperature) {
    return { ok: false as const, error: "A temperatura ótima deve ficar dentro da faixa mínima e máxima." }
  }
  if (acronyms.length === 0) return { ok: false as const, error: "Informe pelo menos uma sigla." }

  const invalidAcronym = acronyms.find((acronym) => !/^[A-Z]{3,6}$/.test(acronym))
  if (invalidAcronym) return { ok: false as const, error: "Cada sigla deve ter de 3 a 6 letras maiúsculas." }

  return {
    ok: true as const,
    data: {
      scientific_name: scientificName,
      optimal_temperature: optimalTemperature,
      min_temperature: minTemperature,
      max_temperature: maxTemperature,
      acronyms,
    },
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminForRoute()
  if (!auth.ok) return auth.response

  try {
    const payload = (await request.json().catch(() => ({}))) as FungusPayload
    const validation = validatePayload(payload)

    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { data, error } = await auth.admin
      .from("fungi")
      .insert({
        ...validation.data,
        created_by: auth.user.id,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message || "Não foi possível cadastrar o fungo." }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível cadastrar o fungo."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
