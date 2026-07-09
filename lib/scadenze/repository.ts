import { createClient } from "@/lib/supabase/server"
import type { ClienteCompito, StatoCompito } from "@/lib/mock-data"

export type ScadenzaRecord = {
  id: string
  nome: string
  data_scadenza: string
  proprietario_id: string | null
  proprietario_nome: string | null
  descrizione: string | null
  connesso_a_id: string | null
  connesso_a_tipo: "lead" | "cliente" | null
  created_at: string | null
  updated_at: string | null
}

type ScadenzaRow = Omit<ScadenzaRecord, "proprietario_nome">

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

function withOwner(
  row: ScadenzaRow,
  owners: Map<string, string>,
): ScadenzaRecord {
  return {
    ...row,
    proprietario_nome: row.proprietario_id
      ? owners.get(row.proprietario_id) ?? null
      : null,
  }
}

const SCADENZA_COLUMNS =
  "id,nome,data_scadenza,proprietario_id,descrizione,connesso_a_id,connesso_a_tipo,created_at,updated_at"

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
