import { createClient } from "@/lib/supabase/server"
import type { ClienteCompito, StatoCompito } from "@/lib/mock-data"
import type { ScadenzeListParams, ScadenzeListResponse, ScadenzaSortKey } from "@/lib/scadenze/api-types"

export type ScadenzaRecord = {
  id: string
  nome: string
  data_scadenza: string
  proprietario_id: string | null
  proprietario_nome: string | null
  descrizione: string | null
  connesso_a_id: string | null
  connesso_a_tipo: "lead" | "cliente" | null
  tag: string | null
  created_at: string | null
  updated_at: string | null
}

type ScadenzaRow = ScadenzaRecord

async function ownerNames(ids: Array<string | null>) {
  const ownerIds = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (ownerIds.length === 0) return new Map<string, string>()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("utenti")
    .select("id, nome")
    .in("id", ownerIds)

  if (error) throw new Error(`Lettura proprietari scadenze: ${error.message}`)
  return new Map((data ?? []).map((user) => [user.id, user.nome]))
}

// proprietario_nome è anche una colonna reale (fallback dall'import Zoho,
// vedi scripts/migrations/import-zoho-scadenze.mjs): la preferenza va
// comunque al nome live in `utenti`, per restare aggiornato se l'utente
// cambia nome.
function withOwner(
  row: ScadenzaRow,
  owners: Map<string, string>,
): ScadenzaRecord {
  return {
    ...row,
    proprietario_nome: row.proprietario_id
      ? (owners.get(row.proprietario_id) ?? row.proprietario_nome ?? null)
      : row.proprietario_nome,
  }
}

const SCADENZA_COLUMNS =
  "id,nome,data_scadenza,proprietario_id,proprietario_nome,descrizione,connesso_a_id,connesso_a_tipo,tag,created_at,updated_at"

const SORT_COLUMN: Record<ScadenzaSortKey, string> = {
  nome: "nome",
  data_scadenza: "data_scadenza",
  proprietario_nome: "proprietario_nome",
  updated_at: "updated_at",
}

export async function getScadenze(): Promise<ScadenzaRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("scadenze")
    .select(SCADENZA_COLUMNS)
    .order("data_scadenza", { ascending: true })

  if (error) throw new Error(`Lettura scadenze: ${error.message}`)
  const rows = (data ?? []) as ScadenzaRow[]
  const owners = await ownerNames(rows.map((row) => row.proprietario_id))
  return rows.map((row) => withOwner(row, owners))
}

export async function queryScadenze(
  params: ScadenzeListParams,
): Promise<ScadenzeListResponse> {
  const supabase = await createClient()
  const sortCol = (params.sortBy && SORT_COLUMN[params.sortBy]) || "data_scadenza"
  const ascending = params.sortDir === "asc"
  const from = (params.page - 1) * params.pageSize
  const to = from + params.pageSize - 1
  const now = new Date()
  const nowIso = now.toISOString()
  const in7DaysIso = new Date(now.getTime() + 7 * 86_400_000).toISOString()

  let listQ = supabase
    .from("scadenze")
    .select(SCADENZA_COLUMNS)
    .order(sortCol, { ascending, nullsFirst: false })
    .range(from, to)
  let countQ = supabase.from("scadenze").select("id", { count: "exact", head: true })

  if (params.search.trim()) {
    const p = `%${params.search.trim()}%`
    listQ = listQ.ilike("nome", p)
    countQ = countQ.ilike("nome", p)
  }
  if (params.proprietario !== "all") {
    listQ = listQ.eq("proprietario_id", params.proprietario)
    countQ = countQ.eq("proprietario_id", params.proprietario)
  }
  if (params.tag !== "all") {
    listQ = listQ.eq("tag", params.tag)
    countQ = countQ.eq("tag", params.tag)
  }
  if (params.scadenzaDa) {
    listQ = listQ.gte("data_scadenza", params.scadenzaDa)
    countQ = countQ.gte("data_scadenza", params.scadenzaDa)
  }
  if (params.scadenzaA) {
    listQ = listQ.lte("data_scadenza", params.scadenzaA + "T23:59:59Z")
    countQ = countQ.lte("data_scadenza", params.scadenzaA + "T23:59:59Z")
  }
  if (params.collegamento === "si") {
    listQ = listQ.not("connesso_a_id", "is", null)
    countQ = countQ.not("connesso_a_id", "is", null)
  } else if (params.collegamento === "no") {
    listQ = listQ.is("connesso_a_id", null)
    countQ = countQ.is("connesso_a_id", null)
  }

  const [
    { data, error },
    { count, error: countError },
    { count: absoluteTotal, error: absoluteTotalError },
    { count: scaduteTotal, error: scaduteTotalError },
    { count: prossimi7Total, error: prossimi7TotalError },
  ] = await Promise.all([
    listQ,
    countQ,
    supabase.from("scadenze").select("id", { count: "exact", head: true }),
    supabase
      .from("scadenze")
      .select("id", { count: "exact", head: true })
      .lt("data_scadenza", nowIso),
    supabase
      .from("scadenze")
      .select("id", { count: "exact", head: true })
      .gte("data_scadenza", nowIso)
      .lte("data_scadenza", in7DaysIso),
  ])

  if (error) console.error("[scadenze/repository] queryScadenze:", error.message)
  if (countError) console.error("[scadenze/repository] count:", countError.message)
  if (absoluteTotalError)
    console.error("[scadenze/repository] absoluteTotal:", absoluteTotalError.message)
  if (scaduteTotalError)
    console.error("[scadenze/repository] scaduteTotal:", scaduteTotalError.message)
  if (prossimi7TotalError)
    console.error("[scadenze/repository] prossimi7Total:", prossimi7TotalError.message)

  const rows = (data ?? []) as ScadenzaRow[]
  const owners = await ownerNames(rows.map((row) => row.proprietario_id))

  return {
    rows: rows.map((row) => withOwner(row, owners)),
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
    absoluteTotal: absoluteTotal ?? 0,
    scaduteTotal: scaduteTotal ?? 0,
    prossimi7Total: prossimi7Total ?? 0,
  }
}

