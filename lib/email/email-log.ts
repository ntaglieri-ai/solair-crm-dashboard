// Storico degli invii email riusciti (tabella crm_email_log).
//
// Una riga per destinatario, scritta solo dopo che l'invio e' andato a buon
// fine: lo storico deve dire cosa e' partito davvero, non cosa e' stato
// tentato. I fallimenti restano nei log server e nei contatori di
// email_massa_jobs.
//
// Non c'e' e non deve esserci nulla sulle aperture: non esiste un meccanismo
// che le rilevi (niente pixel, niente webhook SES), quindi qualsiasi colonna
// del genere sarebbe un numero finto — che e' esattamente cio' che questa
// tabella e' venuta a togliere dalla scheda del lead.
//
// Regola ereditata da lib/audit/log.ts: registrare non puo' far fallire
// l'operazione registrata. Ogni errore qui finisce su console e basta — si
// perde una riga di storico, non l'email che e' gia' partita.

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type EmailLogEntita = "lead" | "cliente"

export type EmailLogEntry = {
  id: string
  destinatario: string
  fromEmail: string
  fromNome: string | null
  oggetto: string
  dataInvio: string
  inviataDaNome: string | null
}

type EmailLogRow = {
  id: string
  destinatario: string
  from_email: string
  from_nome: string | null
  oggetto: string
  data_invio: string
  utenti: { nome: string | null } | { nome: string | null }[] | null
}

const LOG_COLUMNS =
  "id, destinatario, from_email, from_nome, oggetto, data_invio, utenti:inviata_da (nome)"

function toEntry(row: EmailLogRow): EmailLogEntry {
  // La join annidata di PostgREST torna oggetto o array secondo la cardinalita'
  // dedotta dallo schema: si normalizzano entrambe le forme.
  const raw = row.utenti
  const utente = Array.isArray(raw) ? raw[0] : raw

  return {
    id: row.id,
    destinatario: row.destinatario,
    fromEmail: row.from_email,
    fromNome: row.from_nome,
    oggetto: row.oggetto,
    dataInvio: row.data_invio,
    inviataDaNome: utente?.nome ?? null,
  }
}

/**
 * Registra un invio riuscito per ciascun destinatario.
 *
 * `destinatari` porta gli id dei record, non solo gli indirizzi: e' cio' che
 * lega la riga alla scheda giusta. I chiamanti li hanno gia' — il filtro di
 * consenso restituisce `{ id, email }` e i destinatari di massa pure.
 */
export async function logEmailInviate(params: {
  entita: EmailLogEntita
  destinatari: Array<{ id: string; email: string }>
  fromEmail: string
  fromNome?: string | null
  oggetto: string
  inviataDa: string | null
}): Promise<void> {
  if (params.destinatari.length === 0) return

  try {
    const admin = createAdminClient()
    if (!admin) {
      console.error("[email-log] SUPABASE_SERVICE_ROLE_KEY non configurata: invii non registrati")
      return
    }

    const colonnaRecord = params.entita === "lead" ? "lead_id" : "cliente_id"

    const { error } = await admin.from("crm_email_log").insert(
      params.destinatari.map((destinatario) => ({
        [colonnaRecord]: destinatario.id,
        destinatario: destinatario.email,
        from_email: params.fromEmail,
        from_nome: params.fromNome ?? null,
        oggetto: params.oggetto,
        inviata_da: params.inviataDa,
      })),
    )

    if (error) console.error("[email-log] registrazione invii fallita:", error.message)
  } catch (error) {
    console.error(
      "[email-log] registrazione invii fallita:",
      error instanceof Error ? error.message : error,
    )
  }
}

/**
 * Storico di un record, dal piu' recente. Passa dal client dell'utente e non
 * dal service_role: la policy di SELECT eredita lo scoping di leads/clienti,
 * quindi chi non vede il record non ne vede nemmeno lo storico.
 */
export async function listEmailLog(
  entita: EmailLogEntita,
  recordId: string,
): Promise<EmailLogEntry[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("crm_email_log")
    .select(LOG_COLUMNS)
    .eq(entita === "lead" ? "lead_id" : "cliente_id", recordId)
    .order("data_invio", { ascending: false })

  if (error) {
    // Tabella non ancora creata (migration non applicata): storico vuoto, non
    // una pagina rotta.
    console.error("[email-log] lettura storico fallita:", error.message)
    return []
  }

  return ((data ?? []) as EmailLogRow[]).map(toEntry)
}
