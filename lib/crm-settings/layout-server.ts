import type { createClient } from "@/lib/supabase/server"
import {
  applicaOrdineBlocchi,
  applicaOrdinePersonale,
  type LayoutBlocco,
  type LayoutCampo,
  type LayoutFormato,
  type LayoutFormula,
  type LayoutPagina,
} from "./layout"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Lettura della configurazione di layout di un modulo.
 *
 * Stessa postura a prova di errore del loader dei campi custom: se le tabelle
 * non esistono ancora (migrazione non applicata) o la query fallisce, torna
 * array vuoto invece di far fallire la scheda. Chi chiama tratta l'array
 * vuoto come "nessun layout configurato" e resta sul rendering di oggi —
 * cosi' la scheda continua a funzionare mentre il nuovo sistema viene
 * costruito in parallelo.
 */

type RigaPagina = {
  id: string
  page_key: string
  label: string
  icona: string | null
  ordinamento: number
  visible: boolean
  componente: string | null
}

type RigaBlocco = {
  id: string
  pagina_id: string
  block_key: string
  label: string
  mostra_titolo: boolean
  colonne: number
  ordinamento: number
  visible: boolean
}

type RigaCampo = {
  id: string
  blocco_id: string
  origine: string
  field_key: string
  label_override: string | null
  ordinamento: number
  visible: boolean
  span: number
  sola_lettura: boolean
  formato: unknown
  formula: unknown
}

/** jsonb arriva come unknown: normalizzato qui, mai passato grezzo alla UI. */
function leggiFormato(value: unknown): LayoutFormato {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const raw = value as Record<string, unknown>
  const formato: LayoutFormato = {}
  if (typeof raw.decimali === "number" && Number.isInteger(raw.decimali) && raw.decimali >= 0) {
    formato.decimali = raw.decimali
  }
  if (typeof raw.valuta === "string" && raw.valuta) formato.valuta = raw.valuta
  if (typeof raw.placeholder === "string") formato.placeholder = raw.placeholder
  return formato
}

function leggiFormula(value: unknown): LayoutFormula | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (typeof raw.expr !== "string" || !raw.expr.trim()) return null
  return {
    expr: raw.expr,
    ...(typeof raw.origine_zoho === "string" ? { origine_zoho: raw.origine_zoho } : {}),
  }
}

/**
 * Carica pagine, blocchi e campi di un modulo e li assembla nell'albero.
 *
 * Tre query invece di join annidati: PostgREST li supporta, ma con tre
 * livelli la risposta diventa difficile da tipizzare e da leggere, e il
 * volume qui e' minimo (decine di righe, non migliaia).
 */
