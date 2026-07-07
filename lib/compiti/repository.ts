// Repository server-side del modulo Compiti — pattern identico a Lead/Clienti.
// Nessun mock: tutte le query vanno su Supabase con proiezione selettiva.
import { createClient } from "@/lib/supabase/server"
import type {
  Compito,
  StatoCompito,
  PrioritaCompito,
  SedeLabel,
} from "@/lib/mock-data"
import type {
  CompitiListParams,
  CompitiListResponse,
} from "@/lib/compiti/api-types"

// Colonne proiettate in lettura — mai SELECT *.
const LIST_COLUMNS = [
  "id",
  "zoho_record_id",
  "oggetto",
  "priorita",
  "stato",
  "scadenza",
  "proprietario_id",
  "proprietario_zoho_id",
  "proprietario_nome",
  "nome_contatto_zoho_id",
  "nome_contatto",
  "correlato_id",
  "correlato_tipo",
  "correlato_zoho_id",
  "correlato_nome",
  "descrizione",
  "ripeti",
  "promemoria",
  "creato_da_zoho_id",
  "creato_da_nome",
  "modificato_da_zoho_id",
  "modificato_da_nome",
  "ora_creazione",
  "ora_modifica",
  "orario_chiusura",
  "tag",
  "locked",
  "ora_ultima_attivita",
  "sede",
  "created_at",
  "updated_at",
].join(",")

const LEGACY_LIST_COLUMNS = [
  "id",
  "oggetto",
  "priorita",
  "stato",
  "scadenza",
  "proprietario_id",
  "correlato_id",
  "correlato_tipo",
  "descrizione",
  "sede",
  "created_at",
  "updated_at",
].join(",")

// Whitelist ordinamento: campo UI → colonna DB.
const SORT_COLUMN: Record<string, string> = {
  Oggetto: "oggetto",
  Stato: "stato",
  Priorità: "priorita",
  "Data di scadenza": "scadenza",
  "Proprietario del compito": "proprietario_nome",
  "Nome contatto": "nome_contatto",
  Tag: "tag",
}

const LEGACY_SORT_COLUMN: Record<string, string> = {
  Oggetto: "oggetto",
  Stato: "stato",
  Priorità: "priorita",
  "Data di scadenza": "scadenza",
  "Proprietario del compito": "proprietario_id",
}

const DB_STATI: StatoCompito[] = [
  "Non iniziato",
  "In corso",
  "Rinviato",
  "Completato",
  "In attesa di input",
]

