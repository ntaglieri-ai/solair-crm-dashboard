import { createClient } from "@/lib/supabase/server"
import { normalizeCanalePreferito } from "@/lib/installatori/api-types"
import type {
  CanalePreferito,
  InstallatoriListParams,
  InstallatoriListResponse,
  InstallatoreSortKey,
} from "@/lib/installatori/api-types"
import { applyOwnerScope, filterCurrentAccessibleRecordIds, resolveCurrentOwnerScope } from "@/lib/permissions/data-scope"

export type InstallatoreRecord = {
  id: string
  nome: string
  email: string | null
  email_secondaria: string | null
  telefono: string | null
  tag: string | null
  attivo: boolean
  /** Canale di inoltro scheda sopralluogo (spec 3.4). */
  canale_preferito: CanalePreferito
  proprietario_id: string | null
  proprietario_nome: string | null
  note: string | null
  created_at: string | null
  updated_at: string | null
  /** Id dei tag reali assegnati (installatore_tags), popolato dal server. */
  tagIds?: string[]
}

type InstallatoreRow = Omit<
  InstallatoreRecord,
  "proprietario_nome" | "attivo" | "canale_preferito"
> & {
  attivo: boolean | null
  // A DB e' text: la check constraint garantisce i due valori validi solo sulle
  // righe scritte dopo la migration, quindi si normalizza in lettura.
  canale_preferito: string | null
}

const INSTALLATORE_COLUMNS =
  "id,nome,email,email_secondaria,telefono,tag,attivo,canale_preferito,proprietario_id,note,created_at,updated_at"

const SORT_COLUMN: Record<InstallatoreSortKey, string> = {
  nome: "nome",
  email: "email",
  updated_at: "updated_at",
}

async function mapOwner(row: InstallatoreRow): Promise<InstallatoreRecord> {
  const supabase = await createClient()
  let ownerName: string | null = null

  if (row.proprietario_id) {
    const { data, error } = await supabase
      .from("utenti")
      .select("nome")
      .eq("id", row.proprietario_id)
      .maybeSingle()
    if (error) throw new Error(`Lettura proprietario installatore: ${error.message}`)
    ownerName = data?.nome ?? null
  }

  return {
    ...row,
    attivo: row.attivo !== false,
    canale_preferito: normalizeCanalePreferito(row.canale_preferito),
    proprietario_nome: ownerName,
  }
}

