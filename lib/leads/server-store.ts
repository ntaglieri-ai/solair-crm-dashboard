// Store server-side — Supabase async puro.
// Nessuna cache in memoria: ogni chiamata è una query SQL parametrica.
// Architettura pronta per SaaS multi-tenant (aggiungere tenant_id + RLS).
// Le firme sono async — repository.ts deve usare await su ogni chiamata.

import { createClient } from "@/lib/supabase/server"
import type { Lead } from "@/lib/mock-data"

// ─── Mapping Supabase row → Lead (nomi Zoho) ─────────────────────────────

function mapRow(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    "Nome Lead": (row.nome_lead as string) ?? "",
    Nome: (row.nome as string) ?? "",
    Cognome: (row.cognome as string) ?? "",
    "E-mail": (row.email as string) ?? "",
    Telefono: (row.telefono as string) ?? "",
    "Mobile/Fisso": (row.mobile_fisso as string) ?? "",
    "Social Lead ID": (row.social_lead_id as string) ?? null,
    "Residente in Sicilia": (row.residente_in_sicilia as boolean) ?? false,
    "Città": (row.citta as string) ?? "",
    Provincia: (row.provincia as string) ?? "",
    "Codice postale": (row.codice_postale as string) ?? "",
    Paese: (row.paese as string) ?? "Italia",
    "Stato Lead": (row.stato_lead as Lead["Stato Lead"]) ?? "Non contattato",
    Stato: (row.stato_email as Lead["Stato"]) ?? null,
    Valutazione: (row.valutazione as number) ?? 0,
    "Lead Proprietario": (row.lead_proprietario_id as string) ?? "",
    "Origine Lead": (row.origine_lead as Lead["Origine Lead"]) ?? "",
    Sede: (row.sede as Lead["Sede"]) ?? "",
    "campaign name": (row.campaign_name as string) ?? "",
    kWp: (row.kwp as number) ?? 0,
    kWh: (row.kwh as number) ?? 0,
    "Modello pannello": (row.modello_pannello as string) ?? "",
    "Wallbox richiesto": (row.wallbox_richiesto as boolean) ?? false,
    "Data sopralluogo": (row.data_sopralluogo as string) ?? null,
    "Installatore - Incaricato sopralluogo": null,
    "Tempo di conversione Lead": (row.tempo_conversione_lead as string) ?? "",
    "Account convertito": (row.account_convertito_id as string) ?? null,
    "Contatto convertito": (row.contatto_convertito as string) ?? null,
    "Modalità iscrizione annullata": (row.modalita_iscrizione_annullata as string) ?? null,
    "Ora iscrizione annullata": (row.ora_iscrizione_annullata as string) ?? null,
    Descrizione: (row.descrizione as string) ?? "",
    "Connesso a": (row.connesso_a as string) ?? null,
    "Creato da": (row.creato_da as string) ?? "",
    "Data Click": (row.data_click as string) ?? "",
    "Data/Ora": (row.data_ora as string) ?? "",
    "Ora ultima attività": (row.ora_ultima_attivita as string) ?? "",
    // Campi UI calcolati
    "Badge dell'attività": false,
    "Badge di nota": false,
    Tag: [],
    emailAperture: 0,
    leadCaldo: ((row.valutazione as number) ?? 0) > 80,
    possibileDuplicato: false,
    attivita: [],
    documenti: [],
  }
}

// ─── Proiezione lista (no SELECT *) ──────────────────────────────────────

const LIST_COLUMNS = [
  "id",
  "nome_lead",
  "nome",
  "cognome",
  "email",
  "telefono",
  "mobile_fisso",
  "stato_lead",
  "stato_email",
  "valutazione",
  "lead_proprietario_id",
  "origine_lead",
  "sede",
  "campaign_name",
  "citta",
  "provincia",
  "codice_postale",
  "residente_in_sicilia",
  "wallbox_richiesto",
  "data_click",
  "data_ora",
  "ora_ultima_attivita",
  "created_at",
].join(",")

