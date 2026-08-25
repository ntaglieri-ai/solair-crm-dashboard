// Formattazione delle date dello storico invii, condivisa dal pannello laterale
// e dalla sezione E-mail della scheda: le due viste devono datare lo stesso
// invio allo stesso modo.
//
// Le date arrivano da crm_email_log.data_invio, cioe' un timestamptz ISO — non
// il formato "gg/mm/aaaa" dei campi legacy del lead, che altrove in questo
// modulo viene parsato a mano.

export function formatEmailLogDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
