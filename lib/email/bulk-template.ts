// Contratto condiviso client/server dell'invio di massa: tetto, placeholder e
// resa del template.
//
// Sta in un file a parte (e non in bulk-mailer.ts) proprio perche' il dialog
// di composizione lo importa da un componente client per l'anteprima: se
// arrivasse da bulk-mailer si tirerebbe dietro nodemailer nel bundle del
// browser. Qui dentro non deve MAI comparire un import server-only.

/**
 * Tetto DURO per singola operazione di invio di massa, valido su tutti e tre
 * i moduli (Lead / Clienti / Installatori). Una casella Aruba condivisa regge
 * ~100-150 invii/ora: oltre si rischia il blocco della casella personale
 * dell'agente. Oltre il tetto la UI disabilita l'azione e l'API risponde 400 —
 * mai un troncamento silenzioso della selezione.
 */
export const MAX_BULK_RECIPIENTS = 100

/** Placeholder esposti nella UI di composizione, nell'ordine in cui appaiono. */
export const BULK_PLACEHOLDERS = ["nome", "cognome", "email", "telefono"] as const

export type BulkPlaceholder = (typeof BULK_PLACEHOLDERS)[number]

/**
 * Sostituisce i {placeholder} noti con i valori del destinatario. I token non
 * riconosciuti restano intatti (meglio un `{foo}` visibile in anteprima che un
 * buco silenzioso nel testo), i valori mancanti diventano stringa vuota.
 */
export function renderTemplate(
  template: string,
  placeholders: Record<string, string>,
  /**
   * Valori dei campi del record, per i segnaposto che non sono fra i quattro
   * di base: {Nr. Moduli}, {Capacità Batterie}, {Data installazione ultimata}.
   *
   * I modelli importati da Zoho ne usano parecchi — quello di Assistenza da
   * solo diciotto — e senza questi arriverebbero al cliente con i segnaposto
   * in chiaro.
   */
  campi?: Record<string, string | number | boolean | null | undefined>,
): string {
  // Il contenuto e' HTML e puo' contenere graffe che non sono segnaposto
  // (regole CSS, per esempio). Non e' un problema: un token che non
  // corrisponde a nulla resta intatto invece di diventare vuoto.
  return template.replace(/\$\{([^{}]+)\}|\{([^{}]+)\}/g, (match, zohoKey: string, simpleKey: string) => {
    const key = normalizzaChiaveSegnaposto(zohoKey ?? simpleKey)
    const normalized = key.toLowerCase()
    if ((BULK_PLACEHOLDERS as readonly string[]).includes(normalized)) {
      return placeholders[normalized] ?? ""
    }

    if (campi) {
      const chiave = key.trim()
      // Prima la corrispondenza esatta, poi quella senza distinzione di
      // maiuscole: i nomi dei campi vengono scritti a mano nei modelli, e
      // "cod- moduli" deve trovare "COD- MODULI".
      if (chiave in campi) return formattaValoreCampo(campi[chiave])
      const trovata = Object.keys(campi).find(
        (nome) => nome.toLowerCase() === chiave.toLowerCase(),
      )
      if (trovata) return formattaValoreCampo(campi[trovata])
    }

    return match
  })
}

function normalizzaChiaveSegnaposto(raw: string): string {
  const key = raw.trim()
  return key.replace(/^(Clienti|Leads|Lead|Installatori)\./i, "").trim()
}

/**
 * Il valore di un campo dentro un'email.
 *
 * Un campo non compilato diventa stringa vuota e non "null" o "undefined",
 * che finirebbero nel testo inviato al cliente.
 */
function formattaValoreCampo(valore: string | number | boolean | null | undefined): string {
  if (valore === null || valore === undefined) return ""
  if (typeof valore === "boolean") return valore ? "Sì" : "No"
  return String(valore)
}
