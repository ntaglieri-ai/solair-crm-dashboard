// Consensi al contatto: raccolti e salvati quando disponibili, ma non usati
// come precondizione per inviare email operative dal CRM.

import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/audit/log"
import { applyOwnerScope, resolveOwnerScope } from "@/lib/permissions/data-scope"
import type { PermissionSnapshot } from "@/lib/permissions/types"

/** Entita' su cui il consenso email e' verificabile. */
export type ConsentEntita = "lead" | "cliente"

type ConsentConfig = {
  table: string
  emailColumn: string
  /** Modulo audit corrispondente (vedi lib/audit/constants.ts). */
  modulo: "lead" | "cliente"
  etichettaSingolare: string
  etichettaPlurale: string
  resource: "lead" | "clienti"
  ownerColumn: string
}

const CONSENT_CONFIG: Record<ConsentEntita, ConsentConfig> = {
  lead: {
    table: "leads",
    emailColumn: "email",
    modulo: "lead",
    etichettaSingolare: "lead",
    etichettaPlurale: "lead",
    resource: "lead",
    ownerColumn: "lead_proprietario_id",
  },
  cliente: {
    table: "clienti",
    emailColumn: "email",
    modulo: "cliente",
    etichettaSingolare: "cliente",
    etichettaPlurale: "clienti",
    resource: "clienti",
    ownerColumn: "clienti_proprietario_id",
  },
}

/**
 * Nome della colonna di consenso. Identico sulle due tabelle, ma esposto come
 * costante perche' e' anche il pezzo che va aggiunto alle SELECT altrui (vedi
 * lib/email/bulk-targets.ts).
 */
export const EMAIL_CONSENT_COLUMN = "consenso_contatto_email"

/**
 * Il predicato, in un punto solo.
 *
 * `=== true` e non truthy: la colonna e' NOT NULL DEFAULT false, ma se un
 * giorno tornasse null da una proiezione parziale o da una tabella senza la
 * colonna, `undefined` deve valere "no" per la sola visualizzazione del dato.
 */
export function hasEmailConsent(row: Record<string, unknown>): boolean {
  return row[EMAIL_CONSENT_COLUMN] === true
}

/** Entita' note al modulo — le altre non hanno consenso da verificare. */
export function isConsentEntita(value: unknown): value is ConsentEntita {
  return value === "lead" || value === "cliente"
}

export type DestinatarioConsenziente = {
  id: string
  email: string
}

export type EsitoFiltroConsenso = {
  /**
   * Compatibilita' con le vecchie risposte API: il filtro consenso non blocca
   * piu' nessun invio.
   */
  enforcementAttivo: boolean
  /** A chi si scrive davvero: tutti quelli con un indirizzo valido. */
  destinatari: DestinatarioConsenziente[]
  /** Sempre vuoto: i consensi non producono esclusioni, warning o audit. */
  senzaConsenso: DestinatarioConsenziente[]
  /**
   * Id richiesti che non producono un destinatario per motivi diversi dal
   * consenso: nessuna email, oppure record non leggibile (cancellato o RLS).
   */
  esclusiSenzaEmail: number
}

