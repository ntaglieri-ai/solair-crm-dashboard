import type { CampoTipo } from "@/lib/system-settings-data"

/**
 * Layout configurabile delle schede record.
 *
 * Tre livelli, come su Zoho: pagina (voce della navbar) -> blocco (riquadro
 * con titolo) -> campo. Qui vivono solo i tipi e le funzioni pure; la lettura
 * dal database sta in layout-server.ts, che gira lato server.
 *
 * Confine importante: questa configurazione descrive DOVE un campo appare e
 * COME si presenta. Il valore resta dov'e' sempre stato — colonna tipizzata
 * per i campi di sistema, crm_custom_fields per quelli personalizzati.
 */

/** Corrisponde a crm_layout_campi.origine. */
export type LayoutFieldOrigine = "system" | "custom"

/**
 * Tipi di campo disponibili nel layout.
 *
 * I primi dodici sono quelli gia' supportati da CAMPO_TIPI e dalla pagina
 * Attributi. Gli ultimi quattro sono le aggiunte necessarie per coprire i
 * campi Zoho:
 *
 * - formula:    campo calcolato da altri campi, non scrivibile a mano
 * - percent:    numero mostrato come percentuale
 * - url:        oggi ricadeva su text, senza validazione ne' link cliccabile
 * - autonumber: progressivo assegnato dal sistema alla creazione
 * - decimal:    Zoho distingue Numero (intero) da Decimale; CampoTipo aveva
 *               solo number, e i campi tecnici (Tot Potenza DC, kWh) sono
 *               decimali
 *
 * "Utente" della palette Zoho corrisponde al gia' presente lookup verso
 * utenti, quindi non aggiunge un tipo nuovo.
 */
export type LayoutCampoTipo =
  | CampoTipo
  | "formula"
  | "percent"
  | "url"
  | "autonumber"
  | "decimal"

export const LAYOUT_CAMPO_TIPI: readonly LayoutCampoTipo[] = [
  "text",
  "textarea",
  "number",
  "decimal",
  "currency",
  "percent",
  "date",
  "datetime",
  "boolean",
  "select",
  "multiselect",
  "lookup",
  "email",
  "phone",
  "url",
  "formula",
  "autonumber",
] as const

/** Etichette italiane per la palette dei tipi nella pagina Layout. */
export const LAYOUT_CAMPO_TIPO_LABEL: Record<string, string> = {
  text: "Linea singola",
  textarea: "Multi-linea",
  number: "Numero",
  decimal: "Decimale",
  currency: "Valuta",
  percent: "Percentuale",
  date: "Data",
  datetime: "Data/Ora",
  boolean: "Casella di controllo",
  select: "Elenco di selezione",
  multiselect: "Selezione multipla",
  lookup: "Ricerca",
  email: "E-mail",
  phone: "Telefono",
  url: "URL",
  formula: "Formula",
  autonumber: "Numerazione automatica",
}

/**
 * Un campo calcolato non e' scrivibile: il valore arriva dalla formula, mai
 * dall'utente. Vale anche per autonumber, assegnato alla creazione.
 */
export function tipoCalcolato(tipo: string): boolean {
  return tipo === "formula" || tipo === "autonumber"
}

/** Formattazione di presentazione. Non altera il valore salvato. */
export type LayoutFormato = {
  /** Cifre decimali per number/decimal/currency/percent. */
  decimali?: number
  /** Simbolo valuta, default EUR quando il tipo e' currency. */
  valuta?: string
  /** Testo mostrato quando il valore e' vuoto. Default "—". */
  placeholder?: string
}

/**
 * Definizione di un campo calcolato.
 *
 * Le formule Zoho sono scritte in un linguaggio proprietario che non gira
 * fuori da Zoho: vengono tradotte una per una e conservate qui in forma
 * esplicita, cosi' restano leggibili e modificabili senza rileggere il codice.
 *
 * `expr` usa i field_key tra parentesi graffe:
 *   { "expr": "{Importo Contrattuale} - {1° Tranche} - {2°Tranche}" }
 *
 * `origine_zoho` conserva l'espressione Zoho originale come documentazione:
 * serve a ricontrollare la traduzione quando un numero non torna, e non viene
 * mai valutata.
 */
