// Repository server-side del modulo Lead.
// Esegue filtri/ordinamento/paginazione/proiezione contro lo store in memoria.
// Rappresenta il layer che, con Supabase, diventerà una query SQL parametrica
// con indici, LIMIT/OFFSET e SELECT delle sole colonne richieste.
import type { Lead, LeadColumnId } from "@/lib/mock-data"
import { matchesAdvanced } from "@/lib/leads/advanced-filter-logic"
import {
  type LeadListParams,
  type LeadListResponse,
  type LeadListItem,
  type LeadStats,
  type ScoreFilter,
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

function matchesScore(score: number, filter: ScoreFilter): boolean {
  if (filter === "caldo") return score > 80
  if (filter === "medio") return score >= 50 && score <= 80
  if (filter === "freddo") return score < 50
  return true
}

// Proietta una riga sui soli campi richiesti (no "select *"): id + base + extra.
function project(lead: Lead, fields: string[]): LeadListItem {
  if (fields.includes("*")) {
    // export/CSV: tutte le colonne tranne gli array pesanti
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
  return out as LeadListItem
}

export function queryLeads(params: LeadListParams): LeadListResponse {
  // 1) Candidati via indici secondari (equality) o full scan
  const candidateIds = candidateIdsByIndex({
    stato: params.stato,
    sede: params.sede,
    commerciale: params.commerciale,
  })
  const base = candidateIds ? getLeadsByIds(candidateIds) : getAllLeads()

  // 2) Filtri residui (ricerca testo, origine, tag, score, duplicati, avanzati)
  const q = params.search.trim().toLowerCase()
  const filtered = base.filter((lead) => {
    if (params.onlyDuplicates && !lead.possibileDuplicato) return false
    if (q) {
      const hay = [lead["Nome Lead"], lead["E-mail"], lead.Telefono]
        .join(" ")
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (params.origine !== "all" && lead["Origine Lead"] !== params.origine)
      return false
    if (params.tag !== "all" && !lead.Tag.includes(params.tag)) return false
    if (!matchesScore(lead.Valutazione, params.score)) return false
    if (!matchesAdvanced(lead, params.advanced)) return false
    return true
  })

  // 3) Ordinamento
  const sortBy = params.sortBy
  if (sortBy) {
    filtered.sort((a, b) => {
      const av = a[sortBy as keyof Lead]
      const bv = b[sortBy as keyof Lead]
      let cmp = 0
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""), "it")
      return params.sortDir === "asc" ? cmp : -cmp
    })
  }

  // 4) Paginazione (LIMIT/OFFSET)
  const total = filtered.length
  const startIdx = (params.page - 1) * params.pageSize
  const pageSlice = filtered.slice(startIdx, startIdx + params.pageSize)

  // 5) Proiezione selettiva
  const rows = pageSlice.map((l) => project(l, params.fields))

  return { rows, total, page: params.page, pageSize: params.pageSize }
}

// Aggregazione leggera per la dashboard/header: conteggi, mai righe complete.
export function computeStats(): LeadStats {
  const all = getAllLeads()
  const byStato: Record<string, number> = {}
  let caldi = 0
  let duplicati = 0
  let nonAssegnati = 0
  for (const l of all) {
    byStato[l["Stato Lead"]] = (byStato[l["Stato Lead"]] ?? 0) + 1
    if (l.Valutazione > 80) caldi++
    if (l.possibileDuplicato) duplicati++
    if (!l["Lead Proprietario"]) nonAssegnati++
  }
  return { total: getTotalCount(), byStato, caldi, duplicati, nonAssegnati }
}

// --- Mutazioni (ritornano la riga proiettata "base" per optimistic reconcile) ---
export function createLeadRecord(lead: Lead): LeadListItem {
  insertLead(lead)
  return project(lead, [])
}

export function updateLeadRecord(
  id: string,
  patch: Partial<Lead>,
): LeadListItem | undefined {
  const updated = patchLead(id, patch)
  return updated ? project(updated, []) : undefined
}

export function deleteLeadRecords(ids: string[]): number {
  return removeLeads(ids)
}

export type BulkField = "Stato Lead" | "Sede" | "Lead Proprietario" | "Tag"

export function bulkUpdateRecords(
  ids: string[],
  field: BulkField,
  value: string,
): number {
  let n = 0
  for (const id of ids) {
    const current = getLeadById(id)
    if (!current) continue
    if (field === "Tag") {
      const next = current.Tag.includes(value)
        ? current.Tag
        : [...current.Tag, value]
      patchLead(id, { Tag: next })
    } else {
      patchLead(id, { [field]: value } as Partial<Lead>)
    }
    n++
  }
  return n
}

export function getFullLeadById(id: string): Lead | undefined {
  return getLeadById(id)
}

export { type LeadColumnId }
