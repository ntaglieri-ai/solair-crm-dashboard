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

/**
 * Traduce gli errori del driver Postgres/Supabase sulla tabella `utenti` in
 * messaggi chiari in italiano per la UI. L'errore tecnico originale va comunque
 * loggato server-side dal chiamante: qui cambia solo il testo mostrato all'utente.
 *
 * Accetta l'intero oggetto errore (PostgrestError-like) per poter distinguere
 * per `code` — es. 23505 (unique_violation) — e per nome del constraint, cosi'
 * da non tradurre per sbaglio violazioni unique non correlate.
 */
export function accountUserErrorMessage(error: {
  code?: string | null
  message: string
  details?: string | null
}): string {
  const message = error.message ?? ""
  const details = error.details ?? ""
  const haystack = `${message} ${details}`

  // Email duplicata: unique_violation sul constraint utenti_email_key.
  if (
    (error.code === "23505" || message.includes("duplicate key value")) &&
    haystack.includes("utenti_email_key")
  ) {
    return "Esiste già un utente con questa email."
  }

  // Schema ruoli non allineato: check constraint sul ruolo.
  if (
    haystack.includes("utenti_ruolo_check") ||
    (haystack.includes("check constraint") && haystack.includes("utenti"))
  ) {
    return "Schema ruoli non aggiornato. Esegui la migrazione utenti_ruolo_check su Supabase."
  }

  return message
}
