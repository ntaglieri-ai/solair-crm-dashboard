// Descrizione e metadati della riga di audit scritta a ogni export CSV.
//
// Sta a parte dai due route handler perche' Lead e Clienti devono produrre
// righe leggibili allo stesso modo: chi legge il registro sta cercando "chi ha
// scaricato quanti record e con quale filtro", e la risposta non puo' dipendere
// dal modulo che l'ha scritta.
//
// Cosa NON finisce qui dentro: le righe esportate. L'audit registra la misura
// e il criterio dell'estrazione, mai i dati personali estratti — duplicarli nel
// registro creerebbe una seconda copia degli stessi dati, con la stessa
// sensibilita' e nessuna finalita' in piu'.

/** Ambito dell'estrazione: filtri della lista, o una selezione di righe. */
export type ExportScope = "filtro" | "selezione"

export interface ExportAuditInput {
  rows: unknown[]
  total: number
  truncated: boolean
}

/** "Export CSV Lead (filtro): 342 record esportati" */
export function descriviExport(
  entita: string,
  scope: ExportScope,
  result: ExportAuditInput,
): string {
  const base = `Export CSV ${entita} (${scope}): ${result.rows.length} record esportati`
  return result.truncated
    ? `${base} su ${result.total} corrispondenti (troncato)`
    : base
}

/**
 * Contenuto di `dati_dopo`: quanto e' uscito, quanto corrispondeva davvero, e
 * in base a quale criterio. Il flag `troncato` e' la parte che serve di piu' a
 * distanza: dice che quel CSV non e' l'insieme completo.
 */
export function datiExport(
  scope: ExportScope,
  result: ExportAuditInput,
  criterio: Record<string, string> | null,
): Record<string, unknown> {
  return {
    record_esportati: result.rows.length,
    record_totali: result.total,
    troncato: result.truncated,
    criterio: scope === "selezione" ? "selezione esplicita" : (criterio ?? {}),
  }
}

/**
 * Filtri attivi letti dalla query string, cosi' com'erano al momento
 * dell'export. Si tengono solo le chiavi di filtro: page/pageSize/fields
 * descrivono la paginazione, non l'insieme estratto.
 */
export function criteriDaSearchParams(
  sp: URLSearchParams,
  chiavi: string[],
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const chiave of chiavi) {
    const valore = sp.get(chiave)
    if (valore) out[chiave] = valore
  }
  return out
}
