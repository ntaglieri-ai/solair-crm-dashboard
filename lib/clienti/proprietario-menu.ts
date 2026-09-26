import type { ClienteRecord } from "@/lib/mock-data"

/**
 * Spunta di "Assegna commerciale" nel menu contestuale della lista clienti.
 *
 * Si legge sempre dal valore attuale della riga (l'aggiornamento ottimistico
 * della lista lo cambia subito), mai da una copia presa quando la riga e'
 * comparsa: quella restava indietro e segnava il proprietario sbagliato.
 */
export function proprietarioSpuntato(
  cliente: Pick<ClienteRecord, "Clienti Proprietario">,
  proprietarioId: string,
): boolean {
  const attuale = cliente["Clienti Proprietario"] ?? ""
  return attuale !== "" && attuale === proprietarioId
}
