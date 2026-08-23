// Repository server-side del modulo Lead — ottimizzato per performance.
// computeStats usa query SQL aggregata invece di full scan.
import type { Lead, LeadColumnId } from "@/lib/mock-data"
import {
  type LeadListParams,
  type LeadListResponse,
  type LeadListItem,
  type LeadStats,
  LIST_BASE_FIELDS,
} from "@/lib/leads/api-types"
import {
  candidateIdsByIndex,
  getAllLeads,
  getLeadsByIds,
  getLeadById,
  getTotalCount,
  insertLead,
  patchLead,
  removeLeads,
} from "@/lib/leads/server-store"
import { createClient } from "@/lib/supabase/server"

function project(lead: Lead, fields: string[]): LeadListItem {
  if (fields.includes("*")) {
    const { attivita, documenti, ...rest } = lead
    void attivita
    void documenti
    return { ...rest }
  }
  const keys = new Set<string>(["id", ...(LIST_BASE_FIELDS as string[]), ...fields])
  const out: Record<string, unknown> = { id: lead.id }
  for (const k of keys) {
    if (k in lead) out[k] = lead[k as keyof Lead]
  }
  out.noteItems = lead.noteItems ?? []
  out.taskItems = lead.taskItems ?? []
  out.tagIds = lead.tagIds ?? []
  return out as LeadListItem
}

export async function queryLeads(params: LeadListParams): Promise<LeadListResponse> {
  // Tutti i filtri sono applicati nella query Supabase PRIMA di range/paginazione,
  // così total e righe restano coerenti con la pagina richiesta.
  const filters = {
    stato: params.stato,
    sede: params.sede,
    commerciale: params.commerciale,
    origine: params.origine,
    score: params.score,
    search: params.search,
    advanced: params.advanced,
  }

  const [base, total] = await Promise.all([
    getAllLeads({
      ...filters,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
      limit: params.pageSize,
      offset: (params.page - 1) * params.pageSize,
    }),
    getTotalCount(filters),
  ])

  const rows = base.map((l) => project(l, params.fields))
  return { rows, total, page: params.page, pageSize: params.pageSize }
}

// computeStats — query SQL aggregata, nessun full scan
export async function computeStats(): Promise<LeadStats> {
  const supabase = await createClient()
  const { data: aggregate, error: aggregateError } =
    await supabase.rpc("get_lead_stats")

  if (!aggregateError && aggregate && typeof aggregate === "object") {
    const value = aggregate as Record<string, unknown>
    return {
      total: Number(value.total ?? 0),
      byStato:
        value.byStato && typeof value.byStato === "object"
          ? (value.byStato as Record<string, number>)
          : {},
      caldi: Number(value.caldi ?? 0),
      duplicati: Number(value.duplicati ?? 0),
      nonAssegnati: Number(value.nonAssegnati ?? 0),
      nuoviOggi: Number(value.nuoviOggi ?? 0),
    }
  }

  // Compatibilità temporanea finché la migration RPC non viene applicata.
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [{ data: statsData }, { count: total }, { count: nuoviOggi }] =
    await Promise.all([
      supabase
        .from("leads")
        .select("stato_lead, valutazione, lead_proprietario_id"),
      supabase.from("leads").select("id", { count: "exact", head: true }),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfToday.toISOString()),
    ])

  const all = statsData ?? []
  const byStato: Record<string, number> = {}
  let caldi = 0
  let nonAssegnati = 0

  for (const l of all) {
    const stato = l.stato_lead ?? "Non contattato"
    byStato[stato] = (byStato[stato] ?? 0) + 1
    if ((l.valutazione ?? 0) > 80) caldi++
    if (!l.lead_proprietario_id) nonAssegnati++
  }

  return {
    total: total ?? 0,
    byStato,
    caldi,
    duplicati: 0,
    nonAssegnati,
    nuoviOggi: nuoviOggi ?? 0,
  }
}

export async function createLeadRecord(lead: Lead): Promise<LeadListItem> {
  const inserted = await insertLead(lead)
  return project(inserted, [])
}

export async function updateLeadRecord(
  id: string,
  patch: Partial<Lead>,
): Promise<LeadListItem | undefined> {
  const updated = await patchLead(id, patch)
  return updated ? project(updated, []) : undefined
}

export async function deleteLeadRecords(ids: string[]): Promise<number> {
  return removeLeads(ids)
}

export type BulkField = "Stato Lead" | "Sede" | "Lead Proprietario" | "Tag"

