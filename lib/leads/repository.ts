// Repository server-side del modulo Lead.
// Tutte le funzioni sono async — lo store parla con Supabase.
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
  return out as LeadListItem
}

export async function queryLeads(params: LeadListParams): Promise<LeadListResponse> {
  // 1) Candidati via indici — con Supabase restituisce sempre null
  const candidateIds = await candidateIdsByIndex({
    stato: params.stato,
    sede: params.sede,
    commerciale: params.commerciale,
  })

  // 2) Fetch da Supabase con filtri SQL
  const base = candidateIds
    ? await getLeadsByIds(candidateIds)
    : await getAllLeads({
        stato: params.stato,
        sede: params.sede,
        commerciale: params.commerciale,
        search: params.search,
      })

  // 3) Filtri residui in JS (origine, tag, score, duplicati, avanzati)
  const q = params.search.trim().toLowerCase()
  const filtered = base.filter((lead) => {
    if (params.onlyDuplicates && !lead.possibileDuplicato) return false
    // search già applicato in SQL, ma per sicurezza se candidateIds è presente
    if (candidateIds && q) {
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

  // 4) Ordinamento
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

  // 5) Paginazione
  const total = filtered.length
  const startIdx = (params.page - 1) * params.pageSize
  const pageSlice = filtered.slice(startIdx, startIdx + params.pageSize)

  // 6) Proiezione selettiva
  const rows = pageSlice.map((l) => project(l, params.fields))

  return { rows, total, page: params.page, pageSize: params.pageSize }
}

export async function computeStats(): Promise<LeadStats> {
  const [all, total] = await Promise.all([
    getAllLeads(),
    getTotalCount(),
  ])
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
  return { total, byStato, caldi, duplicati, nonAssegnati }
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

export async function bulkUpdateRecords(
  ids: string[],
  field: BulkField,
  value: string,
): Promise<number> {
  let n = 0
  for (const id of ids) {
    const current = await getLeadById(id)
    if (!current) continue
    if (field === "Tag") {
      const next = current.Tag.includes(value)
        ? current.Tag
        : [...current.Tag, value]
      await patchLead(id, { Tag: next })
    } else {
      await patchLead(id, { [field]: value } as Partial<Lead>)
    }
    n++
  }
  return n
}

export async function getFullLeadById(id: string): Promise<Lead | undefined> {
  return getLeadById(id)
}

export { type LeadColumnId }
