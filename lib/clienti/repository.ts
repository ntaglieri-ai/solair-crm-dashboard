// Repository server-side del modulo Clienti — pattern identico a Lead.
// Nessun mock: tutte le query vanno su Supabase con proiezione selettiva.
import { createClient } from "@/lib/supabase/server"
import type {
  ClienteCompito,
  ClienteRecord,
  SedeLabel,
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
import { getCurrentPermissions } from "@/lib/permissions/server"
import { buildCustomPatch, CUSTOM_FIELD_PREFIX, customOptions, validDate, type CustomFieldMetadata } from "./custom-fields"
import { resolveInstallerAssignment } from "./installer-assignment"
import { applyOwnerScope, filterCurrentAccessibleRecordIds, resolveCurrentOwnerScope } from "@/lib/permissions/data-scope"
import {
  EMPTY_FILTER_VALUE,
  activeFilterValues,
  postgrestInList,
} from "@/lib/shared/filter-values"

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
  "zona",
  "installatore",
  "installatore_id",
  "clienti_proprietario",
  "clienti_proprietario_id",
  // Serve anche in lista: e' cio' che decide se l'invio email e' possibile.
  "consenso_contatto_email",
  "created_at",
  "updated_at",
  "ora_modifica",
  "ora_creazione",
].join(",")

