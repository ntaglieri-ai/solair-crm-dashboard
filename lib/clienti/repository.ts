// Repository server-side del modulo Clienti — pattern identico a Lead.
// Nessun mock: tutte le query vanno su Supabase con proiezione selettiva.
import { createClient } from "@/lib/supabase/server"
import type { ClienteRecord, SedeLabel, StatoCliente, StatoCompito } from "@/lib/mock-data"
import type {
  ClientiListParams,
  ClientiListResponse,
} from "@/lib/clienti/api-types"
import { CLIENTI_ZOHO_COLUMNS, CLIENTI_ZOHO_FIELDS } from "@/lib/clienti/zoho-fields"

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
  "installatore_id",
  "clienti_proprietario_id",
  "created_at",
  "updated_at",
].join(",")

const DETAIL_COLUMNS = [
  ...new Set(["id", "created_at", "updated_at", ...CLIENTI_ZOHO_COLUMNS]),
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
  Installatore: "installatore_id",
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
    Installatore:
      (row.installatore as string) || (row.installatore_id as string) || undefined,
    "Ora creazione":
      (row.ora_creazione as string) || (row.created_at as string) || undefined,
  }

  for (const field of CLIENTI_ZOHO_FIELDS) {
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
    listQ = listQ.eq("installatore_id", params.installatore)
    countQ = countQ.eq("installatore_id", params.installatore)
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
  for (const row of rows) {
    row["Badge dell'attività"] = withActivity.has(row.id)
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

async function attachCompiti(
  cliente: ClienteRecord,
  id: string,
): Promise<ClienteRecord> {
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

  cliente.compiti = (taskResult.data ?? []).map((row) => ({
    id: row.id as string,
    oggetto: (row.oggetto as string) ?? "",
    scadenza: (row.scadenza as string) ?? "",
    priorita: (row.priorita as string) ?? "Medio",
    assegnato: row.proprietario_id
      ? names.get(row.proprietario_id as string) ?? "Non assegnato"
      : "Non assegnato",
    stato: (row.stato as StatoCompito) ?? "Non iniziato",
  }))
  return cliente
}

export async function getClienteById(
  id: string,
): Promise<ClienteRecord | null> {
  const supabase = await createClient()
  const detailResult = await supabase
    .from("clienti")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .single()

  if (!detailResult.error && detailResult.data) {
    const cliente = mapRow(detailResult.data as unknown as Record<string, unknown>)
    return attachCompiti(cliente, id)
  }

  const { data, error } = await supabase
    .from("clienti")
    .select(LIST_COLUMNS)
    .eq("id", id)
    .single()
  if (error || !data) return null
  const cliente = mapRow(data as unknown as Record<string, unknown>)
  return attachCompiti(cliente, id)
}

export async function createClienteRecord(
  body: Partial<ClienteRecord>,
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
      installatore_id: body.Installatore || null,
    })
    .select(LIST_COLUMNS)
    .single()
  if (error) throw new Error(`createClienteRecord: ${error.message}`)
  return mapRow(data as unknown as Record<string, unknown>)
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
  if (patch.Installatore !== undefined) row.installatore_id = patch.Installatore
  if (patch.Descrizione !== undefined) row.descrizione = patch.Descrizione

  const { data, error } = await supabase
    .from("clienti")
    .update(row)
    .eq("id", id)
    .select(LIST_COLUMNS)
    .single()
  if (error || !data) return null
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
