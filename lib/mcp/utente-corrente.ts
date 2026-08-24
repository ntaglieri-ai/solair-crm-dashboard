import "server-only"

import { clientMcpObbligatorio } from "@/lib/mcp/context"

/**
 * L'id in `utenti` della persona che il server MCP impersona.
 *
 * Serve alle scritture che portano una firma — note della timeline, link
 * esterni — perche' la RLS accetta solo `utente_id`/`creato_da` nullo oppure
 * uguale a current_utente_id(): una nota senza autore passerebbe, ma
 * comparirebbe nel CRM come "Sistema" invece che come chi l'ha davvero scritta.
 *
 * VITO_USER_ID e' l'id in auth.users; qui serve quello della riga in `utenti`,
 * che e' un'altra cosa. La corrispondenza non cambia mai, quindi si risolve
 * una volta per istanza.
 */

let cache: string | null = null

export async function utenteCorrenteId(): Promise<string> {
  if (cache) return cache

  const authUserId = process.env.VITO_USER_ID
  if (!authUserId) throw new Error("Variabile d'ambiente VITO_USER_ID non configurata")

  const supabase = clientMcpObbligatorio()
  const { data, error } = await supabase
    .from("utenti")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle()

  if (error) throw new Error(`Utente MCP non risolto: ${error.message}`)
  if (!data) throw new Error(`Nessuna riga in utenti con auth_user_id ${authUserId}`)

  cache = (data as { id: string }).id
  return cache
}
