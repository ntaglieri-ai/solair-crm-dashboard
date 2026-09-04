import type { SupabaseClient } from "@supabase/supabase-js"

/** Resolve UUID to the canonical name on the server, never trust the client label. */
export async function resolveInstallerAssignment(supabase: Pick<SupabaseClient, "from">, id: unknown) {
  if (id === null || id === "") return { installatore_id: null, installatore: null }
  if (typeof id !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Installatore non valido")
  }
  const { data, error } = await supabase.from("installatori").select("id,nome,attivo").eq("id", id).single()
  if (error || !data || data.attivo === false) throw new Error("Installatore non disponibile")
  return { installatore_id: data.id, installatore: data.nome }
}
