export type RicercaGlobaleTipo = "cliente" | "lead" | "installatore"

export interface RisultatoRicercaGlobale {
  tipo: RicercaGlobaleTipo
  id: string
  nome: string
  /** Seconda riga del risultato: serve a distinguere omonimi. */
  dettaglio: string | null
  href: string
}

/**
 * Sotto le due lettere la ricerca non parte. La soglia sta qui e non solo
 * nella route perche' serve a entrambi i lati: il campo evita la chiamata,
 * la route la rifiuta comunque se arriva da altrove.
 */
export const RICERCA_GLOBALE_MIN_CARATTERI = 2

/**
 * Trasforma il testo digitato nel pattern `ilike` per la ricerca globale.
 *
 * Dentro un `.or()` PostgREST legge virgole e parentesi come sintassi del
 * filtro, non come testo da cercare: "Rossi, Mario" spezzerebbe
 * l'espressione e la query tornerebbe 400. `%` e `\` vanno via per il
 * motivo opposto — scritti dall'utente diventerebbero wildcard ed escape
 * che nessuno ha chiesto. Restituisce stringa vuota quando non resta niente
 * da cercare, cosi' chi chiama sa di doversi fermare invece di interrogare
 * il database con `%%`, che restituirebbe tutto.
 */
export function patternRicercaGlobale(q: string): string {
  const pulito = q.replace(/[%,()\\]/g, " ").trim()
  return pulito ? `%${pulito}%` : ""
}
