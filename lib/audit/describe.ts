// Costruzione delle descrizioni che compaiono in tabella.
//
// La colonna `descrizione` e' l'unica su cui agisce la ricerca testuale della
// pagina, quindi deve contenere in chiaro le parole che si cercherebbero: il
// nome del record e i campi toccati. Un "Lead aggiornato" secco renderebbe il
// filtro inutile.

/** Numero massimo di campi elencati per esteso prima di riassumere. */
const MAX_CAMPI = 4

/** Etichetta leggibile del record, per come lo riconoscerebbe un commerciale. */
export function etichettaRecord(
  record: Record<string, unknown> | null | undefined,
  chiavi: string[],
): string | null {
  if (!record) return null
  for (const chiave of chiavi) {
    const valore = record[chiave]
    if (typeof valore === "string" && valore.trim()) return valore.trim()
  }
  const nome = [record["Nome"], record["Cognome"]]
    .filter((v): v is string => typeof v === "string" && Boolean(v.trim()))
    .join(" ")
    .trim()
  return nome || null
}

/**
 * Campi effettivamente modificati: si confronta la patch con lo stato
 * precedente, perche' i form del CRM rimandano spesso l'oggetto intero e
 * elencare tutti i campi come "modificati" sarebbe falso.
 */
export function campiModificati(
  prima: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): string[] {
  return Object.keys(patch).filter((campo) => {
    if (campo === "id") return false
    if (!prima) return true
    return JSON.stringify(prima[campo]) !== JSON.stringify(patch[campo])
  })
}

/** "Lead Mario Bianchi — modificati Stato Lead, Telefono" */
export function descriviModifica(
  entita: string,
  etichetta: string | null,
  campi: string[],
): string {
  const soggetto = etichetta ? `${entita} ${etichetta}` : entita
  if (campi.length === 0) return `${soggetto} — salvato senza modifiche`

  const elencati = campi.slice(0, MAX_CAMPI).join(", ")
  const resto = campi.length - MAX_CAMPI
  return resto > 0
    ? `${soggetto} — modificati ${elencati} e altri ${resto} campi`
    : `${soggetto} — modificati ${elencati}`
}

/**
 * Sottoinsieme dei soli campi toccati, per le colonne dati_prima/dati_dopo.
 * Salvare il record intero gonfierebbe la tabella di dati gia' presenti altrove.
 */
export function diffCampi(
  record: Record<string, unknown> | null | undefined,
  campi: string[],
): Record<string, unknown> | null {
  if (!record || campi.length === 0) return null
  const out: Record<string, unknown> = {}
  for (const campo of campi) out[campo] = record[campo] ?? null
  return out
}