const DETAIL_COLUMNS = [
  // installatore_id (FK uuid verso installatori) non e' tra le colonne Zoho:
  // va chiesto esplicitamente, serve al selettore "Installatore assegnato".
  //
  // Stesso motivo per `sede` e `clienti_proprietario_id`, aggiunte il
  // 24/08/2026: sono in LIST_COLUMNS ma non hanno una voce in zoho-fields,
  // quindi il dettaglio non le chiedeva affatto e mapRow le leggeva
  // undefined. Effetto: la scheda di un cliente mostrava Sede vuota anche
  // quando in tabella c'era, e cadeva sul nome testuale del proprietario
  // importato da Zoho invece che sul suo id. La lista era corretta, il
  // dettaglio no — per questo la cosa non saltava all'occhio.
  ...new Set([
    "id",
    "created_at",
    "updated_at",
    "installatore_id",
    "sede",
    "clienti_proprietario_id",
    ...CLIENTI_RECORD_COLUMNS,
  ]),
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
  "Clienti Proprietario": "proprietario_ordinamento",
  // Ordina sul nome (colonna testo, popolata da Zoho): installatore_id e' un
  // uuid quasi sempre null, ordinava di fatto per niente.
  Installatore: "installatore",
  // Report Vito (4): mancava, ordinamento appariva "solo alfabetico" perche'
  // Zona non era tra le colonne cliccabili — presente ovunque nel resto.
  // Rimossa per errore dal commit del filtro TAG (8de2d6e, patch generato
  // su un diff non sincronizzato), rimessa qui.
  Zona: "zona",
  "Ora modifica": "modifica_visualizzata",
  "Ora creazione": "creazione_visualizzata",
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
  const clientiProprietarioId =
    typeof row.clienti_proprietario_id === "string"
      ? row.clienti_proprietario_id.trim()
      : ""
  const clientiProprietarioNome =
    typeof row.clienti_proprietario === "string"
      ? row.clienti_proprietario.trim()
      : ""

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
    Stato: typeof row.stato === "string" ? row.stato : "",
    Nome: (row.nome as string) || undefined,
    Cellulare: (row.cellulare as string) || undefined,
    "Codice fiscale": (row.codice_fiscale as string) || undefined,
    "Clienti Proprietario":
      clientiProprietarioId || clientiProprietarioNome || undefined,
    ClientiProprietarioNome: clientiProprietarioNome || undefined,
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
  const sortCol = (params.sortBy && SORT_COLUMN[params.sortBy]) || "modifica_visualizzata"
  const ascending = params.sortDir === "asc"
  const from = (params.page - 1) * params.pageSize
  const to = from + params.pageSize - 1

  // Construisce entrambe le query con gli stessi filtri per consistenza.
  let listQ = supabase
    .from("clienti_report_list")
    .select(LIST_COLUMNS)
    .order(sortCol, { ascending, nullsFirst: false })
    .order("id", { ascending: true })
    .range(from, to)

  let countQ = supabase
    .from("clienti")
    .select("id", { count: "exact", head: true })
  const ownerScope = await resolveCurrentOwnerScope("clienti")
  listQ = applyOwnerScope(listQ, "clienti_proprietario_id", ownerScope)
  countQ = applyOwnerScope(countQ, "clienti_proprietario_id", ownerScope)

  if (params.search.trim()) {
    const p = `%${params.search.trim()}%`
    const filter = `nome_clienti.ilike.${p},email.ilike.${p},cellulare.ilike.${p}`
    listQ = listQ.or(filter)
    countQ = countQ.or(filter)
  }
  const statoValues = activeFilterValues(params.stato)
  if (statoValues.length > 0) {
    const wantsEmpty = statoValues.includes(EMPTY_FILTER_VALUE)
    const realValues = statoValues.filter((value) => value !== EMPTY_FILTER_VALUE)
    if (wantsEmpty && realValues.length > 0) {
      const filter = `stato.in.(${postgrestInList(realValues)}),stato.is.null,stato.eq.`
      listQ = listQ.or(filter)
      countQ = countQ.or(filter)
    } else if (wantsEmpty) {
      listQ = listQ.or("stato.is.null,stato.eq.")
      countQ = countQ.or("stato.is.null,stato.eq.")
    } else {
      listQ = listQ.in("stato", realValues)
      countQ = countQ.in("stato", realValues)
    }
  }
  const sedeValues = activeFilterValues(params.sede)
  if (sedeValues.length > 0) {
    listQ = listQ.in("sede", sedeValues)
    countQ = countQ.in("sede", sedeValues)
  }
  const proprietarioValues = activeFilterValues(params.proprietario)
  if (proprietarioValues.length > 0) {
    listQ = listQ.in("clienti_proprietario_id", proprietarioValues)
    countQ = countQ.in("clienti_proprietario_id", proprietarioValues)
  }
  const installatoreValues = activeFilterValues(params.installatore)
  if (installatoreValues.length > 0) {
    // Il filtro arriva come nome (colonna testo): installatore_id e' un uuid
    // quasi sempre null e un valore non-uuid faceva errare l'intera query.
    listQ = listQ.in("installatore", installatoreValues)
    countQ = countQ.in("installatore", installatoreValues)
  }
  const tagValues = activeFilterValues(params.tag)
  if (tagValues.length > 0) {
    // cliente_tags e' una tabella ponte (cliente_id, tag_id): niente join
    // diretto via query builder per un .eq su una colonna di clienti, quindi
    // si risolve prima l'elenco di id con quel tag, poi si restringe con
    // .in(). Array vuoto = nessun cliente ha quel tag: si esce subito senza
    // interrogare "clienti" (un .in("id", []) su alcune versioni del client
    // restituirebbe tutte le righe invece di zero).
    const taggedIds = await supabase.from("cliente_tags").select("cliente_id").in("tag_id", tagValues)
    if (taggedIds.error) {
      console.error("[clienti/repository] filtro tag:", taggedIds.error.message)
    }
    const ids = (taggedIds.data ?? []).map((r) => r.cliente_id)
    if (ids.length === 0) {
      return { rows: [], total: 0, page: params.page, pageSize: params.pageSize }
    }
    listQ = listQ.in("id", ids)
    countQ = countQ.in("id", ids)
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

  if (error || countError) {
    console.error("[clienti/repository] queryClienti:", (error ?? countError)?.message)
    throw new Error("Caricamento clienti non riuscito. Verificare le migrazioni del database.")
  }

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

/**
 * Legge i campi custom visibili per il modulo Clienti (crm_custom_fields,
 * colonna reale aggiunta via ALTER TABLE da CRM Settings → Attributi) e i
 * loro valori per QUESTO cliente. Sempre a prova di errore: se la tabella
 * metadata non esiste ancora o la query fallisce, ritorna array vuoto
 * invece di far fallire l'intera pagina cliente per un pezzo accessorio.
 */
async function loadClienteCustomFieldValues(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clienteId: string,
): Promise<ClienteRecord["customFields"]> {
  const { data: fields, error: fieldsError } = await supabase
    .from("crm_custom_fields")
    .select("field_key, label, tipo, column_name, required, options")
    .eq("table_name", "clienti")
    .eq("visible", true)
    .is("deleted_at", null)
    .order("ordinamento", { ascending: true })

  if (fieldsError || !fields || fields.length === 0) return []

  const permissions = await getCurrentPermissions()
  const visibleFields = fields.filter((f) => /^[a-z][a-z0-9_]*$/.test(f.column_name) && permissions.canField("clienti", f.column_name, "view"))
  if (!visibleFields.length) return []
  const columns = visibleFields.map((f) => f.column_name as string)
  const { data: row, error: valuesError } = await supabase
    .from("clienti")
    .select(columns.join(","))
    .eq("id", clienteId)
    .maybeSingle()

  if (valuesError || !row) return []

  return visibleFields.map((f) => ({
    key: f.field_key as string,
    label: f.label as string,
    tipo: f.tipo as string,
    column: f.column_name as string,
    required: Boolean(f.required),
    options: customOptions(f.options),
    value: (row as unknown as Record<string, unknown>)[f.column_name as string] ?? null,
  }))
}

export async function getClienteById(
  id: string,
): Promise<ClienteRecord | null> {
  const supabase = await createClient()
  const ownerScope = await resolveCurrentOwnerScope("clienti")

  // Record e compiti correlati sono indipendenti: si lanciano insieme, così la
  // pagina di dettaglio paga un roundtrip invece di due in sequenza.
  const [detailResult, compiti] = await Promise.all([
    applyOwnerScope(supabase.from("clienti").select(DETAIL_COLUMNS).eq("id", id), "clienti_proprietario_id", ownerScope).single(),
    loadCompitiCorrelati(id),
  ])

  if (!detailResult.error && detailResult.data) {
    const cliente = mapRow(detailResult.data as unknown as Record<string, unknown>)
    cliente.compiti = compiti
    cliente.customFields = await loadClienteCustomFieldValues(supabase, id)
    return cliente
  }

  const fallbackQ = applyOwnerScope(supabase
    .from("clienti")
    .select(LIST_COLUMNS)
    .eq("id", id), "clienti_proprietario_id", ownerScope)
  const { data, error } = await fallbackQ.single()
  if (error || !data) return null
  const cliente = mapRow(data as unknown as Record<string, unknown>)
  cliente.customFields = await loadClienteCustomFieldValues(supabase, id)
  cliente.compiti = compiti
  return cliente
}

export async function createClienteRecord(
  body: Partial<ClienteRecord>,
  leadId?: string,
): Promise<ClienteRecord> {
  const supabase = await createClient()
  const installer = body.InstallatoreId !== undefined
    ? await resolveInstallerAssignment(supabase, body.InstallatoreId)
    : { installatore: body.Installatore || null, installatore_id: null }
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
      ...installer,
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
  // Opzionale e in coda: i chiamanti esistenti (tag-italia.ts, tool MCP)
  // continuano a funzionare invariati con `null` silenzioso per design. Solo
  // la route HTTP lo passa, per non mostrare piu' "Cliente non trovato" a un
  // cliente che esiste benissimo ma il cui update e' stato rifiutato da
  // Postgres (es. una data in formato non valido).
  onError?: (message: string) => void,
): Promise<ClienteRecord | null> {
  const allowed = await filterCurrentAccessibleRecordIds("clienti", "clienti", "clienti_proprietario_id", [id])
  if (allowed.length === 0) return null
  const supabase = await createClient()
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  row.ora_modifica = row.updated_at
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
  if (patch.InstallatoreId !== undefined) {
    try { Object.assign(row, await resolveInstallerAssignment(supabase, patch.InstallatoreId)) }
    catch (error) { onError?.(error instanceof Error ? error.message : "Installatore non valido"); return null }
  }
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
      if (field.type === "timestamp" && patchRecord[field.appField] !== null && patchRecord[field.appField] !== "") {
        const value = patchRecord[field.appField]
        if (typeof value !== "string" || !validDate(value.slice(0, 10)) || (value.length !== 10 && !Number.isFinite(Date.parse(value)))) {
          onError?.(`${field.appField}: data non valida`)
          return null
        }
      }
      row[field.column] = patchRecord[field.appField]
    }
  }

  if (Object.keys(patchRecord).some((key) => key.startsWith(CUSTOM_FIELD_PREFIX))) {
    const { data: fields, error: metadataError } = await supabase.from("crm_custom_fields")
      .select("field_key,column_name,label,tipo,required,options")
      .eq("table_name", "clienti").eq("visible", true).eq("system", false).is("deleted_at", null)
    if (metadataError) { onError?.("Impossibile verificare i campi personalizzati"); return null }
    const permissions = await getCurrentPermissions()
    try {
      const custom = buildCustomPatch(patchRecord, (fields ?? []) as CustomFieldMetadata[],
        (column) => !CLIENTI_RECORD_COLUMNS.includes(column) && !["id", "updated_at", "created_at", "clienti_proprietario_id", "installatore_id", "lead_id", "sede"].includes(column) && permissions.canField("clienti", column, "edit"))
      Object.assign(row, custom)
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Campi personalizzati non validi")
      return null
    }
  }

  const { data, error } = await supabase
    .from("clienti")
    .update(row)
    .eq("id", id)
    .select(LIST_COLUMNS)
    .single()
  if (error) {
    onError?.(error.message)
    return null
  }
  if (!data) return null

  // Tag "Italia" (spec 2.3) rivalutato a ogni modifica della provincia — la
  // colonna e' scritta dal ciclo generico qui sopra, quindi il controllo va
  // fatto sul patch e non su `row`. `in` e non `!== undefined`: un patch che
  // svuota il campo passa comunque, e applicaTagItalia decide che non c'e'
  // nulla da taggare.
  if ("Provincia indirizzo postale" in patchRecord) {
    await applicaTagItalia(id, patchRecord["Provincia indirizzo postale"])
  }

  const updated = mapRow(data as unknown as Record<string, unknown>)
  if (Object.keys(patchRecord).some((key) => key.startsWith(CUSTOM_FIELD_PREFIX))) {
    updated.customFields = await loadClienteCustomFieldValues(supabase, id)
  }
  return updated
}

export async function deleteClienteRecords(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const allowed = await filterCurrentAccessibleRecordIds("clienti", "clienti", "clienti_proprietario_id", ids)
  if (allowed.length === 0) return 0
  const supabase = await createClient()
  const { error, count } = await supabase
    .from("clienti")
    .delete({ count: "exact" })
    .in("id", allowed)
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