// ─── candidateIdsByIndex ──────────────────────────────────────────────────
// Con Supabase non servono indici in memoria: PostgreSQL usa i suoi indici.
// Restituiamo null → repository.ts farà getAllLeads() con i filtri SQL.

export async function candidateIdsByIndex(_filters: {
  stato?: string
  sede?: string
  commerciale?: string
}): Promise<Set<string> | null> {
  // PostgreSQL gestisce i filtri con indici nativi — no pre-filtering in JS.
  return null
}

// ─── getAllLeads — query con filtri opzionali ────────────────────────────
// Nota: questa funzione ora accetta filtri opzionali per evitare di caricare
// tutti i record quando si applica un filtro.

export async function getAllLeads(filters?: {
  stato?: string
  sede?: string
  commerciale?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<Lead[]> {
  const supabase = await createClient()

  let query = supabase
    .from("leads")
    .select(LIST_COLUMNS)
    .order("ora_ultima_attivita", { ascending: false })

  // Filtri SQL — sfruttano gli indici su stato_lead, sede, lead_proprietario_id
  if (filters?.stato && filters.stato !== "all")
    query = query.eq("stato_lead", filters.stato)
  if (filters?.sede && filters.sede !== "all")
    query = query.eq("sede", filters.sede)
  if (filters?.commerciale && filters.commerciale !== "all")
    query = query.eq("lead_proprietario_id", filters.commerciale)
  if (filters?.search?.trim())
    query = query.or(
      `nome_lead.ilike.%${filters.search}%,email.ilike.%${filters.search}%,telefono.ilike.%${filters.search}%`
    )

  if (filters?.limit) query = query.limit(filters.limit)
  if (filters?.offset) query = query.range(
    filters.offset,
    filters.offset + (filters.limit ?? 100) - 1
  )

  const { data, error } = await query

  if (error) {
    console.error("[server-store] getAllLeads error:", error.message)
    return []
  }

  return (data as Record<string, unknown>[]).map(mapRow)
}

// ─── getTotalCount ────────────────────────────────────────────────────────

export async function getTotalCount(filters?: {
  stato?: string
  sede?: string
  commerciale?: string
  search?: string
}): Promise<number> {
  const supabase = await createClient()

  let query = supabase
    .from("leads")
    .select("id", { count: "exact", head: true })

  if (filters?.stato && filters.stato !== "all")
    query = query.eq("stato_lead", filters.stato)
  if (filters?.sede && filters.sede !== "all")
    query = query.eq("sede", filters.sede)
  if (filters?.commerciale && filters.commerciale !== "all")
    query = query.eq("lead_proprietario_id", filters.commerciale)
  if (filters?.search?.trim())
    query = query.or(
      `nome_lead.ilike.%${filters.search}%,email.ilike.%${filters.search}%,telefono.ilike.%${filters.search}%`
    )

  const { count, error } = await query
  if (error) {
    console.error("[server-store] getTotalCount error:", error.message)
    return 0
  }
  return count ?? 0
}

// ─── getLeadById — dettaglio completo ────────────────────────────────────

export async function getLeadById(id: string): Promise<Lead | undefined> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !data) return undefined
  return mapRow(data as Record<string, unknown>)
}

// ─── getLeadsByIds ────────────────────────────────────────────────────────

export async function getLeadsByIds(ids: Iterable<string>): Promise<Lead[]> {
  const idArray = Array.from(ids)
  if (idArray.length === 0) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leads")
    .select(LIST_COLUMNS)
    .in("id", idArray)

  if (error) {
    console.error("[server-store] getLeadsByIds error:", error.message)
    return []
  }

  return (data as Record<string, unknown>[]).map(mapRow)
}

// ─── insertLead ───────────────────────────────────────────────────────────

