import { createClient } from "@/lib/supabase/server"
import type {
  InstallatoriListParams,
  InstallatoriListResponse,
  InstallatoreSortKey,
} from "@/lib/installatori/api-types"

export type InstallatoreRecord = {
  id: string
  nome: string
  email: string | null
  email_secondaria: string | null
  telefono: string | null
  tag: string | null
  attivo: boolean
  proprietario_id: string | null
  proprietario_nome: string | null
  note: string | null
  created_at: string | null
  updated_at: string | null
}

type InstallatoreRow = Omit<InstallatoreRecord, "proprietario_nome" | "attivo"> & {
  attivo: boolean | null
}

const INSTALLATORE_COLUMNS =
  "id,nome,email,email_secondaria,telefono,tag,attivo,proprietario_id,note,created_at,updated_at"

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
    proprietario_nome: row.proprietario_id
      ? ownerNames.get(row.proprietario_id) ?? null
      : null,
  }))
}

export async function queryInstallatori(
  params: InstallatoriListParams,
): Promise<InstallatoriListResponse> {
  const supabase = await createClient()
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
    listQ = listQ.eq("tag", params.tag)
    countQ = countQ.eq("tag", params.tag)
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
    supabase.from("installatori").select("id", { count: "exact", head: true }),
    supabase
      .from("installatori")
      .select("id", { count: "exact", head: true })
      .eq("attivo", true),
    supabase
      .from("installatori")
      .select("id", { count: "exact", head: true })
      .eq("attivo", false),
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

  return {
    rows: rows.map((row) => ({
      ...row,
      attivo: row.attivo !== false,
      proprietario_nome: row.proprietario_id
        ? ownerNames.get(row.proprietario_id) ?? null
        : null,
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
  const { data, error } = await supabase
    .from("installatori")
    .select(INSTALLATORE_COLUMNS)
    .eq("id", id)
    .maybeSingle()

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