// Mappa i campi bulk con valore identico per tutti i lead sulla colonna DB.
const BULK_COLUMN: Record<Exclude<BulkField, "Tag">, string> = {
  "Stato Lead": "stato_lead",
  Sede: "sede",
  "Lead Proprietario": "lead_proprietario_id",
}

export async function bulkUpdateRecords(
  ids: string[],
  field: BulkField,
  value: string,
): Promise<number> {
  if (ids.length === 0) return 0

  // Tag: il nuovo valore dipende dai tag esistenti di ciascun lead (merge senza
  // duplicati), quindi l'aggiornamento NON è uguale per tutti → resta per-riga.
  if (field === "Tag") {
    let n = 0
    for (const id of ids) {
      const current = await getLeadById(id)
      if (!current) continue
      const next = current.Tag.includes(value)
        ? current.Tag
        : [...current.Tag, value]
      await patchLead(id, { Tag: next })
      n++
    }
    return n
  }

  // Stesso valore per tutti i lead → singola query update().in("id", ids).
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("leads")
    .update(
      { [BULK_COLUMN[field]]: value, updated_at: new Date().toISOString() },
      { count: "exact" },
    )
    .in("id", ids)
  if (error) throw new Error(`bulkUpdateRecords: ${error.message}`)
  return count ?? 0
}

export async function getFullLeadById(id: string): Promise<Lead | undefined> {
  return getLeadById(id)
}

export { type LeadColumnId }

// ----------------------------------------------------------------------------
// Export CSV — lettura completa, non una pagina.
//
// Perche' esiste una funzione dedicata invece di riusare queryLeads: quella
// ricalcola getTotalCount a ogni chiamata, quindi un export a chunk pagherebbe
// una COUNT(*) per chunk. Qui il totale si legge una volta sola e il resto sono
// solo range successivi sulla stessa query.
//
// Il tetto non e' una scelta estetica: la risposta viaggia in JSON verso il
// browser e leads ha ~9.3k righe. A 26 colonne per riga si sta sotto il MB ogni
// ~2.5k righe, quindi 5000 e' il punto in cui l'export resta un download e non
// una pagina che si pianta. Oltre quel numero il chiamante NON riceve un
// silenzio: riceve truncated=true e la differenza esatta, e sta a lui dirlo
// all'utente prima di scaricare (era esattamente il bug del vecchio
// pageSize:200 fisso, che troncava senza dire niente).
// ----------------------------------------------------------------------------

export const EXPORT_MAX_ROWS = 5000
const EXPORT_CHUNK = 1000

export interface ExportQueryResult<T> {
  rows: T[]
  /** Righe che i filtri selezionano davvero, anche quelle non esportate. */
  total: number
  truncated: boolean
  limit: number
}

export async function queryLeadsForExport(
  params: LeadListParams,
): Promise<ExportQueryResult<LeadListItem>> {
  const filters = {
    stato: params.stato,
    sede: params.sede,
    commerciale: params.commerciale,
    origine: params.origine,
    score: params.score,
    search: params.search,
    advanced: params.advanced,
  }

  const total = await getTotalCount(filters)
  const target = Math.min(total, EXPORT_MAX_ROWS)

  const rows: LeadListItem[] = []
  for (let offset = 0; offset < target; offset += EXPORT_CHUNK) {
    const chunk = await getAllLeads({
      ...filters,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
      limit: Math.min(EXPORT_CHUNK, target - offset),
      offset,
    })
    if (chunk.length === 0) break
    for (const lead of chunk) rows.push(project(lead, ["*"]))
  }

  return { rows, total, truncated: total > rows.length, limit: EXPORT_MAX_ROWS }
}

/**
 * Export di una selezione esplicita. Sostituisce il vecchio "scarica tutto e
 * poi filtra lato client", che perdeva ogni riga selezionata oltre la 200esima
 * senza accorgersene. Qui gli id vanno al database, quindi la selezione esce
 * intera qualunque pagina la abbia prodotta.
 */
export async function queryLeadsByIdsForExport(
  ids: string[],
): Promise<ExportQueryResult<LeadListItem>> {
  const unique = Array.from(new Set(ids)).slice(0, EXPORT_MAX_ROWS)
  const rows: LeadListItem[] = []
  // .in() con liste lunghe finisce nell'URL della richiesta PostgREST: si
  // spezza per non superare la lunghezza massima.
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = await getLeadsByIds(unique.slice(i, i + 200))
    for (const lead of chunk) rows.push(project(lead, ["*"]))
  }
  const total = new Set(ids).size
  return { rows, total, truncated: total > rows.length, limit: EXPORT_MAX_ROWS }
}
