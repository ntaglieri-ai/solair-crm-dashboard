// Store server-side — Supabase async puro ottimizzato.
// Search fulltext con indice GIN, paginazione server-side, query aggregate.
import { createClient } from "@/lib/supabase/server"
import type { Lead } from "@/lib/mock-data"
import type { AdvancedFilterState } from "@/lib/leads/advanced-filter-logic"

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
    Stato: (row.stato_email as Lead["Stato"]) ?? "—",
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
    "Ora creazione": (row.created_at as string) ?? "",
    "Data/Ora": (row.data_ora as string) ?? "",
    "Ora ultima attività": (row.ora_ultima_attivita as string) ?? "",
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

const LIST_COLUMNS = [
  "id", "nome_lead", "nome", "cognome", "email", "telefono", "mobile_fisso",
  "stato_lead", "stato_email", "valutazione", "lead_proprietario_id",
  "origine_lead", "sede", "campaign_name", "citta", "provincia",
  "codice_postale", "residente_in_sicilia", "wallbox_richiesto",
  "data_click", "data_ora", "ora_ultima_attivita", "created_at",
].join(",")

// Whitelist sicura: id colonna UI -> colonna DB ordinabile. Qualsiasi valore
// non presente qui ricade su "created_at" (fallback sicuro, nessun crash).
const SORT_COLUMN: Record<string, string> = {
  "Nome Lead": "nome_lead",
  Nome: "nome",
  Cognome: "cognome",
  "Stato Lead": "stato_lead",
  "Lead Proprietario": "lead_proprietario_id",
  Valutazione: "valutazione",
  leadCaldo: "valutazione",
  "Data Click": "data_click",
  "Ora creazione": "created_at",
  "Ora ultima attività": "ora_ultima_attivita",
  "Data/Ora": "data_ora",
  Città: "citta",
  Provincia: "provincia",
  "E-mail": "email",
  Telefono: "telefono",
  "Origine Lead": "origine_lead",
  Sede: "sede",
  "campaign name": "campaign_name",
}

// Risolve la colonna DB di ordinamento e la direzione, con fallback su
// created_at desc quando la colonna non è ordinabile lato DB.
function resolveSort(sortBy?: string | null, sortDir?: "asc" | "desc") {
  const column = (sortBy && SORT_COLUMN[sortBy]) || "created_at"
  const ascending = sortDir === "asc"
  return { column, ascending }
}

// Mappa campo Lead (UI filtri avanzati) -> colonna DB. I campi senza colonna
// (es. Tag, Installatore) vengono ignorati lato server.
const ADVANCED_DB_COLUMN: Record<string, string> = {
  "Account convertito": "account_convertito_id",
  "campaign name": "campaign_name",
  Città: "citta",
  "Codice postale": "codice_postale",
  Cognome: "cognome",
  "Connesso a": "connesso_a",
  "Contatto convertito": "contatto_convertito",
  "Creato da": "creato_da",
  "Data Click": "data_click",
  "Data sopralluogo": "data_sopralluogo",
  "Data/Ora": "data_ora",
  Descrizione: "descrizione",
  "E-mail": "email",
  kWh: "kwh",
  kWp: "kwp",
  "Lead Proprietario": "lead_proprietario_id",
  "Mobile/Fisso": "mobile_fisso",
  "Modalità iscrizione annullata": "modalita_iscrizione_annullata",
  "Modello pannello": "modello_pannello",
  Nome: "nome",
  "Nome Lead": "nome_lead",
  "Ora iscrizione annullata": "ora_iscrizione_annullata",
  "Ora creazione": "created_at",
  "Ora ultima attività": "ora_ultima_attivita",
  "Origine Lead": "origine_lead",
  Paese: "paese",
  Provincia: "provincia",
  "Residente in Sicilia": "residente_in_sicilia",
  Sede: "sede",
  "Social Lead ID": "social_lead_id",
  Stato: "stato_email",
  "Stato Lead": "stato_lead",
  Telefono: "telefono",
  "Tempo di conversione Lead": "tempo_conversione_lead",
  Valutazione: "valutazione",
}

// Traduce i filtri "per campo" avanzati in vincoli Supabase (AND tra campi).
// Generico sul builder: ogni metodo filtro ritorna lo stesso tipo, così la
// stessa funzione vale sia per la query lista che per quella di conteggio.
function applyAdvancedFilters<
  Q extends {
    ilike(column: string, pattern: string): Q
    in(column: string, values: string[]): Q
    gte(column: string, value: string | number): Q
    lte(column: string, value: string | number): Q
    eq(column: string, value: boolean): Q
  },