export async function getInstallatori(): Promise<InstallatoreRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("installatori")
    .select(INSTALLATORE_COLUMNS)
    .order("nome", { ascending: true })

  if (error) throw new Error(`Lettura installatori: ${error.message}`)
  const rows = (data ?? []) as InstallatoreRow[]
  const ownerIds = [
    ...new Set(
      rows
        .map((row) => row.proprietario_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const ownerNames = new Map<string, string>()

  if (ownerIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from("utenti")
      .select("id, nome")
      .in("id", ownerIds)
    if (usersError) {
      throw new Error(`Lettura proprietari installatori: ${usersError.message}`)
    }
    for (const user of users ?? []) ownerNames.set(user.id, user.nome)
  }

  return rows.map((row) => ({
    ...row,
    attivo: row.attivo !== false,
    canale_preferito: normalizeCanalePreferito(row.canale_preferito),
    proprietario_nome: row.proprietario_id
      ? ownerNames.get(row.proprietario_id) ?? null
      : null,
  }))
}

export async function queryInstallatori(
  params: InstallatoriListParams,
): Promise<InstallatoriListResponse> {
  const supabase = await createClient()
  const ownerScope = await resolveCurrentOwnerScope("installatori")
  const sortCol = (params.sortBy && SORT_COLUMN[params.sortBy]) || "nome"
  const ascending = params.sortDir === "asc"
  const from = (params.page - 1) * params.pageSize
  const to = from + params.pageSize - 1

  let listQ = supabase
    .from("installatori")
    .select(INSTALLATORE_COLUMNS)
    .order(sortCol, { ascending, nullsFirst: false })
    .range(from, to)
  let countQ = supabase
    .from("installatori")
    .select("id", { count: "exact", head: true })
  listQ = applyOwnerScope(listQ, "proprietario_id", ownerScope)
  countQ = applyOwnerScope(countQ, "proprietario_id", ownerScope)
  const absoluteQ = applyOwnerScope(supabase.from("installatori").select("id", { count: "exact", head: true }), "proprietario_id", ownerScope)
  const activeQ = applyOwnerScope(supabase.from("installatori").select("id", { count: "exact", head: true }).eq("attivo", true), "proprietario_id", ownerScope)
  const inactiveQ = applyOwnerScope(supabase.from("installatori").select("id", { count: "exact", head: true }).eq("attivo", false), "proprietario_id", ownerScope)

  if (params.search.trim()) {
    const p = `%${params.search.trim()}%`
    const f = `nome.ilike.${p},email.ilike.${p}`
    listQ = listQ.or(f)
    countQ = countQ.or(f)
  }
  if (params.proprietario !== "all") {
    listQ = listQ.eq("proprietario_id", params.proprietario)
    countQ = countQ.eq("proprietario_id", params.proprietario)
  }
  if (params.tag !== "all") {
    // Filtro relazionale (tabella installatore_tags), non piu' sul vecchio
    // campo singolo di testo libero installatori.tag — trovato ridondante
    // e sostituito il 26/07 dal vero sistema multi-tag.
    const { data: tagRows } = await supabase
      .from("installatore_tags")
      .select("installatore_id")
      .eq("tag_id", params.tag)
    const idsWithTag = (tagRows ?? []).map((r) => r.installatore_id as string)
    listQ = listQ.in("id", idsWithTag.length > 0 ? idsWithTag : ["00000000-0000-0000-0000-000000000000"])
    countQ = countQ.in("id", idsWithTag.length > 0 ? idsWithTag : ["00000000-0000-0000-0000-000000000000"])
  }
  if (params.stato !== "all") {
    listQ = listQ.eq("attivo", params.stato === "attivo")
    countQ = countQ.eq("attivo", params.stato === "attivo")
  }

  const [
    { data, error },
    { count, error: countError },
    { count: absoluteTotal, error: absoluteTotalError },
    { count: attiviTotal, error: attiviTotalError },
    { count: nonAttiviTotal, error: nonAttiviTotalError },
  ] = await Promise.all([
    listQ,
    countQ,
    absoluteQ,
    activeQ,
    inactiveQ,
  ])

  if (error) console.error("[installatori/repository] queryInstallatori:", error.message)
  if (countError) console.error("[installatori/repository] count:", countError.message)
  if (absoluteTotalError)
    console.error("[installatori/repository] absoluteTotal:", absoluteTotalError.message)
  if (attiviTotalError)
    console.error("[installatori/repository] attiviTotal:", attiviTotalError.message)
  if (nonAttiviTotalError)
    console.error("[installatori/repository] nonAttiviTotal:", nonAttiviTotalError.message)

  const rows = (data ?? []) as InstallatoreRow[]
  const ownerIds = [
    ...new Set(
      rows.map((row) => row.proprietario_id).filter((id): id is string => Boolean(id)),
    ),
  ]
  const ownerNames = new Map<string, string>()
  if (ownerIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from("utenti")
      .select("id, nome")
      .in("id", ownerIds)
    if (usersError) {
      throw new Error(`Lettura proprietari installatori: ${usersError.message}`)
    }
    for (const user of users ?? []) ownerNames.set(user.id, user.nome)
  }

  const pageIds = rows.map((row) => row.id)
  const tagAssignments = await supabase
    .from("installatore_tags")
    .select("installatore_id,tag_id")
    .in("installatore_id", pageIds)
  if (tagAssignments.error) {
    console.error("[installatori/repository] installatore_tags:", tagAssignments.error.message)
  }

  return {
    rows: rows.map((row) => ({
      ...row,
      attivo: row.attivo !== false,
      canale_preferito: normalizeCanalePreferito(row.canale_preferito),
      proprietario_nome: row.proprietario_id
        ? ownerNames.get(row.proprietario_id) ?? null
        : null,
      tagIds: (tagAssignments.data ?? [])
        .filter((item) => item.installatore_id === row.id)
        .map((item) => item.tag_id),
    })),
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
    absoluteTotal: absoluteTotal ?? 0,
    attiviTotal: attiviTotal ?? 0,
    nonAttiviTotal: nonAttiviTotal ?? 0,
  }
}

export async function getInstallatoreById(
  id: string,
): Promise<InstallatoreRecord | null> {
  const supabase = await createClient()
  const ownerScope = await resolveCurrentOwnerScope("installatori")
  const { data, error } = await applyOwnerScope(supabase
    .from("installatori")
    .select(INSTALLATORE_COLUMNS)
    .eq("id", id), "proprietario_id", ownerScope).maybeSingle()

  if (error) throw new Error(`Lettura installatore: ${error.message}`)
  return data ? mapOwner(data as InstallatoreRow) : null
}

export type InstallatoreInput = {
  nome: string
  email: string | null
  email_secondaria: string | null
  telefono: string | null
  tag: string | null
  attivo: boolean
  canale_preferito: CanalePreferito
  proprietario_id: string | null
  note: string | null
}

export async function createInstallatoreRecord(
  input: InstallatoreInput,
): Promise<InstallatoreRecord> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("installatori")
    .insert({
      nome: input.nome,
      email: input.email,
      email_secondaria: input.email_secondaria,
      telefono: input.telefono,
      tag: input.tag,
      attivo: input.attivo,
      canale_preferito: input.canale_preferito,
      proprietario_id: input.proprietario_id,
      note: input.note,
    })
    .select(INSTALLATORE_COLUMNS)
    .single()

  if (error) throw new Error(`createInstallatoreRecord: ${error.message}`)
  return mapOwner(data as InstallatoreRow)
}

export async function updateInstallatoreRecord(
  id: string,
  patch: Partial<InstallatoreInput>,
): Promise<InstallatoreRecord | null> {
  const allowed = await filterCurrentAccessibleRecordIds("installatori", "installatori", "proprietario_id", [id])
  if (allowed.length === 0) return null
  const supabase = await createClient()
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (patch.nome !== undefined) row.nome = patch.nome
  if (patch.email !== undefined) row.email = patch.email
  if (patch.email_secondaria !== undefined) row.email_secondaria = patch.email_secondaria
  if (patch.telefono !== undefined) row.telefono = patch.telefono
  if (patch.tag !== undefined) row.tag = patch.tag
  if (patch.attivo !== undefined) row.attivo = patch.attivo
  if (patch.canale_preferito !== undefined) {
    row.canale_preferito = normalizeCanalePreferito(patch.canale_preferito)
  }
  if (patch.proprietario_id !== undefined) row.proprietario_id = patch.proprietario_id
  if (patch.note !== undefined) row.note = patch.note

  const { data, error } = await supabase
    .from("installatori")
    .update(row)
    .eq("id", id)
    .select(INSTALLATORE_COLUMNS)
    .single()

  if (error || !data) return null
  return mapOwner(data as InstallatoreRow)
}

export async function deleteInstallatoreRecord(id: string): Promise<boolean> {
  const allowed = await filterCurrentAccessibleRecordIds("installatori", "installatori", "proprietario_id", [id])
  if (allowed.length === 0) return false
  const supabase = await createClient()
  const { error, count } = await supabase
    .from("installatori")
    .delete({ count: "exact" })
    .eq("id", id)
  if (error) throw new Error(`deleteInstallatoreRecord: ${error.message}`)
  return (count ?? 0) > 0
}

export async function getDistinctInstallatoreTags(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("installatori")
    .select("tag")
    .not("tag", "is", null)
  if (error) throw new Error(`Lettura tag installatori: ${error.message}`)
  return [...new Set((data ?? []).map((row) => row.tag as string))].sort()
}
