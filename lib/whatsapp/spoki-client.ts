// Adapter per invio messaggi WhatsApp via Spoki.
//
// Meccanismo reale Spoki (verificato su support.spoki.com/docs/integrazioni/
// integrare-spoki-con-qualsiasi-gestionale-attraverso-api/, 08/08/2026):
// Spoki NON espone un endpoint generico "invia a qualsiasi numero con
// qualsiasi testo". Il flusso è: nel pannello Spoki si crea una
// "Automazione" con uno step di avvio "Integrazione / API Url", si sceglie
// il Template WhatsApp da inviare (i template WhatsApp Business devono
// essere pre-approvati da Meta), si salva e Spoki genera un URL webhook
// univoco per QUELLA automazione/template. Il nostro sistema chiama quel
// URL via POST quando serve inviare.
//
// Questo file resta quindi generico: legge webhookUrl/apiToken da
// crm_settings (chiave "system.communication", ramo "spoki" — stesso store
// già usato dal form in app/crm-settings/system/comunicazioni/page.tsx) e fa
// da POST wrapper. Il payload esatto (nomi campo per numero destinatario e
// variabili del template) va confermato con un test reale una volta che
// l'automazione è creata nel pannello Spoki — oggi non pubblicano uno
// schema payload fisso perché dipende dai campi dinamici del template
// scelto. Il TODO sotto segnala esattamente cosa verificare al primo invio
// reale, così quando l'account è pronto basta un aggiustamento mirato, non
// una riscrittura.
//
// STATO: pronto, in attesa solo di:
// 1) account Spoki attivo (approvazione costi Vito + verifica Meta BM)
// 2) automazione creata nel pannello Spoki con template scheda-sopralluogo
// 3) webhookUrl + apiToken incollati in Impostazioni CRM → Comunicazioni

import { createClient } from "@/lib/supabase/server"

export type SpokiSettings = {
  enabled: boolean
  whatsappNumber: string
  businessName: string
  apiToken: string
  webhookUrl: string
  defaultTemplate: string
}

export type SpokiSendResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "disabled" | "request_failed"; detail?: string }

/**
 * Legge la configurazione Spoki da crm_settings (system.communication.spoki).
 * Stessa tabella/chiave lette da app/api/crm-settings/system/[key]/route.ts.
 */
export async function getSpokiSettings(): Promise<SpokiSettings | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crm_settings")
    .select("valore")
    .eq("chiave", "system.communication")
    .maybeSingle()

  // Un errore di query qui degraderebbe altrimenti in un silenzioso
  // "not_configured" lato sendSpokiMessage, indistinguibile da un account
  // Spoki semplicemente non ancora impostato.
  if (error) {
    console.error("[spoki] lettura crm_settings(system.communication) fallita:", error.message)
    return null
  }
  if (!data?.valore) return null

  const valore = data.valore as { spoki?: Partial<SpokiSettings> }
  if (!valore.spoki) return null

  return {
    enabled: Boolean(valore.spoki.enabled),
    whatsappNumber: valore.spoki.whatsappNumber ?? "",
    businessName: valore.spoki.businessName ?? "",
    apiToken: valore.spoki.apiToken ?? "",
    webhookUrl: valore.spoki.webhookUrl ?? "",
    defaultTemplate: valore.spoki.defaultTemplate ?? "",
  }
}

export type SpokiMessagePayload = {
  /** Numero WhatsApp destinatario, formato E.164 (es. "+393331234567"). */
  telefono: string
  /**
   * Variabili del template WhatsApp approvato (campi dinamici Spoki).
   * Le chiavi esatte dipendono da come il template è stato configurato nel
   * pannello Spoki — TODO: confermare al primo invio reale.
   */
  variabili: Record<string, string>
}

/**
 * Invia un messaggio WhatsApp tramite l'automazione Spoki configurata.
 * Non lancia eccezioni: ritorna sempre un risultato tipizzato, così i
 * trigger che lo chiamano (es. inoltro scheda installatore) possono
 * decidere il fallback (es. creare comunque il Compito manuale) senza
 * try/catch sparsi.
 */
export async function sendSpokiMessage(payload: SpokiMessagePayload): Promise<SpokiSendResult> {
  const settings = await getSpokiSettings()

  if (!settings) {
    return { ok: false, reason: "not_configured" }
  }
  if (!settings.enabled || !settings.webhookUrl || !settings.apiToken) {
    return { ok: false, reason: "disabled" }
  }

  try {
    const response = await fetch(settings.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiToken}`,
      },
      body: JSON.stringify({
        telefono: payload.telefono,
        ...payload.variabili,
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      return { ok: false, reason: "request_failed", detail: detail.slice(0, 500) }
    }

    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      reason: "request_failed",
      detail: err instanceof Error ? err.message : "Errore di rete",
    }
  }
}
