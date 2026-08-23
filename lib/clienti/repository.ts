// Repository server-side del modulo Clienti — pattern identico a Lead.
// Nessun mock: tutte le query vanno su Supabase con proiezione selettiva.
import { createClient } from "@/lib/supabase/server"
import type {
  ClienteCompito,
  ClienteRecord,
  SedeLabel,
  StatoCliente,
  StatoCompito,
} from "@/lib/mock-data"
import type {
  ClientiListItem,
  ClientiListParams,
  ClientiListResponse,
} from "@/lib/clienti/api-types"
import { CLIENTI_RECORD_COLUMNS, CLIENTI_RECORD_FIELDS } from "@/lib/clienti/zoho-fields"
import { applicaTagItalia } from "@/lib/clienti/tag-italia"
import { DEFAULT_CLIENTI_PARAMS } from "@/lib/clienti/api-types"

// Colonne proiettate in lettura — mai SELECT *.
const LIST_COLUMNS = [
  "id",
  "nome",
  "cognome",
  "nome_clienti",
  "email",
  "cellulare",
  "codice_fiscale",
  "tag",
  "stato",
  "sede",
  "installatore",
  "installatore_id",
  "clienti_proprietario_id",
  "created_at",
  "updated_at",
].join(",")

const DETAIL_COLUMNS = [
  // installatore_id (FK uuid verso installatori) non e' tra le colonne Zoho:
  // va chiesto esplicitamente, serve al selettore "Installatore assegnato".
  ...new Set(["id", "created_at", "updated_at", "installatore_id", ...CLIENTI_RECORD_COLUMNS]),
].join(",")

// Whitelist ordinamento: campo UI → colonna DB. Fallback su updated_at.
const SORT_COLUMN: Record<string, string> = {
  "Nome Clienti": "nome_clienti",
  Nome: "nome",
  Cognome: "cognome",
  "E-mail": "email",
  Cellulare: "cellulare",
  "Codice fiscale": "codice_fiscale",
  Stato: "stato",
  Sede: "sede",
  "Clienti Proprietario": "clienti_proprietario_id",
  // Ordina sul nome (colonna testo, popolata da Zoho): installatore_id e' un
  // uuid quasi sempre null, ordinava di fatto per niente.
  Installatore: "installatore",
  "Ora modifica": "updated_at",
  "Ora creazione": "created_at",
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean)
  }

  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function mapRow(row: Record<string, unknown>): ClienteRecord {
  const record: ClienteRecord = {
    id: row.id as string,
    "Badge dell'attività": false,
    "Badge di nota": false,
    "Nome Clienti": (row.nome_clienti as string) ?? "",
    "E-mail": (row.email as string) ?? "",
    "Ora modifica":
      (row.ora_modifica as string) ??
      (row.updated_at as string) ??
      (row.created_at as string) ??
      "",
    Tag: parseTags(row.tag),
    Sede: (row.sede as SedeLabel) ?? ("" as SedeLabel),
    Cognome: (row.cognome as string) ?? "",
    Stato: (row.stato as StatoCliente) ?? "Attesa cliente",
    Nome: (row.nome as string) || undefined,
    Cellulare: (row.cellulare as string) || undefined,
    "Codice fiscale": (row.codice_fiscale as string) || undefined,
    "Clienti Proprietario":
      (row.clienti_proprietario as string) ||
      (row.clienti_proprietario_id as string) ||
      undefined,
    Installatore: (row.installatore as string) || undefined,
    InstallatoreId: (row.installatore_id as string) || undefined,
    "Ora creazione":
      (row.ora_creazione as string) || (row.created_at as string) || undefined,
  }

  for (const field of CLIENTI_RECORD_FIELDS) {
    const value = row[field.column]
    if (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      !(field.appField in record)
    ) {
      ;(record as unknown as Record<string, unknown>)[field.appField] = value
    }
  }

  return record
}

