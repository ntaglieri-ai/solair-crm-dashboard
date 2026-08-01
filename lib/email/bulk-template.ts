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
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const normalized = key.toLowerCase()
    if (!(BULK_PLACEHOLDERS as readonly string[]).includes(normalized)) return match
    return placeholders[normalized] ?? ""
  })
}
