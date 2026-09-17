import "server-only"

import type { createAdminClient } from "@/lib/supabase/admin"

/**
 * Eliminazione di un account CRM, in due passaggi.
 *
 * Passaggio 1 (riassegnaEDisattiva): tutto cio' che l'utente POSSIEDE — lead,
 * clienti, compiti, scadenze, installatori, regole di assegnazione — passa a un
 * altro utente attivo, e l'account viene disattivato e marcato `eliminato_il`.
 * Lo storico (note, audit, documenti caricati, email inviate) non si tocca: e'
 * il racconto di cose realmente accadute, e resta attribuito a chi le ha fatte.
 *
 * Passaggio 2 (purgaUtente): cancellazione fisica della riga `utenti`, ammessa
 * solo dopo il passaggio 1 e solo se l'utente non possiede piu' nulla. Qui i
 * riferimenti storici vengono sganciati (le note diventano "Sistema") e le
 * credenziali personali eliminate.
 *
 * La logica vera sta in tre funzioni SQL (migration
 * 20260916_utenti_eliminazione_due_step.sql) perche' la riassegnazione tocca sei
 * tabelle: farla in TS significherebbe sei round trip non transazionali, e un
 * errore a meta' lascerebbe i record dell'agente divisi fra due proprietari.
 */

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

export type ConteggiProprieta = {
  leads: number
  clienti: number
  compiti: number
  scadenze: number
  installatori: number
  regole_assegnazione: number
}

export type ConteggiStorico = {
  note: number
  audit: number
  documenti: number
  email_inviate: number
  eventi_calendario: number
  caselle_personali: number
  caselle_condivise: number
  token_mcp: number
}

export type ConteggiUtente = {
  proprieta: ConteggiProprieta
  storico: ConteggiStorico
}

export type EsitoRiassegnazione = {
  utente: { id: string; nome: string | null; email: string | null }
  destinatario: { id: string; nome: string | null; email: string | null }
  spostati: ConteggiProprieta
}

export type EsitoPurga = {
  utente: { id: string; nome: string | null; email: string | null; auth_user_id: string | null }
  sganciati: { note: number; documenti: number; caselle_condivise: number; log_mcp: number }
  eliminati: {
    caselle_personali: number
    token_mcp: number
    codici_oauth_mcp: number
    eventi_calendario: number
  }
}

const CONTEGGI_VUOTI: ConteggiUtente = {
  proprieta: {
    leads: 0,
    clienti: 0,
    compiti: 0,
    scadenze: 0,
    installatori: 0,
    regole_assegnazione: 0,
  },
  storico: {
    note: 0,
    audit: 0,
    documenti: 0,
    email_inviate: 0,
    eventi_calendario: 0,
    caselle_personali: 0,
    caselle_condivise: 0,
    token_mcp: 0,
  },
}

function numeri<T extends Record<string, number>>(base: T, grezzo: unknown): T {
  const fonte = (grezzo ?? {}) as Record<string, unknown>
  const risultato = { ...base }
  for (const chiave of Object.keys(base) as (keyof T)[]) {
    const valore = Number(fonte[chiave as string])
    if (Number.isFinite(valore)) risultato[chiave] = valore as T[keyof T]
  }
  return risultato
}

export function totaleProprieta(conteggi: ConteggiProprieta): number {
  return Object.values(conteggi).reduce((somma, valore) => somma + valore, 0)
}

export async function conteggiUtente(
  admin: AdminClient,
  utenteId: string,
): Promise<{ conteggi: ConteggiUtente; error: string | null }> {
  const { data, error } = await admin.rpc("crm_utente_conteggi", { p_utente: utenteId })
  if (error) {
    console.error(`[utenti] conteggi per ${utenteId} falliti:`, error)
    return { conteggi: CONTEGGI_VUOTI, error: messaggioErrore(error) }
  }
  const grezzo = (data ?? {}) as Record<string, unknown>
  return {
    conteggi: {
      proprieta: numeri(CONTEGGI_VUOTI.proprieta, grezzo.proprieta),
      storico: numeri(CONTEGGI_VUOTI.storico, grezzo.storico),
    },
    error: null,
  }
}

export async function riassegnaEDisattiva(
  admin: AdminClient,
  utenteId: string,
  destinatarioId: string,
): Promise<{ esito: EsitoRiassegnazione | null; error: string | null }> {
  const { data, error } = await admin.rpc("crm_riassegna_e_disattiva_utente", {
    p_da: utenteId,
    p_a: destinatarioId,
  })
  if (error) {
    console.error(`[utenti] riassegnazione ${utenteId} -> ${destinatarioId} fallita:`, error)
    return { esito: null, error: messaggioErrore(error) }
  }
  const grezzo = (data ?? {}) as Record<string, unknown>
  return {
    esito: {
      utente: (grezzo.utente ?? {}) as EsitoRiassegnazione["utente"],
      destinatario: (grezzo.destinatario ?? {}) as EsitoRiassegnazione["destinatario"],
      spostati: numeri(CONTEGGI_VUOTI.proprieta, grezzo.spostati),
    },
    error: null,
  }
}

export async function purgaUtente(
  admin: AdminClient,
  utenteId: string,
): Promise<{ esito: EsitoPurga | null; error: string | null }> {
  const { data, error } = await admin.rpc("crm_purga_utente", { p_utente: utenteId })
  if (error) {
    console.error(`[utenti] cancellazione definitiva di ${utenteId} fallita:`, error)
    return { esito: null, error: messaggioErrore(error) }
  }
  const grezzo = (data ?? {}) as Record<string, unknown>
  return {
    esito: {
      utente: (grezzo.utente ?? {}) as EsitoPurga["utente"],
      sganciati: numeri(
        { note: 0, documenti: 0, caselle_condivise: 0, log_mcp: 0 },
        grezzo.sganciati,
      ),
      eliminati: numeri(
        { caselle_personali: 0, token_mcp: 0, codici_oauth_mcp: 0, eventi_calendario: 0 },
        grezzo.eliminati,
      ),
    },
    error: null,
  }
}

/**
 * Le funzioni SQL alzano eccezioni con messaggi gia' scritti per la UI (in
 * italiano, con il dettaglio di cosa manca). Questo wrapper li fa passare, e
 * tiene una rete di sicurezza per i due casi che il database puo' produrre da
 * solo: funzione non ancora installata e FK residua imprevista.
 */
function messaggioErrore(error: { code?: string | null; message: string; hint?: string | null }): string {
  const message = error.message ?? ""

  if (error.code === "PGRST202" || message.includes("Could not find the function")) {
    return "Migration non applicata: esegui 20260916_utenti_eliminazione_due_step.sql su Supabase."
  }
  if (error.code === "23503") {
    return message.startsWith("L'utente possiede")
      ? message
      : `Restano riferimenti all'utente che impediscono la cancellazione: ${message}`
  }
  return message || "Operazione sull'account non riuscita."
}
