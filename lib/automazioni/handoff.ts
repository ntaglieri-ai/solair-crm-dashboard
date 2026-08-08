// Automazioni di handoff della procedura Vito (Fase 3, 4, 5):
// - creazione Compito assegnato a una persona specifica (Giulia/Paola),
//   trigger su applicazione tag "Emettere Fattura" e su conferma
//   "documentazione completa";
// - inoltro scheda sopralluogo all'installatore: email se Diesse (canale
//   già reale), WhatsApp via Spoki per tutti gli altri (pronto, in attesa
//   di account attivo — vedi lib/whatsapp/spoki-client.ts).
//
// L'identificazione di "chi è Giulia"/"chi è Paola" è per email, letta da
// crm_settings (chiave "system.communication", ramo "automazioni") — non
// hardcodata, così se cambia la persona basta aggiornare la configurazione
// senza toccare codice. Stesso store già usato per i settings Spoki/SMTP.

import { createClient } from "@/lib/supabase/server"
import { createPersonalTransport } from "@/lib/email/lead-mailer"
import { getPersonalEmailPassword, getPersonalEmailStatus } from "@/lib/email/personal-credentials"
import { sendSpokiMessage } from "@/lib/whatsapp/spoki-client"

type HandoffRuolo = "responsabile_fatturazione" | "responsabile_passaggio_pratica"

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
}): Promise<void> {
  const supabase = await createClient()
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
}

/**
 * Fase 4.4 — trigger: tag "Emettere Fattura" applicato su un Cliente.
 * Crea Compito per il responsabile fatturazione (Giulia, via config).
 */
export async function triggerEmettiFattura(clienteId: string, clienteNome: string): Promise<void> {
  const responsabile = await resolveResponsabile("responsabile_fatturazione")
  if (!responsabile) {
    console.warn(
      "[handoff] responsabile_fatturazione non configurato in Impostazioni > Comunicazioni > Automazioni — Compito non creato",
    )
    return
  }
  await creaCompitoHandoff({
    proprietarioId: responsabile.id,
    proprietarioNome: responsabile.nome,
    oggetto: `Emettere fattura — ${clienteNome}`,
    descrizione: "Tag \"Emettere Fattura\" applicato: verificare e procedere con l'emissione.",
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
): Promise<void> {
  const responsabile = await resolveResponsabile("responsabile_passaggio_pratica")
  if (!responsabile) {
    console.warn(
      "[handoff] responsabile_passaggio_pratica non configurato in Impostazioni > Comunicazioni > Automazioni — Compito non creato",
    )
    return
  }
  await creaCompitoHandoff({
    proprietarioId: responsabile.id,
    proprietarioNome: responsabile.nome,
    oggetto: `Passaggio pratica — ${clienteNome}`,
    descrizione: "Documentazione completa ricevuta e caricata: procedere con il passaggio pratica.",
    clienteId,
    clienteNome,
  })
}

export type InoltroSchedaResult =
  | { canale: "email"; ok: true }
  | { canale: "email"; ok: false; detail: string }
  | { canale: "whatsapp"; ok: true }
  | { canale: "whatsapp"; ok: false; reason: string; detail?: string }

/**
 * Fase 3.4 — inoltro scheda sopralluogo all'installatore assegnato.
 * Diesse: email (canale reale, usa la casella personale dell'agente che
 * esegue l'azione). Tutti gli altri: WhatsApp via Spoki (pronto, in attesa
 * di account attivo — se non configurato, ritorna reason "not_configured" e
 * il chiamante può creare comunque un Compito di inoltro manuale come
 * fallback).
 */
export async function inoltraSchedaAInstallatore(params: {
  installatoreNome: string
  installatoreEmail: string | null
  installatoreTelefono: string | null
  clienteNome: string
  linkSchedaNextcloud: string
  agenteUserId: string
}): Promise<InoltroSchedaResult> {
  const isDiesse = params.installatoreNome.trim().toLowerCase() === "diesse"

  if (isDiesse) {
    if (!params.installatoreEmail) {
      return { canale: "email", ok: false, detail: "Nessuna email configurata per Diesse" }
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

  // Non-Diesse: canale WhatsApp.
  if (!params.installatoreTelefono) {
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
  return { canale: "whatsapp", ok: false, reason: result.reason, detail: result.detail }
}
