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
  const correlato_id = row.correlato_id as string | null
  const correlato_tipo = row.correlato_tipo as string | null

  return {
    id: row.id as string,
    Oggetto: (row.oggetto as string) ?? "",
    Stato: (row.stato as StatoCompito) ?? "Non iniziato",
    Priorità: (row.priorita as PrioritaCompito) ?? "Medio",
    "Data di scadenza": isoToDMY(row.scadenza as string | null),
    "Proprietario del compito": (row.proprietario_id as string) ?? "",
    Sede: (row.sede as SedeLabel) ?? ("" as SedeLabel),
    "Correlato a":
      correlato_id && correlato_tipo
        ? {
            tipo: correlato_tipo === "lead" ? "Lead" : "Cliente",
            id: correlato_id,
            nome: correlato_id, // nome non in DB — fallback all'id
          }
        : null,
    Descrizione: (row.descrizione as string) ?? "",
    Promemoria: null,
    "Data di creazione": isoToDMY(row.created_at as string | null),
    "Orario di chiusura": null,
    Note: [],
  }
}

export async function queryCompiti(
  params: CompitiListParams,
): Promise<CompitiListResponse> {
  const supabase = await createClient()
  const sortCol = (params.sortBy && SORT_COLUMN[params.sortBy]) || "scadenza"
  const ascending = params.sortDir === "asc"
  const from = (params.page - 1) * params.pageSize
  const to = from + params.pageSize - 1
  const now = new Date().toISOString()

  let listQ = supabase
    .from("compiti")
    .select(LIST_COLUMNS)
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
    const f = `oggetto.ilike.${p},descrizione.ilike.${p}`
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
    listQ = listQ.eq("proprietario_id", params.proprietario)
    countQ = countQ.eq("proprietario_id", params.proprietario)
    scadutiQ = scadutiQ.eq("proprietario_id", params.proprietario)
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

  if (error) console.error("[compiti/repository] queryCompiti:", error.message)
  if (countError) console.error("[compiti/repository] count:", countError.message)
  if (scadutiError) console.error("[compiti/repository] scaduti:", scadutiError.message)

  return {
    rows: (data ?? []).map((r) => mapRow(r as unknown as Record<string, unknown>)),
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
    scadutiTotal: scadutiCount ?? 0,
  }
}

export async function getCompitoById(id: string): Promise<Compito | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("compiti")
    .select(LIST_COLUMNS)
    .eq("id", id)
    .single()
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
      proprietario_id: body["Proprietario del compito"] || null,
      sede: body.Sede || null,
      descrizione: body.Descrizione || null,
      correlato_id: body["Correlato a"]?.id || null,
      correlato_tipo: body["Correlato a"]?.tipo.toLowerCase() || null,
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
    row.proprietario_id = patch["Proprietario del compito"]
  if (patch.Sede !== undefined) row.sede = patch.Sede
  if (patch.Descrizione !== undefined) row.descrizione = patch.Descrizione
  if (patch["Correlato a"] !== undefined) {
    row.correlato_id = patch["Correlato a"]?.id ?? null
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