export async function insertLead(lead: Lead): Promise<Lead> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("leads")
    .insert({
      nome: lead.Nome || null,
      cognome: lead.Cognome || null,
      nome_lead: lead["Nome Lead"] || null,
      email: lead["E-mail"] || null,
      telefono: lead.Telefono || null,
      mobile_fisso: lead["Mobile/Fisso"] || null,
      stato_lead: lead["Stato Lead"],
      stato_email: lead.Stato || null,
      valutazione: lead.Valutazione ?? 0,
      lead_proprietario_id: lead["Lead Proprietario"] || null,
      origine_lead: lead["Origine Lead"] || null,
      sede: lead.Sede || null,
      campaign_name: lead["campaign name"] || null,
      citta: lead["Città"] || null,
      provincia: lead.Provincia || null,
      codice_postale: lead["Codice postale"] || null,
      paese: lead.Paese || "Italia",
      descrizione: lead.Descrizione || null,
      residente_in_sicilia: lead["Residente in Sicilia"] ?? false,
      wallbox_richiesto: lead["Wallbox richiesto"] ?? false,
      kwp: lead.kWp || null,
      kwh: lead.kWh || null,
      modello_pannello: lead["Modello pannello"] || null,
      data_click: lead["Data Click"] || null,
      data_ora: lead["Data/Ora"] || null,
      creato_da: lead["Creato da"] || null,
    })
    .select()
    .single()

  if (error) throw new Error(`insertLead: ${error.message}`)
  return mapRow(data as Record<string, unknown>)
}

// ─── patchLead ────────────────────────────────────────────────────────────

export async function patchLead(
  id: string,
  patch: Partial<Lead>
): Promise<Lead | undefined> {
  const supabase = await createClient()

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch["Nome Lead"] !== undefined) row.nome_lead = patch["Nome Lead"]
  if (patch.Nome !== undefined) row.nome = patch.Nome
  if (patch.Cognome !== undefined) row.cognome = patch.Cognome
  if (patch["E-mail"] !== undefined) row.email = patch["E-mail"]
  if (patch.Telefono !== undefined) row.telefono = patch.Telefono
  if (patch["Mobile/Fisso"] !== undefined) row.mobile_fisso = patch["Mobile/Fisso"]
  if (patch["Stato Lead"] !== undefined) row.stato_lead = patch["Stato Lead"]
  if (patch.Stato !== undefined) row.stato_email = patch.Stato
  if (patch.Valutazione !== undefined) row.valutazione = patch.Valutazione
  if (patch["Lead Proprietario"] !== undefined) row.lead_proprietario_id = patch["Lead Proprietario"]
  if (patch.Sede !== undefined) row.sede = patch.Sede
  if (patch["Origine Lead"] !== undefined) row.origine_lead = patch["Origine Lead"]
  if (patch.Descrizione !== undefined) row.descrizione = patch.Descrizione
  if (patch["Città"] !== undefined) row.citta = patch["Città"]
  if (patch.Provincia !== undefined) row.provincia = patch.Provincia
  if (patch["campaign name"] !== undefined) row.campaign_name = patch["campaign name"]
  if (patch["Residente in Sicilia"] !== undefined) row.residente_in_sicilia = patch["Residente in Sicilia"]
  if (patch["Wallbox richiesto"] !== undefined) row.wallbox_richiesto = patch["Wallbox richiesto"]
  if (patch.kWp !== undefined) row.kwp = patch.kWp
  if (patch.kWh !== undefined) row.kwh = patch.kWh

  const { data, error } = await supabase
    .from("leads")
    .update(row)
    .eq("id", id)
    .select()
    .single()

  if (error || !data) return undefined
  return mapRow(data as Record<string, unknown>)
}

// ─── removeLeads ──────────────────────────────────────────────────────────

export async function removeLeads(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const supabase = await createClient()

  const { error, count } = await supabase
    .from("leads")
    .delete({ count: "exact" })
    .in("id", ids)

  if (error) throw new Error(`removeLeads: ${error.message}`)
  return count ?? 0
}
