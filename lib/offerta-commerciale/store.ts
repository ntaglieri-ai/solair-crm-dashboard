import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  AccessorioCommerciale,
  CatalogoCommerciale,
  MatriceAccumulo,
  OffertaPeriodo,
  PrezzoFotovoltaico,
  RegolaSconto,
} from "./types"

export const OFFERTA_COMMERCIALE_ROOT =
  process.env.OFFERTA_COMMERCIALE_NEXTCLOUD_PATH?.trim() ||
  "Solair/Offerta-Commerciale"

function finite(value: unknown) {
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function text(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

export function normalizeFotovoltaico(value: unknown): PrezzoFotovoltaico[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return []
    const source = row as Record<string, unknown>
    const kwp = finite(source.kwp)
    const prezzo = finite(source.prezzo)
    return kwp != null && prezzo != null && kwp > 0 && prezzo >= 0 ? [{ kwp, prezzo }] : []
  }).sort((a, b) => a.kwp - b.kwp)
}

export function normalizeAccumuli(value: unknown): MatriceAccumulo[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return []
    const source = row as Record<string, unknown>
    const marca = text(source.marca, 80)
    const taglie = Array.isArray(source.taglie)
      ? source.taglie.map(finite).filter((item): item is number => item != null && item > 0)
      : []
    const rawPrices = source.prezzi && typeof source.prezzi === "object"
      ? source.prezzi as Record<string, unknown>
      : {}
    const prezzi = Object.fromEntries(
      Object.entries(rawPrices).map(([kwp, values]) => [
        kwp,
        Array.isArray(values)
          ? values.map(finite).map((item) => item != null && item >= 0 ? item : 0).slice(0, taglie.length)
          : [],
      ]),
    )
    if (!marca || taglie.length === 0) return []
    return [{
      marca,
      garanzia_anni: finite(source.garanzia_anni),
      ip: text(source.ip, 30) || null,
      tensione: text(source.tensione, 30) || null,
      taglie,
      prezzi,
    }]
  })
}

export function normalizeAccessori(value: unknown): AccessorioCommerciale[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return []
    const source = row as Record<string, unknown>
    const nome = text(source.nome)
    const prezzo = finite(source.prezzo)
    if (!nome || prezzo == null || prezzo < 0) return []
    return [{
      nome,
      prezzo,
      prezzo_combo: finite(source.prezzo_combo),
      unita: text(source.unita, 30) || "€",
      scontabile: source.scontabile === true,
    }]
  })
}

export function normalizeSconti(value: unknown): RegolaSconto[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return []
    const source = row as Record<string, unknown>
    const zona = text(source.zona, 30).toUpperCase()
    const kwp_min = finite(source.kwp_min)
    const kwp_max = finite(source.kwp_max)
    const percentuale = finite(source.percentuale)
    const eps_prezzo = finite(source.eps_prezzo)
    if (!zona || kwp_min == null || kwp_max == null || percentuale == null || eps_prezzo == null) return []
    return [{ zona, kwp_min, kwp_max, percentuale, eps_prezzo, eps_omaggiabile: source.eps_omaggiabile === true }]
  })
}

export async function loadOffertaCommerciale(supabase: SupabaseClient) {
  const [{ data: cataloghi, error: catalogoError }, { data: offerte, error: offerteError }, { data: documenti, error: documentiError }] = await Promise.all([
    supabase.from("offerta_commerciale_cataloghi").select("*").order("aggiornato_at", { ascending: false }),
    supabase.from("offerta_commerciale_offerte").select("*").order("ordinamento").order("titolo"),
    supabase.from("offerta_commerciale_documenti").select("*").order("modificato_at", { ascending: false, nullsFirst: false }),
  ])
  const error = catalogoError ?? offerteError ?? documentiError
  if (error) throw new Error(error.message)
  return {
    cataloghi: (cataloghi as CatalogoCommerciale[] | null) ?? [],
    offerte: (offerte as OffertaPeriodo[] | null) ?? [],
    documenti: documenti ?? [],
  }
}
