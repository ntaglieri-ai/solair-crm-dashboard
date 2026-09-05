// Store server-side — Supabase async puro ottimizzato.
// Search fulltext con indice GIN, paginazione server-side, query aggregate.
import { createClient } from "@/lib/supabase/server"
import { activeFilterValues, postgrestInList } from "@/lib/shared/filter-values"
import type { Lead } from "@/lib/mock-data"
import type { AdvancedFilterState } from "@/lib/leads/advanced-filter-logic"
import { LEAD_RECORD_FIELDS } from "@/lib/leads/field-map"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

async function attachInstallatoreSopralluogoNames(
  supabase: SupabaseServerClient,
  rows: Record<string, unknown>[],
) {
  const crmIds = [
    ...new Set(
      rows
        .map((row) => row.installatore_sopralluogo_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ]
  const zohoIds = [
    ...new Set(
      rows
        .map((row) => row.zoho_installatore_sopralluogo_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ]

  const [crmResult, zohoResult] = await Promise.all([
    crmIds.length
      ? supabase.from("installatori").select("id,nome").in("id", crmIds)
      : Promise.resolve({ data: [], error: null }),
    zohoIds.length
      ? supabase.from("installatori").select("zoho_id,nome").in("zoho_id", zohoIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (crmResult.error) {
    console.error("[server-store] installatore sopralluogo CRM:", crmResult.error.message)
  }
  if (zohoResult.error) {
    console.error("[server-store] installatore sopralluogo Zoho:", zohoResult.error.message)
  }

  const nameByCrmId = new Map((crmResult.data ?? []).map((row) => [row.id, row.nome]))
  const nameByZohoId = new Map(
    (zohoResult.data ?? [])
      .filter((row) => row.zoho_id)
      .map((row) => [row.zoho_id as string, row.nome]),
  )

  return rows.map((row) => {
    const crmId = row.installatore_sopralluogo_id
    const zohoId = row.zoho_installatore_sopralluogo_id
    return {
      ...row,
      installatore_sopralluogo_nome:
        (typeof crmId === "string" ? nameByCrmId.get(crmId) : null) ??
        (typeof zohoId === "string" ? nameByZohoId.get(zohoId) : null) ??
        null,
    }
  })
}

function mapRow(row: Record<string, unknown>): Lead {
  const installatoreSopralluogoNome =
    (row.installatore_sopralluogo_nome as string | null) ??
    (row.zoho_installatore_sopralluogo_nome as string | null) ??
    null
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
    "Consenso telefono": (row.consenso_contatto_telefono as boolean) ?? false,
    "Consenso WhatsApp": (row.consenso_contatto_whatsapp as boolean) ?? false,
    "Consenso e-mail": (row.consenso_contatto_email as boolean) ?? false,
    "Data sopralluogo": (row.data_sopralluogo as string) ?? null,
    InstallatoreSopralluogoId: (row.installatore_sopralluogo_id as string) ?? null,
    "Installatore - Incaricato sopralluogo": installatoreSopralluogoNome,
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
    noteItems: [],
    taskItems: [],
    tagIds: [],
    documenti: [],
  }
}

const LIST_COLUMNS = [
  "id", "nome_lead", "nome", "cognome", "email", "telefono", "mobile_fisso",
  "stato_lead", "stato_email", "valutazione", "lead_proprietario_id",
  "origine_lead", "sede", "campaign_name", "citta", "provincia",
  "codice_postale", "residente_in_sicilia", "wallbox_richiesto",
  "consenso_contatto_telefono", "consenso_contatto_whatsapp", "consenso_contatto_email",
  "data_sopralluogo", "installatore_sopralluogo_id", "zoho_installatore_sopralluogo_id",
  "zoho_installatore_sopralluogo_nome", "data_click", "data_ora", "ora_ultima_attivita", "created_at",
  "updated_at",
].join(",")

// Whitelist sicura: id colonna UI -> colonna DB ordinabile. Qualsiasi valore
// non presente qui ricade su "updated_at" (ultimo movimento interno del record).
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
// updated_at desc quando la colonna non è ordinabile lato DB.
function resolveSort(sortBy?: string | null, sortDir?: "asc" | "desc") {
  const column = (sortBy && SORT_COLUMN[sortBy]) || "updated_at"
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
  "Installatore - Incaricato sopralluogo": "installatore_sopralluogo_id",
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
  stato?: string[]
  sede?: string[]
  commerciale?: string[]
}): Promise<Set<string> | null> {
  void _filters
  return null
}

export async function getAllLeads(filters?: {
  stato?: string[]
  sede?: string[]
  commerciale?: string[]
  origine?: string[]
  tag?: string[]
  score?: string[]
  search?: string
  sortBy?: string | null
  sortDir?: "asc" | "desc"
  advanced?: AdvancedFilterState
  limit?: number
  offset?: number
  visibleOwnerIds?: string[]
}): Promise<Lead[]> {
  const supabase = await createClient()

  // Ordinamento reale lato query, applicato PRIMA di range/paginazione.
  const { column, ascending } = resolveSort(filters?.sortBy, filters?.sortDir)

  let query = supabase
    .from("leads")
    .select(LIST_COLUMNS)
    .order(column, { ascending, nullsFirst: false })

  if (filters?.visibleOwnerIds) {
    query = query.in("lead_proprietario_id", filters.visibleOwnerIds)
  }

  // Tiebreaker deterministici: garantiscono paginazione stabile a parità di valore.
  if (column !== "updated_at")
    query = query.order("updated_at", { ascending: false, nullsFirst: false })
  if (column !== "created_at")
    query = query.order("created_at", { ascending: false, nullsFirst: false })

  const statoValues = activeFilterValues(filters?.stato)
  if (statoValues.length > 0)
    query = query.in("stato_lead", statoValues)
  const sedeValues = activeFilterValues(filters?.sede)
  if (sedeValues.length > 0)
    query = query.in("sede", sedeValues)
  const commercialeValues = activeFilterValues(filters?.commerciale)
  const ownerValues = commercialeValues.filter((value) => value !== "__unassigned__")
  if (commercialeValues.includes("__unassigned__") && ownerValues.length > 0) {
    query = query.or(`lead_proprietario_id.in.(${postgrestInList(ownerValues)}),lead_proprietario_id.is.null`)
  } else if (commercialeValues.includes("__unassigned__")) {
    query = query.is("lead_proprietario_id", null)
  } else if (ownerValues.length > 0) {
    query = query.in("lead_proprietario_id", ownerValues)
  }
  const origineValues = activeFilterValues(filters?.origine)
  if (origineValues.length > 0)
    query = query.in("origine_lead", origineValues)
  const scoreValues = activeFilterValues(filters?.score)
  if (scoreValues.length > 0 && scoreValues.length < 3) {
    // Fasce di valutazione: caldo > 80, medio 50–80, freddo < 50.
    if (scoreValues.includes("caldo") && scoreValues.includes("freddo")) {
      query = query.or("valutazione.gt.80,valutazione.lt.50")
    } else if (scoreValues.includes("caldo") && scoreValues.includes("medio")) {
      query = query.gte("valutazione", 50)
    } else if (scoreValues.includes("medio") && scoreValues.includes("freddo")) {
      query = query.lte("valutazione", 80)
    } else if (scoreValues.includes("caldo")) query = query.gt("valutazione", 80)
    else if (scoreValues.includes("medio"))
      query = query.gte("valutazione", 50).lte("valutazione", 80)
    else if (scoreValues.includes("freddo")) query = query.lt("valutazione", 50)
  }
  const tagValues = activeFilterValues(filters?.tag)
  if (tagValues.length > 0) {
    const { data: tagRows, error: tagError } = await supabase
      .from("lead_tags")
      .select("lead_id")
      .in("tag_id", tagValues)
    if (tagError) throw new Error(`Filtro tag lead non riuscito: ${tagError.message}`)
    const ids = [...new Set((tagRows ?? []).map((row) => row.lead_id as string))]
    if (ids.length === 0) return []
    query = query.in("id", ids)
  }
  if (filters?.search?.trim()) {
    // Non esiste una colonna tsvector reale su leads (verificato 25/07 via
    // information_schema — query vuota, nessun risultato): il precedente
    // query.textSearch("idx_leads_search", ...) passava per errore il nome
    // di un indice come se fosse una colonna, e comunque quella colonna
    // non esiste. Stesso meccanismo ilike/or gia' usato in Cliente, niente
    // migration necessaria.
    const p = `%${filters.search.trim()}%`
    query = query.or(`nome_lead.ilike.${p},email.ilike.${p},telefono.ilike.${p}`)
  }

  // Filtri avanzati "per campo" — applicati PRIMA di range/paginazione.
  query = applyAdvancedFilters(query, filters?.advanced)

  if (filters?.limit) {
    const from = filters.offset ?? 0
    query = query.range(from, from + filters.limit - 1)
  }

  const { data, error } = await query
  if (error) {
    // NON restituire una lista vuota: la pagina mostrerebbe "nessun lead",
    // indistinguibile da "non ne hai". Successo il 22/08/2026 durante il
    // riavvio del database per l'upgrade del piano: la lista risultava vuota
    // e sembrava che i dati fossero spariti. Meglio far emergere l'errore.
    console.error("[server-store] getAllLeads error:", error.message)
    throw new Error(`Lettura lead non riuscita: ${error.message}`)
  }
  const leadRows = await attachInstallatoreSopralluogoNames(
    supabase,
    data as unknown as Record<string, unknown>[],
  )
  const rows = leadRows.map(mapRow)
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return rows

  const [activities, tasks, tagAssignments] = await Promise.all([
    supabase
      .from("attivita")
      .select("record_id")
      .eq("record_tipo", "lead")
      .eq("tipo", "nota")
      .in("record_id", ids),
    supabase
      .from("compiti")
      .select("correlato_id")
      .eq("correlato_tipo", "lead")
      .in("correlato_id", ids)
      .neq("stato", "Completato"),
    supabase
      .from("lead_tags")
      .select("lead_id,tag_id")
      .in("lead_id", ids),
  ])
  if (activities.error) {
    console.error("[server-store] lead activities:", activities.error.message)
  }
  if (tasks.error) {
    console.error("[server-store] lead tasks:", tasks.error.message)
  }
  if (tagAssignments.error) {
    console.error("[server-store] lead tags:", tagAssignments.error.message)
  }
  const noteIds = new Set(
    (activities.data ?? [])
      .map((item) => item.record_id),
  )
  const taskIds = new Set((tasks.data ?? []).map((item) => item.correlato_id))

  return rows.map((row) => ({
    ...row,
    "Badge di nota": noteIds.has(row.id),
    "Badge dell'attività": taskIds.has(row.id),
    noteItems: [],
    taskItems: [],
    tagIds: (tagAssignments.data ?? [])
      .filter((item) => item.lead_id === row.id)
      .map((item) => item.tag_id),
  }))
}

export async function getTotalCount(filters?: {
  stato?: string[]
  sede?: string[]
  commerciale?: string[]
  origine?: string[]
  tag?: string[]
  score?: string[]
  search?: string
  advanced?: AdvancedFilterState
  visibleOwnerIds?: string[]
}): Promise<number> {
  const supabase = await createClient()

  let query = supabase
    .from("leads")
    .select("id", { count: "exact", head: true })

  if (filters?.visibleOwnerIds) {
    query = query.in("lead_proprietario_id", filters.visibleOwnerIds)
  }

  const statoValues = activeFilterValues(filters?.stato)
  if (statoValues.length > 0)
    query = query.in("stato_lead", statoValues)
  const sedeValues = activeFilterValues(filters?.sede)
  if (sedeValues.length > 0)
    query = query.in("sede", sedeValues)
  const commercialeValues = activeFilterValues(filters?.commerciale)
  const ownerValues = commercialeValues.filter((value) => value !== "__unassigned__")
  if (commercialeValues.includes("__unassigned__") && ownerValues.length > 0) {
    query = query.or(`lead_proprietario_id.in.(${postgrestInList(ownerValues)}),lead_proprietario_id.is.null`)
  } else if (commercialeValues.includes("__unassigned__")) {
    query = query.is("lead_proprietario_id", null)
  } else if (ownerValues.length > 0) {
    query = query.in("lead_proprietario_id", ownerValues)
  }
  const origineValues = activeFilterValues(filters?.origine)
  if (origineValues.length > 0)
    query = query.in("origine_lead", origineValues)
  const scoreValues = activeFilterValues(filters?.score)
  if (scoreValues.length > 0 && scoreValues.length < 3) {
    // Fasce di valutazione: caldo > 80, medio 50–80, freddo < 50.
    if (scoreValues.includes("caldo") && scoreValues.includes("freddo")) {
      query = query.or("valutazione.gt.80,valutazione.lt.50")
    } else if (scoreValues.includes("caldo") && scoreValues.includes("medio")) {
      query = query.gte("valutazione", 50)
    } else if (scoreValues.includes("medio") && scoreValues.includes("freddo")) {
      query = query.lte("valutazione", 80)
    } else if (scoreValues.includes("caldo")) query = query.gt("valutazione", 80)
    else if (scoreValues.includes("medio"))
      query = query.gte("valutazione", 50).lte("valutazione", 80)
    else if (scoreValues.includes("freddo")) query = query.lt("valutazione", 50)
  }
  const tagValues = activeFilterValues(filters?.tag)
  if (tagValues.length > 0) {
    const { data: tagRows, error: tagError } = await supabase
      .from("lead_tags")
      .select("lead_id")
      .in("tag_id", tagValues)
    if (tagError) throw new Error(`Filtro tag lead non riuscito: ${tagError.message}`)
    const ids = [...new Set((tagRows ?? []).map((row) => row.lead_id as string))]
    if (ids.length === 0) return 0
    query = query.in("id", ids)
  }
  if (filters?.search?.trim()) {
    const p = `%${filters.search.trim()}%`
    query = query.or(`nome_lead.ilike.${p},email.ilike.${p},telefono.ilike.${p}`)
  }

  // Stessi filtri avanzati della lista, per un conteggio coerente.
  query = applyAdvancedFilters(query, filters?.advanced)

  const { count, error } = await query
  if (error) {
    // Come sopra: uno 0 finto farebbe leggere "0 lead disponibili".
    console.error("[server-store] getTotalCount error:", error.message)
    throw new Error(`Conteggio lead non riuscito: ${error.message}`)
  }
  return count ?? 0
}

export async function getLeadById(id: string): Promise<Lead | undefined> {
  const supabase = await createClient()
  const [leadResult, activityResult, taskResult] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).single(),
    supabase
      .from("attivita")
      .select("id,tipo,testo,created_at,utente_id,menzioni")
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
  const [leadRow] = await attachInstallatoreSopralluogoNames(
    supabase,
    [leadResult.data as Record<string, unknown>],
  )
  const lead = mapRow(leadRow)
  lead.attivita = (activityResult.data ?? []).map((item) => ({
    id: item.id,
    tipo:
      item.tipo === "nota"
        ? "nota"
        : item.tipo === "nuovo-lead"
          ? "nuovo-lead"
          : "cambio-stato",
    descrizione: item.testo ?? "",
    timestamp: item.created_at ?? "",
    autore: item.utente_id ? names.get(item.utente_id) ?? "Utente CRM" : "Sistema",
    menzioni: (item.menzioni ?? []) as import("@/lib/notes/mentions").NoteMention[],
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
    throw new Error(`Lettura lead non riuscita: ${error.message}`)
  }
  const leadRows = await attachInstallatoreSopralluogoNames(
    supabase,
    data as unknown as Record<string, unknown>[],
  )
  return leadRows.map(mapRow)
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
  const [row] = await attachInstallatoreSopralluogoNames(supabase, [data as Record<string, unknown>])
  return mapRow(row)
}

export async function patchLead(id: string, patch: Partial<Lead>): Promise<Lead | undefined> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const row: Record<string, unknown> = {
    ora_ultima_attivita: now,
    updated_at: now,
  }
  const patchRecord = patch as Record<string, unknown>
  for (const field of LEAD_RECORD_FIELDS) {
    if (field.appField in patchRecord) row[field.column] = patchRecord[field.appField]
  }
  const { data, error } = await supabase
    .from("leads")
    .update(row)
    .eq("id", id)
    .select()
    .single()
  if (error || !data) return undefined
  const [updatedRow] = await attachInstallatoreSopralluogoNames(supabase, [data as Record<string, unknown>])
  return mapRow(updatedRow)
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