export type LayoutFormula = {
  expr: string
  origine_zoho?: string
}

export type LayoutCampo = {
  id: string
  origine: LayoutFieldOrigine
  fieldKey: string
  /** Null quando si usa l'etichetta nativa del campo. */
  labelOverride: string | null
  ordinamento: number
  visible: boolean
  span: number
  solaLettura: boolean
  formato: LayoutFormato
  formula: LayoutFormula | null
}

export type LayoutBlocco = {
  id: string
  blockKey: string
  label: string
  mostraTitolo: boolean
  colonne: number
  ordinamento: number
  visible: boolean
  campi: LayoutCampo[]
}

export type LayoutPagina = {
  id: string
  pageKey: string
  label: string
  icona: string | null
  ordinamento: number
  visible: boolean
  /**
   * Valorizzato per le pagine che rendono un componente dedicato invece di
   * una griglia di campi (Allegati, Calendario, Attivita'). Restano nel
   * layout per poterle riordinare e nascondere, ma non accettano campi.
   */
  componente: string | null
  blocchi: LayoutBlocco[]
}

/** Un campo e' modificabile solo se non e' calcolato e non e' congelato. */
export function campoModificabile(campo: LayoutCampo, tipo: string): boolean {
  return !campo.solaLettura && !tipoCalcolato(tipo) && campo.formula === null
}

/**
 * Applica l'ordine personale dell'utente alle pagine definite dall'admin.
 *
 * Le pagine elencate nella preferenza vengono per prime, nell'ordine scelto;
 * quelle non elencate seguono in coda nell'ordine dell'admin. Cosi' una
 * pagina aggiunta dopo che l'utente ha salvato la sua preferenza compare
 * comunque, invece di sparire.
 */
export function applicaOrdinePersonale(
  pagine: LayoutPagina[],
  ordine: string[],
): LayoutPagina[] {
  if (!ordine.length) return pagine

  const posizione = new Map(ordine.map((key, index) => [key, index]))
  return [...pagine].sort((a, b) => {
    const pa = posizione.get(a.pageKey)
    const pb = posizione.get(b.pageKey)
    if (pa !== undefined && pb !== undefined) return pa - pb
    // Una pagina senza preferenza va dopo tutte quelle che ce l'hanno.
    if (pa !== undefined) return -1
    if (pb !== undefined) return 1
    return a.ordinamento - b.ordinamento
  })
}

/**
 * Solo cio' che va disegnato: pagine e blocchi nascosti spariscono con tutto
 * il loro contenuto, i campi nascosti spariscono singolarmente.
 */
export function soloVisibili(pagine: LayoutPagina[]): LayoutPagina[] {
  return pagine
    .filter((pagina) => pagina.visible)
    .map((pagina) => ({
      ...pagina,
      blocchi: pagina.blocchi
        .filter((blocco) => blocco.visible)
        .map((blocco) => ({
          ...blocco,
          campi: blocco.campi.filter((campo) => campo.visible),
        })),
    }))
}

/**
 * Lo stesso campo in due blocchi mostrerebbe il dato due volte in scheda.
 * Il vincolo attraversa blocco -> pagina, quindi non e' un unique di tabella:
 * lo verifica il backend prima di salvare. Torna le chiavi duplicate.
 */
export function campiDuplicati(pagine: LayoutPagina[]): string[] {
  const visti = new Set<string>()
  const duplicati = new Set<string>()
  for (const pagina of pagine) {
    for (const blocco of pagina.blocchi) {
      for (const campo of blocco.campi) {
        const chiave = `${campo.origine}:${campo.fieldKey}`
        if (visti.has(chiave)) duplicati.add(chiave)
        visti.add(chiave)
      }
    }
  }
  return [...duplicati]
}