export async function queryClienti(
  params: ClientiListParams,
  options?: { ids?: string[] },
): Promise<ClientiListResponse> {
  const supabase = await createClient()
  const sortCol = (params.sortBy && SORT_COLUMN[params.sortBy]) || "updated_at"
  const ascending = params.sortDir === "asc"
  const from = (params.page - 1) * params.pageSize
  const to = from + params.pageSize - 1

  // Construisce entrambe le query con gli stessi filtri per consistenza.
  let listQ = supabase
    .from("clienti")
    .select(LIST_COLUMNS)
    .order(sortCol, { ascending, nullsFirst: false })
    .range(from, to)

  let countQ = supabase
    .from("clienti")
    .select("id", { count: "exact", head: true })

  if (params.search.trim()) {
    const p = `%${params.search.trim()}%`
    const filter = `nome_clienti.ilike.${p},email.ilike.${p},cellulare.ilike.${p}`
    listQ = listQ.or(filter)
    countQ = countQ.or(filter)
  }
  if (params.stato !== "all") {
    listQ = listQ.eq("stato", params.stato)
    countQ = countQ.eq("stato", params.stato)
  }
  if (params.sede !== "all") {
    listQ = listQ.eq("sede", params.sede)
    countQ = countQ.eq("sede", params.sede)
  }
  if (params.proprietario !== "all") {
    listQ = listQ.eq("clienti_proprietario_id", params.proprietario)
    countQ = countQ.eq("clienti_proprietario_id", params.proprietario)
  }
  if (params.installatore !== "all") {
    // Il filtro arriva come nome (colonna testo): installatore_id e' un uuid
    // quasi sempre null e un valore non-uuid faceva errare l'intera query.
    listQ = listQ.eq("installatore", params.installatore)
    countQ = countQ.eq("installatore", params.installatore)
  }
  // Restringe a una selezione esplicita di id (usato solo dall'export di una
  // selezione). Passa dagli stessi filtri della lista, cosi' un cliente che
  // l'utente non potrebbe comunque vedere non esce dall'export.
  if (options?.ids) {
    listQ = listQ.in("id", options.ids)
    countQ = countQ.in("id", options.ids)
  }

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    listQ,
    countQ,
  ])

  if (error) console.error("[clienti/repository] queryClienti:", error.message)
  if (countError) console.error("[clienti/repository] count:", countError.message)

  const rows = (data ?? []).map((r) => mapRow(r as unknown as Record<string, unknown>))
  const pageIds = rows.map((r) => r.id)
  const withActivity = await clientiWithOpenCompiti(supabase, pageIds)
  const tagAssignments = await supabase
    .from("cliente_tags")
    .select("cliente_id,tag_id")
    .in("cliente_id", pageIds)
  if (tagAssignments.error) {
    console.error("[clienti/repository] cliente_tags:", tagAssignments.error.message)
  }
  for (const row of rows) {
    row["Badge dell'attività"] = withActivity.has(row.id)
    row.tagIds = (tagAssignments.data ?? [])
      .filter((item) => item.cliente_id === row.id)
      .map((item) => item.tag_id)
  }

  return {
    rows,
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  }
}

// Batch singolo per pagina: quali clienti hanno almeno un compito aperto
// collegato. Evita una query per riga.
async function clientiWithOpenCompiti(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const { data, error } = await supabase
    .from("compiti")
    .select("correlato_id")
    .eq("correlato_tipo", "cliente")
    .in("correlato_id", ids)
    .neq("stato", "Completato")
  if (error) {
    console.error("[clienti/repository] clientiWithOpenCompiti:", error.message)
    return new Set()
  }
  return new Set(
    (data ?? [])
      .map((row) => row.correlato_id as string | null)
      .filter((value): value is string => Boolean(value)),
  )
}