/** I consensi non sono bloccanti. */
export function quantiBloccati(esito: EsitoFiltroConsenso): number {
  void esito
  return 0
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * Risolve gli id in destinatari. Il nome storico resta per compatibilita':
 * oggi non filtra piu' in base al consenso.
 */
export async function filtraDestinatariConsenzienti(params: {
  entita: ConsentEntita
  ids: string[]
  snapshot?: PermissionSnapshot
}): Promise<{ data: EsitoFiltroConsenso | null; error: string | null }> {
  const config = CONSENT_CONFIG[params.entita]
  const ids = [...new Set(params.ids)]

  if (ids.length === 0) {
    return {
      data: {
        enforcementAttivo: false,
        destinatari: [],
        senzaConsenso: [],
        esclusiSenzaEmail: 0,
      },
      error: null,
    }
  }

  const supabase = await createClient()
  const baseQuery = supabase
    .from(config.table)
    .select(`id,${config.emailColumn}`)
    .in("id", ids)
  const scopedQuery = params.snapshot
    ? applyOwnerScope(baseQuery, config.ownerColumn, await resolveOwnerScope(params.snapshot, config.resource))
    : baseQuery
  const { data, error } = await scopedQuery

  if (error) return { data: null, error: error.message }

  const destinatari: DestinatarioConsenziente[] = []
  let conEmail = 0

  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    const email = text(row[config.emailColumn])
    if (!email.includes("@")) continue
    conEmail++

    const destinatario = { id: String(row.id), email }
    destinatari.push(destinatario)
  }

  return {
    data: {
      enforcementAttivo: false,
      destinatari,
      senzaConsenso: [],
      esclusiSenzaEmail: ids.length - conEmail,
    },
    error: null,
  }
}

/**
 * Compatibilita' con il vecchio controllo pre-invio: oggi considera ammessi
 * tutti gli id ricevuti, senza query e senza fail-closed.
 */
export async function idsConConsensoEmail(params: {
  entita: ConsentEntita
  ids: string[]
}): Promise<{ consenzienti: Set<string> | null; error: string | null }> {
  void params.entita
  return { consenzienti: new Set([...new Set(params.ids)]), error: null }
}

/** Compatibilita': non registra piu' blocchi per consenso mancante. */
export async function logInvioBloccatoSenzaConsenso(params: {
  entita: ConsentEntita
  bloccati: DestinatarioConsenziente[]
  /** Quanti destinatari sono invece partiti (0 se l'invio e' stato annullato). */
  inviati: number
  oggetto: string
  attore?: { id: string | null; nome: string | null }
  request?: Request
}): Promise<void> {
  void params
}

/**
 * Messaggio d'errore quando NESSUN destinatario e' inviabile. Condiviso da
 * tutte le route perche' l'agente deve leggere sempre la stessa spiegazione,
 * qualunque pulsante abbia premuto.
 */
export function messaggioNessunConsenziente(params: {
  entita: ConsentEntita
  bloccatiSenzaConsenso: number
}): string {
  const config = CONSENT_CONFIG[params.entita]
  void params.bloccatiSenzaConsenso
  return `Nessuno dei ${config.etichettaPlurale} selezionati ha un indirizzo email valido.`
}

/** Compatibilita': non registra piu' invii in base allo stato del consenso. */
export async function logInvioSenzaEnforcement(params: {
  entita: ConsentEntita
  senzaConsenso: DestinatarioConsenziente[]
  /** Destinatari totali dell'invio, consenzienti inclusi. */
  destinatariTotali: number
  oggetto: string
  attore?: { id: string | null; nome: string | null }
  request?: Request
}): Promise<void> {
  void params
}

/**
 * Registra un cambio di stato dell'interruttore. Evento separato dagli invii:
 * deve essere ritrovabile anche quando fra l'accensione e il primo invio non
 * succede niente.
 */
export async function logCambioEnforcement(params: {
  precedente: boolean
  nuovo: boolean
  attore?: { id: string | null; nome: string | null }
  request?: Request
}): Promise<void> {
  await logAudit({
    tipo_evento: "operazione_admin",
    // Spegnere la tutela non e' un fallimento tecnico, ma non e' nemmeno un
    // "success" come gli altri: resta success perche' l'operazione e' riuscita,
    // ed e' la descrizione a portare il peso.
    esito: "success",
    modulo: "permessi",
    attore: params.attore,
    request: params.request,
    descrizione: "Interruttore storico consenso aggiornato: il consenso resta informativo e non blocca gli invii",
    dati_prima: { consenso_enforcement: params.precedente },
    dati_dopo: { consenso_enforcement: params.nuovo },
  })
}
