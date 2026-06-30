import type { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type ResolvedRole = {
  id: string
  code: string
  nome: string
}

export async function resolveRole(
  supabase: SupabaseClient,
  code: string,
): Promise<ResolvedRole | null> {
  const normalizedCode = code.trim()
  if (!normalizedCode) return null

  const { data, error } = await supabase
    .from("ruoli")
    .select("id, code, nome")
    .ilike("code", normalizedCode)
    .maybeSingle()

  if (error) throw error
  return data as ResolvedRole | null
}

export function accountRoleErrorMessage(message: string) {
  if (
    message.includes("utenti_ruolo_check") ||
    (message.includes("check constraint") && message.includes("utenti"))
  ) {
    return "Schema ruoli non aggiornato. Esegui la migrazione utenti_ruolo_check su Supabase."
  }

  return message
}
