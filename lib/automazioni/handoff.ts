// Automazioni di handoff della procedura Vito (Fase 3, 4, 5):
// - creazione Compito assegnato a una persona specifica (Giulia/Paola),
//   trigger su applicazione tag "Emettere Fattura" e su conferma
//   "documentazione completa";
// - inoltro scheda sopralluogo all'installatore, sul canale che l'installatore
//   ha impostato (installatori.canale_preferito): email — oggi l'unico canale
//   davvero operativo, ed è il default — oppure WhatsApp via Spoki (pronto, in
//   attesa di account attivo — vedi lib/whatsapp/spoki-client.ts).
//
// L'identificazione di "chi è Giulia"/"chi è Paola" è per email, letta da
// crm_settings (chiave "system.communication", ramo "automazioni") — non
// hardcodata, così se cambia la persona basta aggiornare la configurazione
// senza toccare codice. Stesso store già usato per i settings Spoki/SMTP.

import { createClient } from "@/lib/supabase/server"
import { createPersonalTransport } from "@/lib/email/lead-mailer"
import { getPersonalEmailPassword, getPersonalEmailStatus } from "@/lib/email/personal-credentials"
import { sendSpokiMessage } from "@/lib/whatsapp/spoki-client"
import { normalizeCanalePreferito } from "@/lib/installatori/api-types"

type HandoffRuolo = "responsabile_fatturazione" | "responsabile_passaggio_pratica"

/**
 * Nome del tag cliente che fa scattare la 4.4, come sta scritto a DB
 * (verificato 08/08/2026: "Emettere fattura", minuscolo, ereditato da Zoho).
 */
export const TAG_EMETTERE_FATTURA = "Emettere fattura"

/**
 * Confronto esatto case-insensitive, NON "contiene fattura": tra i tag cliente
 * esiste anche "Emessa fattura" (fattura gia' emessa), che e' il significato
 * opposto e non deve creare nessun Compito.
 */
export function isTagEmettereFattura(nomeTag: string | null | undefined): boolean {
  return (nomeTag ?? "").trim().toLocaleLowerCase("it") ===
    TAG_EMETTERE_FATTURA.toLocaleLowerCase("it")
}

/**
 * Risolve l'utente responsabile di un ruolo di handoff (Giulia = fatturazione,
 * Paola = passaggio pratica) leggendo l'email configurata in crm_settings e
 * cercandola in utenti. Ritorna null se non configurato o non trovato —
 * i chiamanti devono gestire il caso (log, non bloccare il flusso principale).
 */
async function resolveResponsabile(
  ruolo: HandoffRuolo,
): Promise<{ id: string; nome: string; email: string } | null> {
  const supabase = await createClient()

  const { data: settingsRow, error: settingsError } = await supabase
    .from("crm_settings")
    .select("valore")
    .eq("chiave", "system.communication")
    .maybeSingle()

  // Stesso motivo del log sulla query utenti sotto: senza questo, un errore di
  // lettura dei settings sembrerebbe "responsabile non configurato".
  if (settingsError) {
    console.error(
      `[handoff] lettura crm_settings(system.communication) fallita per ruolo ${ruolo}:`,
      settingsError.message,
    )
    return null
  }

  const automazioni = (settingsRow?.valore as { automazioni?: Record<string, string> })
    ?.automazioni
  const email = automazioni?.[ruolo]
  if (!email) return null

  // utenti non ha una colonna cognome: nome contiene già il nome completo
  // (vedi lib/profile/personal-profile.ts, che deriva nome/cognome da qui).
  const { data: utente, error } = await supabase
    .from("utenti")
    .select("id, nome, email")
    .ilike("email", email)
    .maybeSingle()

  // Senza questo log un errore di query (colonna mancante, RLS) sarebbe
  // indistinguibile da "responsabile non configurato" per il chiamante.
  if (error) {
    console.error(`[handoff] query utenti fallita per ruolo ${ruolo}:`, error.message)
    return null
  }
  if (!utente) return null

  return {
    id: utente.id as string,
    nome: (utente.nome as string) || (utente.email as string),
    email: utente.email as string,
  }
}

/**
 * Crea un Compito assegnato direttamente via proprietario_id (uuid reale),
 * bypassando il percorso legacy basato su zoho_id (vedi
 * lib/compiti/repository.ts::updateCompitoRecord, che risolve proprietario_id
 * solo da proprietario_zoho_id — inadatto per utenti creati nativamente nel
 * CRM senza storico Zoho).
 */