export async function getDistinctScadenzaTags(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("scadenze")
    .select("tag")
    .not("tag", "is", null)
  if (error) throw new Error(`Lettura tag scadenze: ${error.message}`)
  return [...new Set((data ?? []).map((row) => row.tag as string))].sort()
}

export async function getScadenzaById(
  id: string,
): Promise<ScadenzaRecord | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("scadenze")
    .select(SCADENZA_COLUMNS)
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(`Lettura scadenza: ${error.message}`)
  if (!data) return null
  const row = data as ScadenzaRow
  const owners = await ownerNames([row.proprietario_id])
  return withOwner(row, owners)
}

// Compiti collegati (correlato_tipo/correlato_id = "scadenza"/id) — stesso
// pattern di lead/server-store.ts e clienti/repository.ts.
export async function getScadenzaCompiti(id: string): Promise<ClienteCompito[]> {
  const supabase = await createClient()
  const taskResult = await supabase
    .from("compiti")
    .select("id,oggetto,scadenza,priorita,stato,proprietario_id")
    .eq("correlato_tipo", "scadenza")
    .eq("correlato_id", id)
    .order("scadenza", { ascending: true })

  if (taskResult.error)
    throw new Error(`Lettura compiti scadenza: ${taskResult.error.message}`)

  const owners = await ownerNames(
    (taskResult.data ?? []).map((row) => row.proprietario_id),
  )

  return (taskResult.data ?? []).map((row) => ({
    id: row.id as string,
    oggetto: (row.oggetto as string) ?? "",
    scadenza: (row.scadenza as string) ?? "",
    priorita: (row.priorita as string) ?? "Medio",
    assegnato: row.proprietario_id
      ? owners.get(row.proprietario_id as string) ?? "Non assegnato"
      : "Non assegnato",
    stato: (row.stato as StatoCompito) ?? "Non iniziato",
  }))
}

export type ScadenzaInput = {
  nome: string
  data_scadenza: string
  proprietario_id: string | null
  descrizione: string | null
  connesso_a_id: string | null
  connesso_a_tipo: "lead" | "cliente" | null
  tag: string | null
}

export async function createScadenzaRecord(
  input: ScadenzaInput,
): Promise<ScadenzaRecord> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("scadenze")
    .insert({
      nome: input.nome,
      data_scadenza: input.data_scadenza,
      proprietario_id: input.proprietario_id,
      descrizione: input.descrizione,
      connesso_a_id: input.connesso_a_id,
      connesso_a_tipo: input.connesso_a_tipo,
      tag: input.tag,
    })
    .select(SCADENZA_COLUMNS)
    .single()

  if (error) throw new Error(`createScadenzaRecord: ${error.message}`)
  const row = data as ScadenzaRow
  const owners = await ownerNames([row.proprietario_id])
  return withOwner(row, owners)
}

export async function updateScadenzaRecord(
  id: string,
  patch: Partial<ScadenzaInput>,
): Promise<ScadenzaRecord | null> {
  const supabase = await createClient()
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (patch.nome !== undefined) row.nome = patch.nome
  if (patch.data_scadenza !== undefined) row.data_scadenza = patch.data_scadenza
  if (patch.proprietario_id !== undefined) row.proprietario_id = patch.proprietario_id
  if (patch.descrizione !== undefined) row.descrizione = patch.descrizione
  if (patch.connesso_a_id !== undefined) row.connesso_a_id = patch.connesso_a_id
  if (patch.connesso_a_tipo !== undefined) row.connesso_a_tipo = patch.connesso_a_tipo
  if (patch.tag !== undefined) row.tag = patch.tag

  const { data, error } = await supabase
    .from("scadenze")
    .update(row)
    .eq("id", id)
    .select(SCADENZA_COLUMNS)
    .single()

  if (error || !data) return null
  const updatedRow = data as ScadenzaRow
  const owners = await ownerNames([updatedRow.proprietario_id])
  return withOwner(updatedRow, owners)
}

export async function deleteScadenzaRecord(id: string): Promise<boolean> {
  const supabase = await createClient()
  const { error, count } = await supabase
    .from("scadenze")
    .delete({ count: "exact" })
    .eq("id", id)
  if (error) throw new Error(`deleteScadenzaRecord: ${error.message}`)
  return (count ?? 0) > 0
}
