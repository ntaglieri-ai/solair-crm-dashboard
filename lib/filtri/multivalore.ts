/**
 * Filtri PostgREST sulle colonne a scelta multipla ("A;B;C" in una colonna text).
 *
 * Il confronto avviene sui singoli valori, non sulla stringa intera: un record
 * esce se ALMENO UNO dei suoi valori e' fra quelli scelti. Un `in` sulla
 * stringa intera perdeva "Installato;Necessario sopralluogo/intervento"
 * filtrando "Installato"; un `ilike '%Installato%'` avrebbe invece preso anche
 * un ipotetico "Non installato". Qui l'espressione regolare e' ancorata ai
 * separatori: (^|;) valore (;|$).
 *
 * Niente barre rovesciate nell'espressione: dentro un valore PostgREST fra
 * virgolette il loro significato dipende dal parser. Gli spazi si scrivono
 * [[:space:]] e i caratteri speciali come classe di un solo carattere ([.]).
 */

const SPECIALI_IN_CLASSE = new Set([".", "*", "+", "?", "$", "(", ")", "{", "}", "|", "["])

function carattereLetterale(carattere: string): string {
  if (carattere === "]") return "[]]"
  // "^" e "\" non si possono scrivere come classe senza barra rovesciata:
  // valgono "un carattere qualsiasi". Il confronto resta ancorato ai
  // separatori, quindi al massimo accetta un valore quasi identico.
  if (carattere === "^" || carattere === "\\") return "."
  return SPECIALI_IN_CLASSE.has(carattere) ? `[${carattere}]` : carattere
}

/** Espressione regolare POSIX che riconosce `valore` come elemento della lista. */
export function regexElemento(valore: string): string {
  const letterale = Array.from(valore.trim()).map(carattereLetterale).join("")
  return `(^|;)[[:space:]]*${letterale}[[:space:]]*(;|$)`
}

/** Valore fra virgolette dentro un'espressione or()/and() di PostgREST. */
function fraVirgolette(valore: string): string {
  return `"${valore.replace(/"/g, '""')}"`
}

/** Condizioni "contiene l'elemento", una per valore (da mettere in or()). */
export function condizioniElemento(colonna: string, valori: readonly string[]): string[] {
  return valori
    .map((valore) => String(valore).trim())
    .filter(Boolean)
    .map((valore) => `${colonna}.match.${fraVirgolette(regexElemento(valore))}`)
}

/** Almeno uno dei valori e' presente. null se non c'e' nessun valore. */
export function contieneUnoDi(colonna: string, valori: readonly string[]): string | null {
  const condizioni = condizioniElemento(colonna, valori)
  if (condizioni.length === 0) return null
  return condizioni.length === 1 ? condizioni[0] : `or(${condizioni.join(",")})`
}

/** Nessuno dei valori e' presente. null se non c'e' nessun valore. */
export function nonContieneNessunoDi(colonna: string, valori: readonly string[]): string | null {
  const condizioni = condizioniElemento(colonna, valori).map((condizione) =>
    condizione.replace(`${colonna}.match.`, `${colonna}.not.match.`),
  )
  if (condizioni.length === 0) return null
  return condizioni.length === 1 ? condizioni[0] : `and(${condizioni.join(",")})`
}
