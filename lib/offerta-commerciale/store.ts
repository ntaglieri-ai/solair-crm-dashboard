import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  AccessorioCommerciale,
  CatalogoCommerciale,
  CodiceSconto,
  MatriceAccumulo,
  OffertaCommercialePayload,
  OffertaPeriodo,
  PannelloSpec,
  PrezzoFotovoltaico,
  RegolaSconto,
  SpecificheProdotto,
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

function textOrNull(value: unknown, max = 180) {
  return text(value, max) || null
}

/** Come finite(), ma "" / null / undefined restano null invece di diventare 0. */
function optionalNumber(value: unknown) {
  if (value == null || value === "") return null
  return finite(value)
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

const TIPI_CODICE_SCONTO = new Set(["percentuale", "importo", "omaggio", "nota"])

export function normalizeCodiciSconto(value: unknown): CodiceSconto[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return []
    const source = row as Record<string, unknown>
    const codice = text(source.codice, 40).toUpperCase().replace(/\s+/g, "-")
    const nome = text(source.nome, 120)
    const tipo = text(source.tipo, 30)
    const valore = finite(source.valore)
    if (!codice || !nome || !TIPI_CODICE_SCONTO.has(tipo)) return []
    return [{
      codice,
      nome,
      descrizione: text(source.descrizione, 500) || null,
      tipo: tipo as CodiceSconto["tipo"],
      valore: valore != null && valore >= 0 ? valore : null,
      attivo: source.attivo !== false,
      // Assente = false: i codici salvati prima della migration
      // 20260812 non sono cumulabili con lo sconto di zona.
      cumulabile_con_sconto_zona: source.cumulabile_con_sconto_zona === true,
    }]
  })
}

/**
 * Finora i pannelli sono stati inseriti con SQL manuale e /api/public/catalogo
 * li restituisce cosi come sono: preserviamo le chiavi sconosciute e
 * normalizziamo solo i campi gestiti dal modal.
 */
export function normalizePannelli(value: unknown): PannelloSpec[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return []
    const source = row as Record<string, unknown>
    const modello = text(source.modello, 180)
    const nomeDisplay = text(source.nome_display, 180) || modello
    if (!nomeDisplay) return []
    return [{
      ...source,
      brand: text(source.brand, 120),
      modello,
      nome_display: nomeDisplay,
      codice: textOrNull(source.codice, 80),
      potenza_wp: optionalNumber(source.potenza_wp),
      larghezza_mm: optionalNumber(source.larghezza_mm),
      altezza_mm: optionalNumber(source.altezza_mm),
      peso_kg: optionalNumber(source.peso_kg),
      efficienza_pct: optionalNumber(source.efficienza_pct),
      degrado: typeof source.degrado === "number" && Number.isFinite(source.degrado)
        ? source.degrado
        : textOrNull(source.degrado, 120),
      garanzia_prodotto_anni: optionalNumber(source.garanzia_prodotto_anni),
      garanzia_lineare_anni: optionalNumber(source.garanzia_lineare_anni),
      tags: Array.isArray(source.tags)
        ? source.tags.flatMap((tag) => { const value = text(tag, 60); return value ? [value] : [] })
        : [],
      tier: textOrNull(source.tier, 60),
      attivo: source.attivo !== false,
      immagine_nc_path: textOrNull(source.immagine_nc_path, 500),
      scheda_pdf_nc_path: textOrNull(source.scheda_pdf_nc_path, 500),
    }]
  })
}

/**
 * Fonde le specifiche in arrivo dal client su quelle gia' salvate: le chiavi
 * diverse da "pannelli" restano intatte anche se il client non le conosce.
 */
export function normalizeSpecificheProdotto(value: unknown, current: unknown): SpecificheProdotto {
  const isPlainObject = (input: unknown): input is Record<string, unknown> =>
    !!input && typeof input === "object" && !Array.isArray(input)
  const base = isPlainObject(current) ? { ...current } : {}
  if (!isPlainObject(value)) return base as SpecificheProdotto
  return { ...base, ...value, pannelli: normalizePannelli(value.pannelli) }
}

/**
 * Costruisce il payload completo della pagina Offerta Commerciale.
 * Usata sia dalla route GET sia dal Server Component della pagina, che lo
 * precarica: prima la pagina era interamente client e mostrava uno spinner su
 * schermo vuoto fino al termine della fetch post-mount.
 */
export async function buildOffertaCommercialePayload(
  supabase: SupabaseClient,
  canManage: boolean,
): Promise<OffertaCommercialePayload> {
  const data = await loadOffertaCommerciale(supabase)
  const catalogo =
    data.cataloghi.find((item) => item.stato === "pubblicato")
    ?? (canManage ? data.cataloghi.find((item) => item.stato === "bozza") : null)
    ?? data.cataloghi[0]
    ?? null

  return {
    offerte: data.offerte,
    documenti: data.documenti,
    catalogo,
    versioni: data.cataloghi.map(({
      id,
      nome,
      stato,
      valido_dal,
      valido_al,
      fonte_path,
      fonte_fingerprint,
      pubblicato_at,
      aggiornato_at,
    }) => ({
      id,
      nome,
      stato,
      valido_dal,
      valido_al,
      fonte_path,
      fonte_fingerprint,
      pubblicato_at,
      aggiornato_at,
    })),
    canManage,
    nextcloudRoot: OFFERTA_COMMERCIALE_ROOT,
  }
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