async function creaCompitoHandoff(params: {
  proprietarioId: string
  proprietarioNome: string
  oggetto: string
  descrizione: string
  clienteId: string
  clienteNome: string
}): Promise<boolean> {
  const supabase = await createClient()

  // Entrambi i trigger partono da azioni ripetibili (un tag si toglie e si
  // rimette, il pulsante si puo' premere due volte): senza questo controllo
  // il responsabile si ritroverebbe un Compito identico per ogni clic. Se ne
  // esiste gia' uno aperto per lo stesso cliente e lo stesso oggetto, non se
  // ne crea un altro. Un Compito gia' completato non blocca: se la pratica
  // ripassa davvero dalla stessa fase, il nuovo Compito ci vuole.
  const { data: esistente, error: lookupError } = await supabase
    .from("compiti")
    .select("id")
    .eq("correlato_tipo", "cliente")
    .eq("correlato_id", params.clienteId)
    .eq("oggetto", params.oggetto)
    .neq("stato", "Completato")
    .limit(1)
  if (lookupError) {
    throw new Error(`creaCompitoHandoff (verifica duplicati): ${lookupError.message}`)
  }
  if (esistente && esistente.length > 0) return false

  const { error } = await supabase.from("compiti").insert({
    oggetto: params.oggetto,
    descrizione: params.descrizione,
    stato: "Non iniziato",
    priorita: "Alto",
    proprietario_id: params.proprietarioId,
    proprietario_nome: params.proprietarioNome,
    correlato_id: params.clienteId,
    correlato_nome: params.clienteNome,
    correlato_tipo: "cliente",
  })
  if (error) throw new Error(`creaCompitoHandoff: ${error.message}`)
  return true
}

/**
 * Esito di un trigger di handoff.
 *
 * I due trigger NON lanciano mai: girano agganciati a un'azione utente gia'
 * andata a buon fine (il tag e' scritto, la documentazione e' confermata) e
 * un'automazione fallita non deve far credere che l'azione principale sia
 * fallita. Il chiamante decide cosa mostrare leggendo questo esito.
 *
 * `creato: false` con `ok: true` significa "c'era gia' un Compito aperto
 * identico": nulla da fare, nessun avviso da dare.
 */
export type HandoffTriggerEsito =
  | { ok: true; creato: boolean; responsabile: string }
  | { ok: false; motivo: "non_configurato" }
  | { ok: false; motivo: "errore"; detail: string }

async function eseguiTriggerHandoff(
  ruolo: HandoffRuolo,
  compito: { oggetto: string; descrizione: string; clienteId: string; clienteNome: string },
): Promise<HandoffTriggerEsito> {
  try {
    const responsabile = await resolveResponsabile(ruolo)
    if (!responsabile) {
      console.warn(
        `[handoff] ${ruolo} non configurato in Impostazioni > Comunicazioni > Automazioni handoff — Compito non creato`,
      )
      return { ok: false, motivo: "non_configurato" }
    }
    const creato = await creaCompitoHandoff({
      proprietarioId: responsabile.id,
      proprietarioNome: responsabile.nome,
      ...compito,
    })
    return { ok: true, creato, responsabile: responsabile.nome }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "errore sconosciuto"
    console.error(`[handoff] trigger ${ruolo} fallito per cliente ${compito.clienteId}:`, detail)
    return { ok: false, motivo: "errore", detail }
  }
}

/**
 * Fase 4.4 — trigger: tag "Emettere fattura" applicato su un Cliente.
 * Crea Compito per il responsabile fatturazione (Giulia, via config).
 */
export async function triggerEmettiFattura(
  clienteId: string,
  clienteNome: string,
): Promise<HandoffTriggerEsito> {
  return eseguiTriggerHandoff("responsabile_fatturazione", {
    oggetto: `Emettere fattura — ${clienteNome}`,
    descrizione: `Tag "${TAG_EMETTERE_FATTURA}" applicato: verificare e procedere con l'emissione.`,
    clienteId,
    clienteNome,
  })
}

/**
 * Fase 5.5 — trigger: documentazione completa caricata su un Cliente.
 * Crea Compito per il responsabile passaggio pratica (Paola, via config).
 */
export async function triggerDocumentazioneCompleta(
  clienteId: string,
  clienteNome: string,
): Promise<HandoffTriggerEsito> {
  return eseguiTriggerHandoff("responsabile_passaggio_pratica", {
    oggetto: `Passaggio pratica — ${clienteNome}`,
    descrizione: "Documentazione completa ricevuta e caricata: procedere con il passaggio pratica.",
    clienteId,
    clienteNome,
  })
}

/**
 * Esito dell'inoltro scheda.
 *
 * Nessun esito ok:false comporta un invio "in qualche altro modo": se il
 * canale preferito non è disponibile la scheda NON parte e il chiamante deve
 * creare un Compito di inoltro manuale. `canale: null` è il caso in cui non si
 * è nemmeno riusciti a leggere l'installatore (id sbagliato, errore query):
 * distinto dagli altri perché lì non c'è niente da riprovare sul canale.
 */
export type InoltroSchedaResult =
  | { canale: "email"; ok: true }
  | { canale: "email"; ok: false; detail: string }
  | { canale: "whatsapp"; ok: true }
  | {
      canale: "whatsapp"
      ok: false
      reason: "no_phone" | "not_configured" | "disabled" | "request_failed"
      detail?: string
    }
  | { canale: null; ok: false; detail: string }

