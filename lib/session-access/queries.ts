// Lettura dei dati di Session & Access.
//
// Client: service_role per entrambe le fonti, ma per due ragioni diverse.
//   - Sessioni: `auth.sessions` non e' raggiungibile da PostgREST, che espone
//     il solo schema `public`. Si passa dalle funzioni SECURITY DEFINER della
//     migration 20260823, il cui EXECUTE e' concesso alla sola service_role.
//   - IP bloccati: la tabella ha la sola policy `ip_bloccati_select`; per
//     inserire e cancellare non esiste policy, esattamente come su audit_log.
//
// Chi arriva fin qui ha gia' superato il gate `crm_settings.account.session`,
// applicato dal layout della sezione e ripetuto da ogni rotta API.
//
// Gli errori vengono restituiti, non inghiottiti: una lettura fallita deve
// arrivare in pagina come errore e non come "nessuna sessione attiva", che e'
// la stessa distinzione gia' applicata alla lista lead e all'audit log.

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  dispositivoDaUserAgent,
  origineDaUserAgent,
  type IpBloccato,
  type SessioneAttiva,
} from "./constants"

interface RigaSessione {
  session_id: string
  auth_user_id: string
  utente_id: string | null
  utente_nome: string | null
  utente_email: string | null
  utente_ruolo: string | null
  user_agent: string | null
  ip: string | null
  aal: string | null
  creata_il: string
  rinnovata_il: string | null
  scade_il: string | null
}

/**
 * Id della sessione di chi sta guardando la pagina, dal claim `session_id` del
 * JWT. Serve a due cose: segnare la propria riga in tabella e non chiudersi
 * fuori da soli con "Termina tutte le sessioni".
 */
export async function sessionIdCorrente(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getClaims()
    const sessionId = data?.claims?.session_id
    return typeof sessionId === "string" ? sessionId : null
  } catch {
    return null
  }
}

export async function loadSessioniAttive(): Promise<{
  sessioni: SessioneAttiva[]
  errore: string | null
}> {
  const admin = createAdminClient()
  if (!admin) {
    return { sessioni: [], errore: "SUPABASE_SERVICE_ROLE_KEY non configurata" }
  }

  const [{ data, error }, corrente] = await Promise.all([
    admin.rpc("crm_sessioni_attive"),
    sessionIdCorrente(),
  ])

  if (error) return { sessioni: [], errore: error.message }

  const righe = (data ?? []) as RigaSessione[]

  return {
    sessioni: righe.map((r) => ({
      sessionId: r.session_id,
      authUserId: r.auth_user_id,
      utenteId: r.utente_id,
      utenteNome: r.utente_nome,
      utenteEmail: r.utente_email,
      utenteRuolo: r.utente_ruolo,
      dispositivo: dispositivoDaUserAgent(r.user_agent),
      origine: origineDaUserAgent(r.user_agent),
      userAgent: r.user_agent,
      ip: r.ip,
      creataIl: r.creata_il,
      rinnovataIl: r.rinnovata_il,
      corrente: corrente !== null && corrente === r.session_id,
    })),
    errore: null,
  }
}

export async function loadIpBloccati(): Promise<{
  ipBloccati: IpBloccato[]
  errore: string | null
}> {
  const admin = createAdminClient()
  if (!admin) {
    return { ipBloccati: [], errore: "SUPABASE_SERVICE_ROLE_KEY non configurata" }
  }

  // `bloccato_da` e' una FK verso utenti: la join risolve il nome in una sola
  // andata. Resta null per i blocchi automatici, che non hanno un autore.
  const { data, error } = await admin
    .from("ip_bloccati")
    .select("id, ip_address, motivo, scadenza, created_at, utenti:bloccato_da (nome)")
    .order("created_at", { ascending: false })

  if (error) return { ipBloccati: [], errore: error.message }

  const adesso = Date.now()

  return {
    ipBloccati: (data ?? []).map((r) => {
      // PostgREST restituisce la relazione come oggetto o come array a seconda
      // di come deduce la cardinalita': si normalizzano entrambe le forme.
      const rel = r.utenti as { nome: string | null } | { nome: string | null }[] | null
      const autore = Array.isArray(rel) ? (rel[0] ?? null) : rel

      return {
        id: r.id as string,
        ipAddress: r.ip_address as string,
        motivo: r.motivo as string,
        bloccatoDaNome: autore?.nome ?? null,
        creatoIl: r.created_at as string,
        scadenza: (r.scadenza as string | null) ?? null,
        attivo: r.scadenza === null || new Date(r.scadenza as string).getTime() > adesso,
      }
    }),
    errore: null,
  }
}