>(query: Q, advanced?: AdvancedFilterState): Q {
  if (!advanced) return query
  for (const [fid, fv] of Object.entries(advanced.fields)) {
    const col = ADVANCED_DB_COLUMN[fid]
    if (!col) continue
    if (fv.type === "text") {
      const c = fv.contains.trim()
      if (c) query = query.ilike(col, `%${c}%`)
    } else if (fv.type === "enum") {
      if (fv.selected.length > 0) query = query.in(col, fv.selected)
    } else if (fv.type === "number") {
      if (fv.min !== "") query = query.gte(col, Number(fv.min))
      if (fv.max !== "") query = query.lte(col, Number(fv.max))
    } else if (fv.type === "date") {
      if (fv.from !== "") query = query.gte(col, fv.from)
      if (fv.to !== "") query = query.lte(col, fv.to)
    } else if (fv.type === "boolean") {
      if (fv.value !== "all") query = query.eq(col, fv.value === "yes")
    }
  }
  return query
}

export async function candidateIdsByIndex(_filters: {
  stato?: string
  sede?: string
  commerciale?: string
}): Promise<Set<string> | null> {
  return null
}

export async function getAllLeads(filters?: {
  stato?: string
  sede?: string
  commerciale?: string
  origine?: string
  score?: string
  search?: string
  sortBy?: string | null
  sortDir?: "asc" | "desc"
  advanced?: AdvancedFilterState
  limit?: number
  offset?: number
}): Promise<Lead[]> {
  const supabase = await createClient()

  // Ordinamento reale lato query, applicato PRIMA di range/paginazione.
  const { column, ascending } = resolveSort(filters?.sortBy, filters?.sortDir)

  let query = supabase
    .from("leads")
    .select(LIST_COLUMNS)
    .order(column, { ascending, nullsFirst: false })

  // Tiebreaker deterministico: garantisce paginazione stabile a parità di valore.
  if (column !== "created_at")
    query = query.order("created_at", { ascending: false })

  if (filters?.stato && filters.stato !== "all")
    query = query.eq("stato_lead", filters.stato)
  if (filters?.sede && filters.sede !== "all")
    query = query.eq("sede", filters.sede)
  if (filters?.commerciale === "__unassigned__") {
    query = query.is("lead_proprietario_id", null)
  } else if (filters?.commerciale && filters.commerciale !== "all") {
    query = query.eq("lead_proprietario_id", filters.commerciale)
  }
  if (filters?.origine && filters.origine !== "all")
    query = query.eq("origine_lead", filters.origine)
  if (filters?.score && filters.score !== "all") {
    // Fasce di valutazione: caldo > 80, medio 50–80, freddo < 50.
    if (filters.score === "caldo") query = query.gt("valutazione", 80)
    else if (filters.score === "medio")
      query = query.gte("valutazione", 50).lte("valutazione", 80)
    else if (filters.score === "freddo") query = query.lt("valutazione", 50)
  }
  if (filters?.search?.trim()) {
    // Fulltext search con indice GIN
    query = query.textSearch(
      "idx_leads_search",
      filters.search.trim(),
      { type: "websearch", config: "italian" }
    )
  }

  // Filtri avanzati "per campo" — applicati PRIMA di range/paginazione.
  query = applyAdvancedFilters(query, filters?.advanced)

  if (filters?.limit) {
    const from = filters.offset ?? 0
    query = query.range(from, from + filters.limit - 1)
  }

  const { data, error } = await query
  if (error) {
    console.error("[server-store] getAllLeads error:", error.message)
    return []
  }
  const rows = (data as unknown as Record<string, unknown>[]).map(mapRow)
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return rows

  const [activities, tasks] = await Promise.all([
    supabase
      .from("attivita")
      .select("record_id,tipo")
      .eq("record_tipo", "lead")
      .in("record_id", ids),
    supabase
      .from("compiti")
      .select("correlato_id,stato")
      .eq("correlato_tipo", "lead")
      .in("correlato_id", ids)
      .neq("stato", "Completato"),
  ])
  if (activities.error) {
    console.error("[server-store] lead activities:", activities.error.message)
  }
  if (tasks.error) {
    console.error("[server-store] lead tasks:", tasks.error.message)
  }
  const noteIds = new Set(
    (activities.data ?? [])
      .filter((item) => item.tipo === "nota")
      .map((item) => item.record_id),
  )
  const taskIds = new Set((tasks.data ?? []).map((item) => item.correlato_id))

  return rows.map((row) => ({
    ...row,
    "Badge di nota": noteIds.has(row.id),
    "Badge dell'attività": taskIds.has(row.id),
  }))
}

