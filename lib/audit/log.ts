// Writer dell'audit log.
//
// Perche' service_role e non il client con la sessione dell'utente: su
// public.audit_log esiste UNA sola policy, `audit_log_select` (SELECT per
// chiunque sia autenticato). Non c'e' nessuna policy di INSERT, quindi con RLS
// attiva una scrittura fatta col client dell'utente verrebbe rifiutata sempre.
// Ci sono anche due ragioni di merito:
//   - i login falliti non hanno alcuna sessione da cui scrivere;
//   - un registro che l'utente puo' non scrivere non e' un registro. La riga
//     non deve dipendere dai permessi di chi la genera.
//
// Regola non negoziabile: loggare non puo' far fallire l'operazione loggata.
// Ogni errore qui viene catturato e riportato solo su console — se l'audit e'
// rotto si perde una riga di storico, non l'aggiornamento del lead.

import { createAdminClient } from "@/lib/supabase/admin"
import { loadCurrentPermissionSnapshot } from "@/lib/permissions/load-permissions"
import type { PermissionEngine } from "@/lib/permissions/types"
import type { AuditEsito, AuditEventType, AuditModulo } from "./constants"

/**
 * IP del chiamante. Su Vercel il primo elemento di x-forwarded-for e' il client
 * reale; gli altri sono i proxy attraversati. `null` quando non ricavabile:
 * meglio una colonna vuota che la stringa "unknown" scambiata per un indirizzo.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return request.headers.get("x-real-ip")?.trim() || null
}

export interface AuditEntry {
  tipo_evento: AuditEventType
  descrizione: string
  esito?: AuditEsito
  modulo?: AuditModulo
  record_id?: string | null
  dati_prima?: unknown
  dati_dopo?: unknown
  /** Request da cui leggere l'IP. Omessa per gli eventi non originati da HTTP. */
  request?: Request
  /**
   * Identita' da attribuire all'evento. Se omessa viene risolta dalla sessione
   * corrente. Va passata esplicitamente solo quando una sessione non c'e'
   * (login fallito) o non e' quella del soggetto dell'evento.
   */
  attore?: { id: string | null; nome: string | null }
}

/**
 * Registra un evento. Non attende conferma dal database e non solleva mai:
 * chiamala senza await quando il tempo di risposta conta.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminClient()
    if (!admin) {
      console.error("[audit] SUPABASE_SERVICE_ROLE_KEY non configurata: evento non registrato")
      return
    }

    const attore = entry.attore ?? (await currentAttore())

    const { error } = await admin.from("audit_log").insert({
      utente_id: attore.id,
      utente_nome: attore.nome,
      tipo_evento: entry.tipo_evento,
      modulo: entry.modulo ?? null,
      record_id: entry.record_id ?? null,
      descrizione: entry.descrizione,
      dati_prima: entry.dati_prima ?? null,
      dati_dopo: entry.dati_dopo ?? null,
      ip_address: entry.request ? clientIp(entry.request) : null,
      // user_agent resta deliberatamente vuoto: per il registro basta l'IP.
      esito: entry.esito ?? "success",
    })

    if (error) console.error("[audit] insert fallita:", error.message)
  } catch (err) {
    console.error("[audit] errore inatteso:", err)
  }
}

/**
 * Attore ricavato dal risultato di requireApiRecord/requireApiAction.
 *
 * Da preferire sempre nei route handler: la sessione e' gia' stata risolta dal
 * guard, quindi non costa nulla, e soprattutto viene letta DENTRO la richiesta.
 * Le scritture partono da after(), che gira dopo la risposta: risolvere li'
 * l'identita' significa dipendere da uno stato di richiesta in smontaggio, e un
 * fallimento non darebbe un errore ma un registro pieno di "sconosciuto" —
 * cioe' un audit che perde in silenzio la sola informazione per cui esiste.
 */
export function attoreDaPermessi(
  permissions: PermissionEngine,
): { id: string | null; nome: string | null } {
  return {
    id: permissions.snapshot.subject.userId,
    nome: permissions.snapshot.subject.nome || null,
  }
}

/**
 * Attore ricavato dalla sessione. `utente_nome` viene salvato come istantanea
 * perche' la FK e' ON DELETE SET NULL: cancellato l'utente resta comunque
 * scritto chi aveva agito.
 */
async function currentAttore(): Promise<{ id: string | null; nome: string | null }> {
  try {
    const snapshot = await loadCurrentPermissionSnapshot()
    return {
      id: snapshot.subject.userId,
      nome: snapshot.subject.nome || null,
    }
  } catch {
    return { id: null, nome: null }
  }
}