export async function loadLayout(
  supabase: SupabaseClient,
  modulo: string,
): Promise<LayoutPagina[]> {
  const { data: pagine, error: erroreP } = await supabase
    .from("crm_layout_pagine")
    .select("id, page_key, label, icona, ordinamento, visible, componente")
    .eq("modulo", modulo)
    .order("ordinamento", { ascending: true })

  if (erroreP || !pagine || pagine.length === 0) return []

  const idPagine = (pagine as RigaPagina[]).map((p) => p.id)

  const { data: blocchi, error: erroreB } = await supabase
    .from("crm_layout_blocchi")
    .select("id, pagina_id, block_key, label, mostra_titolo, colonne, ordinamento, visible")
    .in("pagina_id", idPagine)
    .order("ordinamento", { ascending: true })

  if (erroreB) return []

  const idBlocchi = ((blocchi ?? []) as RigaBlocco[]).map((b) => b.id)

  // Nessun blocco: pagine tutte a componente dedicato, oppure layout appena
  // creato. Le pagine restano valide, semplicemente senza campi.
  const campi = idBlocchi.length
    ? await supabase
        .from("crm_layout_campi")
        .select(
          "id, blocco_id, origine, field_key, label_override, ordinamento, visible, span, sola_lettura, formato, formula",
        )
        .in("blocco_id", idBlocchi)
        .order("ordinamento", { ascending: true })
    : { data: [] as RigaCampo[], error: null }

  if (campi.error) return []

  const campiPerBlocco = new Map<string, LayoutCampo[]>()
  for (const riga of (campi.data ?? []) as RigaCampo[]) {
    const lista = campiPerBlocco.get(riga.blocco_id) ?? []
    lista.push({
      id: riga.id,
      origine: riga.origine === "custom" ? "custom" : "system",
      fieldKey: riga.field_key,
      labelOverride: riga.label_override,
      ordinamento: riga.ordinamento,
      visible: riga.visible,
      span: riga.span,
      solaLettura: riga.sola_lettura,
      formato: leggiFormato(riga.formato),
      formula: leggiFormula(riga.formula),
    })
    campiPerBlocco.set(riga.blocco_id, lista)
  }

  const blocchiPerPagina = new Map<string, LayoutBlocco[]>()
  for (const riga of ((blocchi ?? []) as RigaBlocco[])) {
    const lista = blocchiPerPagina.get(riga.pagina_id) ?? []
    lista.push({
      id: riga.id,
      blockKey: riga.block_key,
      label: riga.label,
      mostraTitolo: riga.mostra_titolo,
      colonne: riga.colonne,
      ordinamento: riga.ordinamento,
      visible: riga.visible,
      campi: campiPerBlocco.get(riga.id) ?? [],
    })
    blocchiPerPagina.set(riga.pagina_id, lista)
  }

  return (pagine as RigaPagina[]).map((riga) => ({
    id: riga.id,
    pageKey: riga.page_key,
    label: riga.label,
    icona: riga.icona,
    ordinamento: riga.ordinamento,
    visible: riga.visible,
    componente: riga.componente,
    blocchi: blocchiPerPagina.get(riga.id) ?? [],
  }))
}

/**
 * Ordine personale delle pagine per l'utente corrente.
 *
 * Preferenza, non permesso: se manca o non e' leggibile si torna array vuoto
 * e vale l'ordine dell'admin.
 */
export type OrdinePersonale = {
  pagine: string[]
  blocchi: Record<string, string[]>
}

export async function loadOrdinePersonale(
  supabase: SupabaseClient,
  utenteId: string,
  modulo: string,
): Promise<OrdinePersonale> {
  const vuoto: OrdinePersonale = { pagine: [], blocchi: {} }

  const { data, error } = await supabase
    .from("crm_layout_ordine_utente")
    .select("ordine, ordine_blocchi")
    .eq("utente_id", utenteId)
    .eq("modulo", modulo)
    .maybeSingle()

  if (error || !data) return vuoto
  const riga = data as { ordine: unknown; ordine_blocchi: unknown }

  const pagine = Array.isArray(riga.ordine)
    ? riga.ordine.filter((key): key is string => typeof key === "string")
    : []

  const blocchi: Record<string, string[]> = {}
  if (riga.ordine_blocchi && typeof riga.ordine_blocchi === "object" && !Array.isArray(riga.ordine_blocchi)) {
    for (const [pageKey, elenco] of Object.entries(riga.ordine_blocchi as Record<string, unknown>)) {
      if (Array.isArray(elenco)) {
        blocchi[pageKey] = elenco.filter((key): key is string => typeof key === "string")
      }
    }
  }

  return { pagine, blocchi }
}

/** Layout del modulo gia' riordinato secondo la preferenza dell'utente. */
export async function loadLayoutPerUtente(
  supabase: SupabaseClient,
  modulo: string,
  utenteId: string | null,
): Promise<LayoutPagina[]> {
  const pagine = await loadLayout(supabase, modulo)
  if (!pagine.length || !utenteId) return pagine
  const ordine = await loadOrdinePersonale(supabase, utenteId, modulo)
  return applicaOrdineBlocchi(applicaOrdinePersonale(pagine, ordine.pagine), ordine.blocchi)
}
