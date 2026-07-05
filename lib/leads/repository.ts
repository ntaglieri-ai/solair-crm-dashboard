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

  // Mezzanotte locale di oggi -> ISO, per il conteggio "Nuovi oggi".
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