/** ISO (o YYYY-MM-DD) → DD/MM/YYYY. Restituisce "" se non valido. */
function isoToDMY(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const day = String(d.getUTCDate()).padStart(2, "0")
  const month = String(d.getUTCMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${d.getUTCFullYear()}`
}

/** DD/MM/YYYY → ISO (YYYY-MM-DDT00:00:00Z). Restituisce null se non valido. */
function dmyToISO(dmy: string): string | null {
  const [d, m, y] = dmy.split("/")
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00Z`
}

function mapRow(row: Record<string, unknown>): Compito {
  const correlatoId =
    (row.correlato_id as string | null) || (row.correlato_zoho_id as string | null)
  const correlatoNome = (row.correlato_nome as string | null) || correlatoId
  const correlatoTipo = row.correlato_tipo as string | null

  return {
    id: row.id as string,
    "ID record": (row.zoho_record_id as string) ?? "",
    Oggetto: (row.oggetto as string) ?? "",
    Stato: (row.stato as StatoCompito) ?? "Non iniziato",
    Priorità: (row.priorita as PrioritaCompito) ?? "Medio",
    "Data di scadenza": isoToDMY(row.scadenza as string | null),
    "Proprietario del compito.id": (row.proprietario_zoho_id as string) ?? "",
    "Proprietario del compito":
      (row.proprietario_nome as string) ?? (row.proprietario_id as string) ?? "",
    "Nome contatto.id": (row.nome_contatto_zoho_id as string) ?? "",
    "Nome contatto": (row.nome_contatto as string) ?? "",
    "Correlato a.id": (row.correlato_zoho_id as string) ?? "",
    Sede: (row.sede as SedeLabel) ?? ("" as SedeLabel),
    "Correlato a":
      correlatoId
        ? {
            tipo: correlatoTipo === "lead" ? "Lead" : "Cliente",
            id: correlatoId,
            nome: correlatoNome ?? correlatoId,
          }
        : null,
    Descrizione: (row.descrizione as string) ?? "",
    Ripeti: (row.ripeti as string) ?? "",
    Promemoria: (row.promemoria as string | null) ?? null,
    "Creato da.id": (row.creato_da_zoho_id as string) ?? "",
    "Creato da": (row.creato_da_nome as string) ?? "",
    "Modificato da.id": (row.modificato_da_zoho_id as string) ?? "",
    "Modificato da": (row.modificato_da_nome as string) ?? "",
    "Data di creazione": isoToDMY(
      (row.ora_creazione as string | null) ?? (row.created_at as string | null),
    ),
    "Ora modifica": isoToDMY(
      (row.ora_modifica as string | null) ?? (row.updated_at as string | null),
    ),
    "Orario di chiusura": (row.orario_chiusura as string | null) ?? null,
    Tag: (row.tag as string) ?? "",
    Locked: Boolean(row.locked),
    "Ora ultima attività": (row.ora_ultima_attivita as string) ?? "",
    Note: [],
  }
}

export async function queryCompiti(
  params: CompitiListParams,
): Promise<CompitiListResponse> {
  const supabase = await createClient()
  const run = async (extended: boolean) => {
    const sortMap = extended ? SORT_COLUMN : LEGACY_SORT_COLUMN
    const sortCol = (params.sortBy && sortMap[params.sortBy]) || "scadenza"
    const ascending = params.sortDir === "asc"
    const from = (params.page - 1) * params.pageSize
    const to = from + params.pageSize - 1
    const now = new Date().toISOString()

    let listQ = supabase
      .from("compiti")
      .select(extended ? LIST_COLUMNS : LEGACY_LIST_COLUMNS)
      .order(sortCol, { ascending, nullsFirst: false })
      .range(from, to)

    let countQ = supabase
      .from("compiti")
      .select("id", { count: "exact", head: true })

    let scadutiQ = supabase
      .from("compiti")
      .select("id", { count: "exact", head: true })
      .lt("scadenza", now)
      .neq("stato", "Completato")

    if (params.search.trim()) {
      const p = `%${params.search.trim()}%`
      const f = extended
        ? `oggetto.ilike.${p},descrizione.ilike.${p},proprietario_nome.ilike.${p},nome_contatto.ilike.${p},correlato_nome.ilike.${p},tag.ilike.${p}`
        : `oggetto.ilike.${p},descrizione.ilike.${p}`
      listQ = listQ.or(f)
      countQ = countQ.or(f)
      scadutiQ = scadutiQ.or(f)
    }
    if (params.stati.length > 0) {
      const dbStati = params.stati.filter((stato) => DB_STATI.includes(stato))
      listQ = listQ.in("stato", dbStati)
      countQ = countQ.in("stato", dbStati)
      scadutiQ = scadutiQ.in("stato", dbStati)
    }
    if (params.priorita !== "all") {
      listQ = listQ.eq("priorita", params.priorita)
      countQ = countQ.eq("priorita", params.priorita)
      scadutiQ = scadutiQ.eq("priorita", params.priorita)
    }
    if (params.proprietario !== "all") {
      const ownerColumn = extended ? "proprietario_nome" : "proprietario_id"
      listQ = listQ.eq(ownerColumn, params.proprietario)
      countQ = countQ.eq(ownerColumn, params.proprietario)
      scadutiQ = scadutiQ.eq(ownerColumn, params.proprietario)
    }
    if (params.sede !== "all") {
      listQ = listQ.eq("sede", params.sede)
      countQ = countQ.eq("sede", params.sede)
      scadutiQ = scadutiQ.eq("sede", params.sede)
    }
    if (params.scadenzaDa) {
      listQ = listQ.gte("scadenza", params.scadenzaDa)
      countQ = countQ.gte("scadenza", params.scadenzaDa)
    }
    if (params.scadenzaA) {
      listQ = listQ.lte("scadenza", params.scadenzaA + "T23:59:59Z")
      countQ = countQ.lte("scadenza", params.scadenzaA + "T23:59:59Z")
    }

    const [
      { data, error },
      { count, error: countError },
      { count: scadutiCount, error: scadutiError },
    ] = await Promise.all([listQ, countQ, scadutiQ])

    return { data, error, count, countError, scadutiCount, scadutiError }
  }

  let result = await run(true)
  if (result.error) {
    console.warn(
      "[compiti/repository] schema esteso non disponibile, fallback legacy:",
      result.error.message,
    )
    result = await run(false)
  }

  if (result.error)
    console.error("[compiti/repository] queryCompiti:", result.error.message)
  if (result.countError)
    console.error("[compiti/repository] count:", result.countError.message)
  if (result.scadutiError)
    console.error("[compiti/repository] scaduti:", result.scadutiError.message)

  return {
    rows: (result.data ?? []).map((r) =>
      mapRow(r as unknown as Record<string, unknown>),
    ),
    total: result.count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
    scadutiTotal: result.scadutiCount ?? 0,
  }
}

export async function getCompitoById(id: string): Promise<Compito | null> {
  const supabase = await createClient()
  let { data, error } = await supabase
    .from("compiti")
    .select(LIST_COLUMNS)
    .eq("id", id)
    .single()
  if (error) {
    const fallback = await supabase
      .from("compiti")
      .select(LEGACY_LIST_COLUMNS)
      .eq("id", id)
      .single()
    data = fallback.data
    error = fallback.error
  }
  if (error || !data) return null
  return mapRow(data as unknown as Record<string, unknown>)
}

export async function createCompitoRecord(
  body: Partial<Compito>,
): Promise<Compito> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("compiti")
    .insert({
      oggetto: body.Oggetto || null,
      stato: body.Stato || "Non iniziato",
      priorita: body.Priorità || "Medio",
      scadenza: body["Data di scadenza"]
        ? dmyToISO(body["Data di scadenza"])
        : null,
      proprietario_zoho_id: body["Proprietario del compito.id"] || null,
      proprietario_nome: body["Proprietario del compito"] || null,
      sede: body.Sede || null,
      descrizione: body.Descrizione || null,
      nome_contatto_zoho_id: body["Nome contatto.id"] || null,
      nome_contatto: body["Nome contatto"] || null,
      correlato_zoho_id: body["Correlato a.id"] || body["Correlato a"]?.id || null,
      correlato_nome: body["Correlato a"]?.nome || null,
      correlato_tipo: body["Correlato a"]?.tipo.toLowerCase() || null,
      ripeti: body.Ripeti || null,
      promemoria: body.Promemoria || null,
      tag: body.Tag || null,
      locked: body.Locked ?? false,
    })
    .select(LIST_COLUMNS)
    .single()
  if (error) throw new Error(`createCompitoRecord: ${error.message}`)
  return mapRow(data as unknown as Record<string, unknown>)
}

