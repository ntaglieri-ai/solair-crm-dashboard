// Compatibilita' con il vecchio interruttore del blocco consenso.
// Il blocco non e' piu' operativo: i consensi restano dati informativi.

export const CHIAVE_CONSENSO_ENFORCEMENT = "consenso_enforcement_attivo"

/** Spento per default: il consenso non e' una precondizione di invio. */
export const CONSENSO_ENFORCEMENT_DEFAULT = false

export function invalidaCacheEnforcement(): void {
  // Funzione mantenuta per compatibilita' con i vecchi call-site.
}

/**
 * Stato dell'interruttore storico. Anche se una vecchia chiave risulta accesa,
 * il codice di invio non la consulta piu'.
 */
export async function leggiConsensoEnforcement(): Promise<{
  attivo: boolean
  errore: string | null
}> {
  return { attivo: CONSENSO_ENFORCEMENT_DEFAULT, errore: null }
}

export async function salvaConsensoEnforcement(
  attivo: boolean,
): Promise<{ errore: string | null }> {
  void attivo
  invalidaCacheEnforcement()
  return { errore: null }
}
