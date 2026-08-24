// Consenso al contatto via email: la regola sta qui e SOLO qui.
//
// Nessuna email verso un contatto (lead o cliente) puo' partire senza che il
// suo `consenso_contatto_email` valga true. Il controllo e' server-side per
// scelta: la UI puo' nascondere il pulsante, ma non e' una garanzia — le route
// /api/leads/send-email, /api/clienti/send-email e /api/email-massa sono
// raggiungibili direttamente da qualunque sessione autenticata.
//
// Perche' un modulo condiviso e non un check per route: l'invio singolo,
// l'invio ai lead filtrati, l'anteprima di massa e l'invio di massa devono
// dare lo STESSO verdetto. Se l'anteprima dicesse 40 destinatari e l'invio ne
// escludesse 12, l'agente scoprirebbe il blocco dopo aver premuto invia.
//
// Fuori ambito, deliberatamente:
//   - installatori: nessuna colonna di consenso. Sono controparti B2B e le
//     email che ricevono (scheda sopralluogo, lib/automazioni/handoff.ts) sono
//     esecuzione di un rapporto di lavoro, non marketing.
//   - lib/email/mailer.ts (benvenuto / reset password): destinatario e' un
//     utente interno del CRM, email transazionale legata all'account.

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit/log"
import { leggiConsensoEnforcement } from "./consent-enforcement"

/** Entita' su cui il consenso email e' verificabile. */
export type ConsentEntita = "lead" | "cliente"

type ConsentConfig = {
  table: string
  emailColumn: string
  /** Modulo audit corrispondente (vedi lib/audit/constants.ts). */
  modulo: "lead" | "cliente"
  etichettaSingolare: string
  etichettaPlurale: string
}