export async function updateCompitoRecord(
  id: string,
  patch: Partial<Compito>,
): Promise<Compito | null> {
  const supabase = await createClient()
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (patch.Oggetto !== undefined) row.oggetto = patch.Oggetto
  if (patch.Stato !== undefined) row.stato = patch.Stato
  if (patch.Priorità !== undefined) row.priorita = patch.Priorità
  if (patch["Data di scadenza"] !== undefined)
    row.scadenza = dmyToISO(patch["Data di scadenza"])
  if (patch["Proprietario del compito"] !== undefined)
    row.proprietario_nome = patch["Proprietario del compito"]
  if (patch["Proprietario del compito.id"] !== undefined)
    row.proprietario_zoho_id = patch["Proprietario del compito.id"]
  if (patch.Sede !== undefined) row.sede = patch.Sede
  if (patch.Descrizione !== undefined) row.descrizione = patch.Descrizione
  if (patch["Nome contatto.id"] !== undefined)
    row.nome_contatto_zoho_id = patch["Nome contatto.id"]
  if (patch["Nome contatto"] !== undefined) row.nome_contatto = patch["Nome contatto"]
  if (patch.Ripeti !== undefined) row.ripeti = patch.Ripeti
  if (patch.Promemoria !== undefined) row.promemoria = patch.Promemoria
  if (patch.Tag !== undefined) row.tag = patch.Tag
  if (patch.Locked !== undefined) row.locked = patch.Locked
  if (patch["Correlato a"] !== undefined) {
    row.correlato_zoho_id = patch["Correlato a"]?.id ?? null
    row.correlato_nome = patch["Correlato a"]?.nome ?? null
    row.correlato_tipo = patch["Correlato a"]?.tipo.toLowerCase() ?? null
  }

  const { data, error } = await supabase
    .from("compiti")
    .update(row)
    .eq("id", id)
    .select(LIST_COLUMNS)
    .single()
  if (error || !data) return null
  return mapRow(data as unknown as Record<string, unknown>)
}

export async function deleteCompitoRecords(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const supabase = await createClient()
  const { error, count } = await supabase
    .from("compiti")
    .delete({ count: "exact" })
    .in("id", ids)
  if (error) throw new Error(`deleteCompitoRecords: ${error.message}`)
  return count ?? 0
}
