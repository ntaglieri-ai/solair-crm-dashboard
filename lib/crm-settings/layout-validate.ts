import { CAMPO_TIPI } from "@/lib/system-settings-data"
import type { LayoutFormato, LayoutFormula } from "./layout"

/**
 * Validazione delle scritture sul layout.
 *
 * Pure di proposito: la parte che decide cosa e' accettabile non deve avere
 * bisogno di un database per essere verificata. La route si limita a chiamare
 * queste funzioni e a scrivere il risultato.
 *
 * Regola generale: quello che arriva dal client e' un suggerimento, mai un
 * fatto. Chiavi, tipi e riferimenti vengono sempre ricontrollati qui.
 */

/**
 * Moduli che possono avere un layout configurabile.
 *
 * I nomi corrispondono alle tabelle in CRM_MODULE_TABLES: il layout descrive
 * le schede di questi record, quindi l'elenco non puo' divergere da quello
 * dei moduli che esistono davvero.
 */
export const LAYOUT_MODULI = ["clienti", "lead", "installatori", "compiti"] as const
export type LayoutModulo = (typeof LAYOUT_MODULI)[number]

export function isLayoutModulo(value: unknown): value is LayoutModulo {
  return typeof value === "string" && (LAYOUT_MODULI as readonly string[]).includes(value)
}

/**
 * Le chiavi (page_key, block_key) finiscono negli ancoraggi della navbar
 * (#section-...) e nei riferimenti del codice: restano minuscole, senza
 * spazi, stabili anche quando l'etichetta viene rinominata.
 */
export function isChiaveValida(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{0,62}$/.test(value)
}

/** Deriva una chiave da un'etichetta scritta a mano dall'admin. */
export function chiaveDaEtichetta(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
}

export function isEtichettaValida(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 120
}

export function isTipoValido(value: unknown): boolean {
  return typeof value === "string" && (CAMPO_TIPI as readonly string[]).includes(value)
}

/** Intero dentro un intervallo, rifiutando NaN e decimali. */
export function intInRange(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null
  if (value < min || value > max) return null
  return value
}

/**
 * Normalizza il blocco `formato`.
 *
 * Whitelist stretta: il jsonb finisce in una colonna che poi guida la resa in
 * scheda, e non deve poter accogliere chiavi arbitrarie inviate dal client.
 */
export function normalizzaFormato(value: unknown): LayoutFormato {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const raw = value as Record<string, unknown>
  const formato: LayoutFormato = {}

  const decimali = intInRange(raw.decimali, 0, 6)
  if (decimali !== null) formato.decimali = decimali

  // Codice valuta ISO: tre lettere, niente testo libero.
  if (typeof raw.valuta === "string" && /^[A-Z]{3}$/.test(raw.valuta)) {
    formato.valuta = raw.valuta
  }

  if (typeof raw.placeholder === "string" && raw.placeholder.length <= 40) {
    formato.placeholder = raw.placeholder
  }

  return formato
}

/**
 * I riferimenti ai campi dentro un'espressione: {Nome Campo}.
 *
 * L'espressione NON viene eseguita qui e non viene ristretta nel contenuto:
 * le formule Zoho da tradurre non sono ancora state esportate
 * (GET settings/fields), quindi non si sa se usino solo aritmetica o anche
 * funzioni. Decidere ora cosa e' ammesso vorrebbe dire vincolare la
 * traduzione prima di sapere cosa deve esprimere, e rifiutare al
 * salvataggio formule perfettamente legittime.
 *
 * Qui si controlla solo che l'espressione sia strutturalmente sana. Le
 * restrizioni di contenuto hanno senso al momento della valutazione — dove
 * contano davvero per la sicurezza — e verranno definite quando sapremo cosa
 * arriva da Zoho.
 */
const RIFERIMENTO = /\{([^{}]+)\}/g

export type EsitoFormula =
  | { ok: true; formula: LayoutFormula; riferimenti: string[] }
  | { ok: false; errore: string }

/** Delimitatori bilanciati: un'espressione sbilanciata e' un refuso, non una scelta. */
function bilanciati(expr: string, apre: string, chiude: string): boolean {
  let aperti = 0
  for (const carattere of expr) {
    if (carattere === apre) aperti += 1
    if (carattere === chiude) aperti -= 1
    if (aperti < 0) return false
  }
  return aperti === 0
}

/**
 * Controlla la forma di un'espressione ed estrae i campi referenziati.
 *
 * Volutamente permissiva sul contenuto: intercetta i refusi (parentesi o
 * graffe non chiuse, riferimenti vuoti) senza pronunciarsi su quali
 * operazioni siano lecite.
 */
export function validaFormula(value: unknown): EsitoFormula {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errore: "Formula assente o malformata" }
  }
  const raw = value as Record<string, unknown>
  const expr = typeof raw.expr === "string" ? raw.expr.trim() : ""
  if (!expr) return { ok: false, errore: "Espressione vuota" }
  if (expr.length > 2000) return { ok: false, errore: "Espressione troppo lunga" }

  if (!bilanciati(expr, "{", "}")) {
    return { ok: false, errore: "Graffe non bilanciate: un riferimento {Campo} non e' chiuso" }
  }
  if (!bilanciati(expr, "(", ")")) {
    return { ok: false, errore: "Parentesi non bilanciate" }
  }

  // Graffe vuote: il regex dei riferimenti richiede almeno un carattere e le
  // salterebbe in silenzio, lasciando passare un refuso.
  if (/\{\s*\}/.test(expr)) {
    return { ok: false, errore: "Riferimento a campo vuoto: {}" }
  }

  const riferimenti: string[] = []
  let match: RegExpExecArray | null
  RIFERIMENTO.lastIndex = 0
  while ((match = RIFERIMENTO.exec(expr)) !== null) {
    const nome = match[1].trim()
    if (!nome) return { ok: false, errore: "Riferimento a campo vuoto: {}" }
    riferimenti.push(nome)
  }

  const formula: LayoutFormula = { expr }
  if (typeof raw.origine_zoho === "string" && raw.origine_zoho.trim()) {
    formula.origine_zoho = raw.origine_zoho.trim().slice(0, 2000)
  }

  return { ok: true, formula, riferimenti: [...new Set(riferimenti)] }
}

/**
 * Segnala se una formula si riferisce al campo che sta definendo.
 *
 * Non blocca il salvataggio: e' una condizione che conta al momento della
 * valutazione (un valore che dipende da se stesso non e' calcolabile), e
 * finche' non si valuta nulla non c'e' motivo di rifiutare l'import di una
 * formula che arriva da Zoho.
 */
export function formulaAutoReferenziale(fieldKey: string, riferimenti: string[]): boolean {
  return riferimenti.includes(fieldKey)
}