async function inviaSchedaViaEmail(params: {
  installatoreNome: string
  installatoreEmail: string | null
  clienteNome: string
  linkSchedaNextcloud: string
  agenteUserId: string
}): Promise<InoltroSchedaResult> {
  if (!params.installatoreEmail) {
    return {
      canale: "email",
      ok: false,
      detail: `Nessuna email configurata per ${params.installatoreNome}`,
    }
  }
  const emailStatus = await getPersonalEmailStatus(params.agenteUserId)
  if (!emailStatus.configured || !emailStatus.smtpUser) {
    return {
      canale: "email",
      ok: false,
      detail: "Casella email personale dell'agente non configurata (Profilo)",
    }
  }
  const smtpPassword = await getPersonalEmailPassword(params.agenteUserId)
  if (!smtpPassword) {
    return { canale: "email", ok: false, detail: "Password casella email non disponibile" }
  }
  try {
    const transport = createPersonalTransport(emailStatus.smtpUser, smtpPassword)
    await transport.sendMail({
      from: emailStatus.smtpUser,
      to: params.installatoreEmail,
      subject: `Scheda sopralluogo — ${params.clienteNome}`,
      text: `Scheda pratica per ${params.clienteNome}: ${params.linkSchedaNextcloud}`,
    })
    return { canale: "email", ok: true }
  } catch (err) {
    return {
      canale: "email",
      ok: false,
      detail: err instanceof Error ? err.message : "Errore invio email",
    }
  }
}

async function inviaSchedaViaWhatsapp(params: {
  installatoreNome: string
  installatoreTelefono: string | null
  clienteNome: string
  linkSchedaNextcloud: string
}): Promise<InoltroSchedaResult> {
  if (!params.installatoreTelefono) {
    console.warn(
      `[handoff] ${params.installatoreNome} ha canale preferito WhatsApp ma nessun telefono — scheda "${params.clienteNome}" NON inviata, serve inoltro manuale`,
    )
    return { canale: "whatsapp", ok: false, reason: "no_phone" }
  }

  const result = await sendSpokiMessage({
    telefono: params.installatoreTelefono,
    variabili: {
      installatore: params.installatoreNome,
      cliente: params.clienteNome,
      link_scheda: params.linkSchedaNextcloud,
    },
  })
  if (result.ok) return { canale: "whatsapp", ok: true }

  // Spoki spento o non configurato: NON si ripiega sull'email di nascosto —
  // sarebbe un cambio di canale silenzioso, per un installatore che ha scelto
  // WhatsApp. Si logga e si restituisce la reason di sendSpokiMessage così
  // com'è, così il chiamante crea il Compito di inoltro manuale.
  if (result.reason === "not_configured" || result.reason === "disabled") {
    console.warn(
      `[handoff] canale WhatsApp non disponibile (${result.reason}) per ${params.installatoreNome} — scheda "${params.clienteNome}" NON inviata, serve inoltro manuale. Configurare Spoki in Impostazioni CRM > Comunicazioni.`,
    )
  }
  return { canale: "whatsapp", ok: false, reason: result.reason, detail: result.detail }
}

/**
 * Fase 3.4 — inoltro scheda sopralluogo all'installatore assegnato, sul canale
 * che l'installatore ha impostato (installatori.canale_preferito, modificabile
 * dalla sua scheda).
 *
 * - email: casella personale dell'agente che esegue l'azione (canale reale,
 *   oggi l'unico operativo — è il default della colonna);
 * - whatsapp: Spoki, pronto ma in attesa di account attivo. Finché non è
 *   configurato l'inoltro fallisce esplicitamente con reason "not_configured" /
 *   "disabled": nessun ripiego automatico su email.
 *
 * Prende l'id e rilegge nome/email/telefono da DB invece di riceverli come
 * parametri: il canale e i recapiti su cui inviare devono venire dalla stessa
 * riga, altrimenti un chiamante con dati in cache potrebbe inviare sul canale
 * giusto al recapito vecchio.
 */
export async function inoltraSchedaAInstallatore(params: {
  installatoreId: string
  clienteNome: string
  linkSchedaNextcloud: string
  agenteUserId: string
}): Promise<InoltroSchedaResult> {
  const supabase = await createClient()
  const { data: installatore, error } = await supabase
    .from("installatori")
    .select("nome, email, telefono, canale_preferito")
    .eq("id", params.installatoreId)
    .maybeSingle()

  if (error) {
    console.error(
      `[handoff] lettura installatore ${params.installatoreId} fallita:`,
      error.message,
    )
    return { canale: null, ok: false, detail: `Lettura installatore: ${error.message}` }
  }
  if (!installatore) {
    return { canale: null, ok: false, detail: "Installatore non trovato" }
  }

  const installatoreNome = (installatore.nome as string | null) ?? "installatore"
  const canale = normalizeCanalePreferito(installatore.canale_preferito)

  if (canale === "whatsapp") {
    return inviaSchedaViaWhatsapp({
      installatoreNome,
      installatoreTelefono: installatore.telefono as string | null,
      clienteNome: params.clienteNome,
      linkSchedaNextcloud: params.linkSchedaNextcloud,
    })
  }

  return inviaSchedaViaEmail({
    installatoreNome,
    installatoreEmail: installatore.email as string | null,
    clienteNome: params.clienteNome,
    linkSchedaNextcloud: params.linkSchedaNextcloud,
    agenteUserId: params.agenteUserId,
  })
}