// Carica i compiti correlati a un cliente. Separata da attachCompiti perché
// dipende solo dall'id: così getClienteById può lanciarla IN PARALLELO con la
// query del record invece di aspettarne l'esito (erano due roundtrip in fila).
async function loadCompitiCorrelati(id: string): Promise<ClienteCompito[]> {
  const supabase = await createClient()
  const taskResult = await supabase
    .from("compiti")
    .select("id,oggetto,scadenza,priorita,stato,proprietario_id")
    .eq("correlato_tipo", "cliente")
    .eq("correlato_id", id)
    .order("scadenza", { ascending: true })

  const ownerIds = [
    ...new Set(
      (taskResult.data ?? [])
        .map((row) => row.proprietario_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ]
  const usersResult = ownerIds.length
    ? await supabase.from("utenti").select("id,nome").in("id", ownerIds)
    : { data: [] }
  const names = new Map((usersResult.data ?? []).map((user) => [user.id, user.nome]))

  return (taskResult.data ?? []).map((row) => ({
    id: row.id as string,
    oggetto: (row.oggetto as string) ?? "",
    scadenza: (row.scadenza as string) ?? "",
    priorita: (row.priorita as string) ?? "Medio",
    assegnato: row.proprietario_id
      ? names.get(row.proprietario_id as string) ?? "Non assegnato"
      : "Non assegnato",
    stato: (row.stato as StatoCompito) ?? "Non iniziato",
  }))
}

export async function getClienteById(
  id: string,
): Promise<ClienteRecord | null> {
  const supabase = await createClient()

  // Record e compiti correlati sono indipendenti: si lanciano insieme, così la
  // pagina di dettaglio paga un roundtrip invece di due in sequenza.
  const [detailResult, compiti] = await Promise.all([
    supabase.from("clienti").select(DETAIL_COLUMNS).eq("id", id).single(),
    loadCompitiCorrelati(id),
  ])

  if (!detailResult.error && detailResult.data) {
    const cliente = mapRow(detailResult.data as unknown as Record<string, unknown>)
    cliente.compiti = compiti
    return cliente
  }

  const { data, error } = await supabase
    .from("clienti")
    .select(LIST_COLUMNS)
    .eq("id", id)
    .single()
  if (error || !data) return null
  const cliente = mapRow(data as unknown as Record<string, unknown>)
  cliente.compiti = compiti
  return cliente
}

export async function createClienteRecord(
  body: Partial<ClienteRecord>,
  leadId?: string,
): Promise<ClienteRecord> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("clienti")
    .insert({
      nome_clienti: body["Nome Clienti"] || null,
      nome: body.Nome || null,
      cognome: body.Cognome || null,
      email: body["E-mail"] || null,
      cellulare: body.Cellulare || null,
      codice_fiscale: body["Codice fiscale"] || null,
      stato: body.Stato || null,
      sede: body.Sede || null,
      clienti_proprietario_id: body["Clienti Proprietario"] || null,
      // installatore = nome (testo), installatore_id = FK uuid: scrivere il
      // nome nell'uuid faceva fallire l'intera insert.
      installatore: body.Installatore || null,
      installatore_id: body.InstallatoreId || null,
      // Serve alla regola 2.3 (tag "Italia"): la conversione Lead->Cliente
      // porta con se' la provincia del lead, quindi va scritta subito invece
      // di aspettare che qualcuno riapra il cliente e la ricompili a mano.
      provincia_indirizzo_postale: body["Provincia indirizzo postale"] || null,
      lead_id: leadId ?? null,
    })
    .select(LIST_COLUMNS)
    .single()
  if (error) throw new Error(`createClienteRecord: ${error.message}`)
  const cliente = mapRow(data as unknown as Record<string, unknown>)

  // Tag "Italia" automatico (spec 2.3) valutato gia' alla creazione: e' il
  // momento della conversione, quando il cliente nasce con la provincia del
  // lead. Non blocca: applicaTagItalia logga e tira avanti.
  await applicaTagItalia(cliente.id, body["Provincia indirizzo postale"])

  return cliente
}

export async function updateClienteRecord(
  id: string,
  patch: Partial<ClienteRecord>,
): Promise<ClienteRecord | null> {
  const supabase = await createClient()
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (patch["Nome Clienti"] !== undefined) row.nome_clienti = patch["Nome Clienti"]
  if (patch.Nome !== undefined) row.nome = patch.Nome
  if (patch.Cognome !== undefined) row.cognome = patch.Cognome
  if (patch["E-mail"] !== undefined) row.email = patch["E-mail"]
  if (patch.Cellulare !== undefined) row.cellulare = patch.Cellulare
  if (patch["Codice fiscale"] !== undefined)
    row.codice_fiscale = patch["Codice fiscale"]
  if (patch.Stato !== undefined) row.stato = patch.Stato
  if (patch.Sede !== undefined) row.sede = patch.Sede
  if (patch["Clienti Proprietario"] !== undefined)
    row.clienti_proprietario_id = patch["Clienti Proprietario"]
  // installatore = nome (testo), installatore_id = FK uuid: scrivere il nome
  // nell'uuid faceva fallire l'intero update.
  if (patch.Installatore !== undefined) row.installatore = patch.Installatore
  if (patch.InstallatoreId !== undefined) row.installatore_id = patch.InstallatoreId
  if (patch.Descrizione !== undefined) row.descrizione = patch.Descrizione

  // Supporto generico per tutti i campi del record — quelli importati da Zoho
  // piu' i nativi CRM di CLIENTI_CRM_FIELDS (inclusi i 6 toggle
  // Pagamenti/Iter/Documenti: Finanziamento approvato, Iva Reverse charge,
  // Notifica pred. reg. esercizio, Disponibilità Fine lavori, Verifica
  // documentale, Layout verificato — trovati tutti "finti" il 25/07,
  // salvavano solo in locale). Stesso principio della lettura generica in
  // mapRow: qualsiasi campo futuro funziona a scrittura senza dover
  // aggiungere una riga esplicita qui ogni volta.
  const patchRecord = patch as Record<string, unknown>
  for (const field of CLIENTI_RECORD_FIELDS) {
    if (field.appField in patchRecord && !(field.column in row)) {
      row[field.column] = patchRecord[field.appField]
    }
  }

  const { data, error } = await supabase
    .from("clienti")
    .update(row)
    .eq("id", id)
    .select(LIST_COLUMNS)
    .single()
  if (error || !data) return null

  // Tag "Italia" (spec 2.3) rivalutato a ogni modifica della provincia — la
  // colonna e' scritta dal ciclo generico qui sopra, quindi il controllo va
  // fatto sul patch e non su `row`. `in` e non `!== undefined`: un patch che
  // svuota il campo passa comunque, e applicaTagItalia decide che non c'e'
  // nulla da taggare.
  if ("Provincia indirizzo postale" in patchRecord) {
    await applicaTagItalia(id, patchRecord["Provincia indirizzo postale"])
  }

  return mapRow(data as unknown as Record<string, unknown>)
}

export async function deleteClienteRecords(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const supabase = await createClient()
  const { error, count } = await supabase
    .from("clienti")
    .delete({ count: "exact" })
    .in("id", ids)
  if (error) throw new Error(`deleteClienteRecords: ${error.message}`)
  return count ?? 0
}

// ----------------------------------------------------------------------------
// Export CSV — stesso contratto del modulo Lead (vedi lib/leads/repository.ts
// per il ragionamento sul tetto). Qui si riusa queryClienti a pagine grandi
// invece di riscrivere la query: la lista porta con se' i tag e il badge
// attivita', che nel CSV servono, e la tabella e' piccola (16 righe reali al
// 23/08/2026), quindi il costo di qualche COUNT(*) in piu' e' irrilevante.
// ----------------------------------------------------------------------------

export const EXPORT_MAX_ROWS = 5000
const EXPORT_CHUNK = 500

export interface ExportQueryResult<T> {
  rows: T[]
  total: number
  truncated: boolean
  limit: number
}

export async function queryClientiForExport(
  params: ClientiListParams,
): Promise<ExportQueryResult<ClientiListItem>> {
  const rows: ClientiListItem[] = []
  let total = 0

  for (let page = 1; ; page += 1) {
    const res = await queryClienti({ ...params, page, pageSize: EXPORT_CHUNK })
    total = res.total
    rows.push(...res.rows)
    if (res.rows.length < EXPORT_CHUNK) break
    if (rows.length >= Math.min(total, EXPORT_MAX_ROWS)) break
  }

  const capped = rows.slice(0, EXPORT_MAX_ROWS)
  return { rows: capped, total, truncated: total > capped.length, limit: EXPORT_MAX_ROWS }
}

/**
 * Export di una selezione esplicita: gli id vengono risolti sul database, non
 * filtrando lato client una pagina gia' troncata.
 */
export async function queryClientiByIdsForExport(
  ids: string[],
): Promise<ExportQueryResult<ClientiListItem>> {
  const unique = Array.from(new Set(ids)).slice(0, EXPORT_MAX_ROWS)
  if (unique.length === 0) {
    return { rows: [], total: 0, truncated: false, limit: EXPORT_MAX_ROWS }
  }

  const rows: ClientiListItem[] = []
  // .in() finisce nell'URL della richiesta PostgREST: si spezza la lista per
  // non superarne la lunghezza massima.
  for (let i = 0; i < unique.length; i += 200) {
    const res = await queryClienti(
      { ...DEFAULT_CLIENTI_PARAMS, page: 1, pageSize: EXPORT_CHUNK },
      { ids: unique.slice(i, i + 200) },
    )
    rows.push(...res.rows)
  }

  return {
    rows,
    total: unique.length,
    truncated: rows.length < unique.length,
    limit: EXPORT_MAX_ROWS,
  }
}
