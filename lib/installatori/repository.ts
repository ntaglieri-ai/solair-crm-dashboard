import { createClient } from "@/lib/supabase/server"

export type InstallatoreRecord = {
  id: string
  nome: string
  email: string | null
  email_secondaria: string | null
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
  "id,nome,email,email_secondaria,attivo,proprietario_id,note,created_at,updated_at"

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
