import "server-only"

import { identitaMcpDalContesto } from "@/lib/mcp/context"

/**
 * L'id in `utenti` della persona che sta usando il server MCP.
 *
 * Serve alle scritture che portano una firma — note della timeline, link
 * esterni — perche' la RLS accetta solo `utente_id`/`creato_da` nullo oppure
 * uguale a current_utente_id(): una nota senza autore passerebbe, ma
 * comparirebbe nel CRM come "Sistema" invece che come chi l'ha davvero scritta.
 *
 * Fino al 25/08/2026 questo valore era una costante, risolta una volta per
 * istanza a partire da VITO_USER_ID e tenuta in cache. Con piu' utenti quella
 * cache diventerebbe il modo piu' rapido per firmare le note di uno col nome
 * di un altro: ora l'id arriva dal contesto della singola richiesta, dove
 * l'ha messo la verifica del token, e non esiste piu' un "utente corrente"
 * globale da sbagliare.
 */
export async function utenteCorrenteId(): Promise<string> {
  const identita = identitaMcpDalContesto()
  if (!identita) {
    throw new Error("Contesto MCP non attivo: nessuna identita' utente disponibile")
  }
  return identita.utenteId
}
