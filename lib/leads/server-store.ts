// Store server-side in memoria che SIMULA la tabella DB dei Lead.
// È l'UNICO punto da sostituire quando si collega Supabase: le firme delle
// funzioni (getById, query per indici, insert/patch/remove) corrispondono già
// a quelle di un repository SQL con indici.
import { mockLeads, type Lead } from "@/lib/mock-data"

// Tabella + indice di chiave primaria (PK) per lookup O(1).
const rows: Lead[] = mockLeads.map((l) => ({ ...l }))
const byId = new Map<string, Lead>(rows.map((l) => [l.id, l]))

// Indici secondari (equality indexes) — simulano gli indici DB su colonne
// ad alta selettività usate nei filtri. Mantenuti in sync sulle mutazioni.
type Index = Map<string, Set<string>>
const idxStato: Index = new Map()
const idxSede: Index = new Map()
const idxOwner: Index = new Map()

function addToIndex(idx: Index, key: string, id: string) {
  let set = idx.get(key)
  if (!set) {
    set = new Set()
    idx.set(key, set)
  }
  set.add(id)
}

function removeFromIndex(idx: Index, key: string, id: string) {
  idx.get(key)?.delete(id)
}

function indexLead(l: Lead) {
  addToIndex(idxStato, l["Stato Lead"], l.id)
  addToIndex(idxSede, l.Sede, l.id)
  addToIndex(idxOwner, l["Lead Proprietario"], l.id)
}

function unindexLead(l: Lead) {
  removeFromIndex(idxStato, l["Stato Lead"], l.id)
  removeFromIndex(idxSede, l.Sede, l.id)
  removeFromIndex(idxOwner, l["Lead Proprietario"], l.id)
}

// Costruzione iniziale degli indici.
for (const l of rows) indexLead(l)

function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  const out = new Set<string>()
  for (const id of small) if (large.has(id)) out.add(id)
  return out
}

/**
 * Restituisce l'insieme di id candidati sfruttando gli indici secondari per i
 * filtri di uguaglianza (stato/sede/owner). Ritorna null se nessun indice è
 * applicabile (=> full scan a valle).
 */
export function candidateIdsByIndex(filters: {
  stato?: string
  sede?: string
  commerciale?: string
}): Set<string> | null {
  const sets: Set<string>[] = []
  if (filters.stato && filters.stato !== "all")
    sets.push(idxStato.get(filters.stato) ?? new Set())
  if (filters.sede && filters.sede !== "all")
    sets.push(idxSede.get(filters.sede) ?? new Set())
  if (filters.commerciale && filters.commerciale !== "all")
    sets.push(idxOwner.get(filters.commerciale) ?? new Set())
  if (sets.length === 0) return null
  return sets.reduce((acc, s) => intersect(acc, s))
}

export function getLeadById(id: string): Lead | undefined {
  return byId.get(id)
}

export function getLeadsByIds(ids: Iterable<string>): Lead[] {
  const out: Lead[] = []
  for (const id of ids) {
    const l = byId.get(id)
    if (l) out.push(l)
  }
  return out
}

/** Tutte le righe (full scan) — usato solo quando nessun indice è applicabile. */
export function getAllLeads(): Lead[] {
  return rows
}

export function getTotalCount(): number {
  return rows.length
}

export function insertLead(lead: Lead): Lead {
  rows.unshift(lead)
  byId.set(lead.id, lead)
  indexLead(lead)
  return lead
}

export function patchLead(id: string, patch: Partial<Lead>): Lead | undefined {
  const current = byId.get(id)
  if (!current) return undefined
  unindexLead(current)
  Object.assign(current, patch)
  indexLead(current)
  return current
}

export function removeLeads(ids: string[]): number {
  const remove = new Set(ids)
  let removed = 0
  for (let i = rows.length - 1; i >= 0; i--) {
    const l = rows[i]
    if (remove.has(l.id)) {
      unindexLead(l)
      byId.delete(l.id)
      rows.splice(i, 1)
      removed++
    }
  }
  return removed
}