export async function getTotalCount(filters?: {
  stato?: string
  sede?: string
  commerciale?: string
  origine?: string
  score?: string
  search?: string
  advanced?: AdvancedFilterState
}): Promise<number> {
  const supabase = await createClient()

  let query = supabase
    .from("leads")
    .select("id", { count: "exact", head: true })

  if (filters?.stato && filters.stato !== "all")
    query = query.eq("stato_lead", filters.stato)
  if (filters?.sede && filters.sede !== "all")
    query = query.eq("sede", filters.sede)
  if (filters?.commerciale === "__unassigned__") {
    query = query.is("lead_proprietario_id", null)
  } else if (filters?.commerciale && filters.commerciale !== "all") {
    query = query.eq("lead_proprietario_id", filters.commerciale)
  }
  if (filters?.origine && filters.origine !== "all")
    query = query.eq("origine_lead", filters.origine)
  if (filters?.score && filters.score !== "all") {
    // Fasce di valutazione: caldo > 80, medio 50–80, freddo < 50.
    if (filters.score === "caldo") query = query.gt("valutazione", 80)
    else if (filters.score === "medio")
      query = query.gte("valutazione", 50).lte("valutazione", 80)
    else if (filters.score === "freddo") query = query.lt("valutazione", 50)
  }
  if (filters?.search?.trim()) {
    query = query.textSearch(
      "idx_leads_search",
      filters.search.trim(),
      { type: "websearch", config: "italian" }
    )
  }

  // Stessi filtri avanzati della lista, per un conteggio coerente.
  query = applyAdvancedFilters(query, filters?.advanced)

  const { count, error } = await query
  if (error) {
    console.error("[server-store] getTotalCount error:", error.message)
    return 0
  }
  return count ?? 0
}

export async function getLeadById(id: string): Promise<Lead | undefined> {
  const supabase = await createClient()
  const [leadResult, activityResult, taskResult] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).single(),
    supabase
      .from("attivita")
      .select("id,tipo,testo,created_at,utente_id")
      .eq("record_tipo", "lead")
      .eq("record_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("compiti")
      .select("id,oggetto,scadenza,priorita,stato,proprietario_id")
      .eq("correlato_tipo", "lead")
      .eq("correlato_id", id)
      .order("scadenza", { ascending: true }),
  ])
  if (leadResult.error || !leadResult.data) return undefined

  const userIds = [
    ...new Set([
      ...(activityResult.data ?? []).map((item) => item.utente_id),
      ...(taskResult.data ?? []).map((item) => item.proprietario_id),
    ].filter((value): value is string => Boolean(value))),
  ]
  const usersResult = userIds.length
    ? await supabase.from("utenti").select("id,nome").in("id", userIds)
    : { data: [], error: null }
  const names = new Map((usersResult.data ?? []).map((user) => [user.id, user.nome]))
  const lead = mapRow(leadResult.data as Record<string, unknown>)
  lead.attivita = (activityResult.data ?? []).map((item) => ({
    id: item.id,
    tipo: item.tipo === "nota" ? "nota" : "cambio-stato",
    descrizione: item.testo ?? "",
    timestamp: item.created_at ?? "",
    autore: item.utente_id ? names.get(item.utente_id) ?? "Utente CRM" : "Sistema",
  }))
  lead.compiti = (taskResult.data ?? []).map((item) => ({
    id: item.id,
    oggetto: item.oggetto ?? "",
    scadenza: item.scadenza ?? "",
    priorita: item.priorita ?? "Medio",
    assegnato: item.proprietario_id
      ? names.get(item.proprietario_id) ?? "Non assegnato"
      : "Non assegnato",
    completato: item.stato === "Completato",
  }))
  lead["Badge di nota"] = lead.attivita.some((item) => item.tipo === "nota")
  lead["Badge dell'attività"] = lead.compiti.some((item) => !item.completato)
  return lead
}

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
  return (data as unknown as Record<string, unknown>[]).map(mapRow)
}

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

export async function patchLead(id: string, patch: Partial<Lead>): Promise<Lead | undefined> {
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