const CONSENT_CONFIG: Record<ConsentEntita, ConsentConfig> = {
  lead: {
    table: "leads",
    emailColumn: "email",
    modulo: "lead",
    etichettaSingolare: "lead",
    etichettaPlurale: "lead",
  },
  cliente: {
    table: "clienti",
    emailColumn: "email",
    modulo: "cliente",
    etichettaSingolare: "cliente",
    etichettaPlurale: "clienti",
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
 * colonna, `undefined` deve valere "no". Il default sicuro e' bloccare.
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
   * Stato dell'interruttore globale al momento della decisione. Va riportato
   * al chiamante e non solo consultato: e' cio' che distingue "non c'era
   * nessuno da bloccare" da "il blocco era spento".
   */
  enforcementAttivo: boolean
  /**
   * A chi si scrive davvero. Con enforcement acceso sono i soli consenzienti;
   * spento, sono tutti quelli con un indirizzo valido.
   */
  destinatari: DestinatarioConsenziente[]
  /**
   * Chi NON ha il consenso, sempre popolato a prescindere dall'interruttore.
   * Con enforcement acceso sono gli esclusi; spento, sono le persone a cui si
   * sta scrivendo senza consenso — ed e' esattamente l'elenco che deve finire
   * nell'audit.
   */
  senzaConsenso: DestinatarioConsenziente[]
  /**
   * Id richiesti che non producono un destinatario per motivi diversi dal
   * consenso: nessuna email, oppure record non leggibile (cancellato o RLS).
   */
  esclusiSenzaEmail: number
}

/** Quanti vengono effettivamente fermati: zero se l'interruttore e' spento. */
export function quantiBloccati(esito: EsitoFiltroConsenso): number {
  return esito.enforcementAttivo ? esito.senzaConsenso.length : 0
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * Risolve gli id in destinatari, separando i consenzienti dai bloccati.
 *
 * Fa la query da se' invece di ricevere righe gia' lette: e' il punto in cui
 * "verifica il consenso prima dell'invio" diventa vero anche se il chiamante
 * si dimentica di proiettare la colonna. Una SELECT in piu' su una manciata di
 * id costa nulla rispetto a mandare un'email che non doveva partire.
 */
export async function filtraDestinatariConsenzienti(params: {
  entita: ConsentEntita
  ids: string[]
}): Promise<{ data: EsitoFiltroConsenso | null; error: string | null }> {
  const config = CONSENT_CONFIG[params.entita]
  const ids = [...new Set(params.ids)]

  const { attivo: enforcementAttivo } = await leggiConsensoEnforcement()

  if (ids.length === 0) {
    return {
      data: {
        enforcementAttivo,
        destinatari: [],
        senzaConsenso: [],
        esclusiSenzaEmail: 0,
      },
      error: null,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from(config.table)
    .select(`id,${config.emailColumn},${EMAIL_CONSENT_COLUMN}`)
    .in("id", ids)

  if (error) return { data: null, error: error.message }

  const destinatari: DestinatarioConsenziente[] = []
  const senzaConsenso: DestinatarioConsenziente[] = []
  let conEmail = 0

  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    const email = text(row[config.emailColumn])
    if (!email.includes("@")) continue
    conEmail++

    const destinatario = { id: String(row.id), email }
    const consente = hasEmailConsent(row)
    if (!consente) senzaConsenso.push(destinatario)
    // A interruttore spento entrano tutti: e' il senso dell'interruttore.
    if (consente || !enforcementAttivo) destinatari.push(destinatario)
  }

  return {
    data: {
      enforcementAttivo,
      destinatari,
      senzaConsenso,
      esclusiSenzaEmail: ids.length - conEmail,
    },
    error: null,
  }
}

/**
 * Ri-verifica del consenso al momento dell'invio, per i job di massa.
 *
 * Serve perche' tra l'accodamento e l'ultima email possono passare minuti: un
 * consenso revocato nel frattempo deve fermare le email ancora da spedire, non
 * solo quelle future. E' l'unico controllo che gira DENTRO after(), quindi usa
 * il service_role come tutto il resto del percorso di background (vedi
 * lib/email/bulk-job-store.ts): li' non c'e' piu' un client autenticato
 * affidabile.
 *
 * Fallisce CHIUSO: se la verifica non e' possibile (service_role assente,
 * query in errore) torna `null` e il chiamante deve fermare l'invio. Non
 * poter controllare il consenso non e' un permesso a scrivere.
 */
export async function idsConConsensoEmail(params: {
  entita: ConsentEntita
  ids: string[]
}): Promise<{ consenzienti: Set<string> | null; error: string | null }> {
  const ids = [...new Set(params.ids)]
  if (ids.length === 0) return { consenzienti: new Set(), error: null }

  const admin = createAdminClient()
  if (!admin) {
    return {
      consenzienti: null,
      error: "SUPABASE_SERVICE_ROLE_KEY non configurata: consenso non verificabile",
    }
  }

  const config = CONSENT_CONFIG[params.entita]
  const { data, error } = await admin
    .from(config.table)
    .select(`id,${EMAIL_CONSENT_COLUMN}`)
    .in("id", ids)

  if (error) return { consenzienti: null, error: error.message }

  const consenzienti = new Set<string>()
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    if (hasEmailConsent(row)) consenzienti.add(String(row.id))
  }
  return { consenzienti, error: null }
}

/**
 * Registra il blocco. Una riga sola per tentativo di invio, non una per
 * destinatario: un invio di massa a 100 contatti tutti senza consenso deve
 * lasciare una traccia leggibile, non cento.
 *
 * tipo_evento: `operazione_admin` con esito `failed` e' l'approssimazione piu'
 * vicina consentita dal CHECK audit_log_tipo_evento_check (vedi
 * lib/audit/constants.ts) — non esiste un tipo "invio bloccato" e aggiungerlo
 * richiederebbe di toccare il constraint in produzione.
 *
 * Come da regola di lib/audit/log.ts, un audit rotto non fa fallire nulla: il
 * console.warn resta comunque, ed e' l'unico log garantito.
 */
export async function logInvioBloccatoSenzaConsenso(params: {
  entita: ConsentEntita
  bloccati: DestinatarioConsenziente[]
  /** Quanti destinatari sono invece partiti (0 se l'invio e' stato annullato). */
  inviati: number
  oggetto: string
  attore?: { id: string | null; nome: string | null }
  request?: Request
}): Promise<void> {
  if (params.bloccati.length === 0) return

  const config = CONSENT_CONFIG[params.entita]
  const quanti = params.bloccati.length

  const etichetta = quanti === 1 ? config.etichettaSingolare : config.etichettaPlurale
  console.warn(
    `[consenso-email] invio bloccato verso ${quanti} ${etichetta} senza consenso_contatto_email — oggetto "${params.oggetto}", ${params.inviati} destinatari consenzienti`,
  )

  await logAudit({
    tipo_evento: "operazione_admin",
    esito: "failed",
    modulo: config.modulo,
    attore: params.attore,
    request: params.request,
    descrizione: `Invio email bloccato verso ${quanti} ${etichetta} senza consenso al contatto email (oggetto: "${params.oggetto}")`,
    dati_dopo: {
      motivo: "consenso_contatto_email assente",
      oggetto: params.oggetto,
      bloccati: quanti,
      inviati: params.inviati,
      // Gli id servono a ricostruire chi e' stato escluso; gli indirizzi no,
      // sarebbe copiare dati di contatto dentro il registro.
      ids: params.bloccati.map((b) => b.id),
    },
  })
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
  if (params.bloccatiSenzaConsenso === 0) {
    return `Nessuno dei ${config.etichettaPlurale} selezionati ha un indirizzo email valido.`
  }
  const soggetto =
    params.bloccatiSenzaConsenso === 1
      ? `1 destinatario non ha`
      : `${params.bloccatiSenzaConsenso} destinatari non hanno`
  return `Invio annullato: ${soggetto} dato il consenso al contatto via email. Registra il consenso nella scheda del contatto prima di scrivere.`
}

/**
 * Registra un invio effettuato con l'interruttore globale SPENTO.
 *
 * E' l'evento speculare a logInvioBloccatoSenzaConsenso, e deve restare
 * distinguibile da quello a colpo d'occhio: li' `esito: failed` e
 * "invio bloccato", qui `esito: success` e "SENZA FILTRO DI CONSENSO", con
 * `consenso_enforcement: false` nei dati. Chi rilegge il registro fra sei mesi
 * deve poter separare "abbiamo protetto N contatti" da "abbiamo scritto a N
 * contatti che non avevano acconsentito".
 */
export async function logInvioSenzaEnforcement(params: {
  entita: ConsentEntita
  senzaConsenso: DestinatarioConsenziente[]
  /** Destinatari totali dell'invio, consenzienti inclusi. */
  destinatariTotali: number
  oggetto: string
  attore?: { id: string | null; nome: string | null }
  request?: Request
}): Promise<void> {
  if (params.senzaConsenso.length === 0) return

  const config = CONSENT_CONFIG[params.entita]
  const quanti = params.senzaConsenso.length
  const etichetta = quanti === 1 ? config.etichettaSingolare : config.etichettaPlurale

  console.warn(
    `[consenso-email] BLOCCO DISATTIVATO — invio a ${quanti} ${etichetta} senza consenso, oggetto "${params.oggetto}"`,
  )

  await logAudit({
    tipo_evento: "operazione_admin",
    esito: "success",
    modulo: config.modulo,
    attore: params.attore,
    request: params.request,
    descrizione: `Invio email SENZA FILTRO DI CONSENSO verso ${quanti} ${etichetta} (blocco consenso disattivato) — oggetto: "${params.oggetto}"`,
    dati_dopo: {
      consenso_enforcement: false,
      oggetto: params.oggetto,
      senza_consenso: quanti,
      destinatari_totali: params.destinatariTotali,
      ids: params.senzaConsenso.map((d) => d.id),
    },
  })
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
  const verso = params.nuovo ? "RIATTIVATO" : "DISATTIVATO"
  console.warn(
    `[consenso-email] interruttore globale ${verso} (era ${params.precedente ? "attivo" : "disattivo"})`,
  )

  await logAudit({
    tipo_evento: "operazione_admin",
    // Spegnere la tutela non e' un fallimento tecnico, ma non e' nemmeno un
    // "success" come gli altri: resta success perche' l'operazione e' riuscita,
    // ed e' la descrizione a portare il peso.
    esito: "success",
    modulo: "permessi",
    attore: params.attore,
    request: params.request,
    descrizione: params.nuovo
      ? "Blocco invii senza consenso RIATTIVATO"
      : "Blocco invii senza consenso DISATTIVATO — da ora le email partono senza filtro di consenso",
    dati_prima: { consenso_enforcement: params.precedente },
    dati_dopo: { consenso_enforcement: params.nuovo },
  })
}
