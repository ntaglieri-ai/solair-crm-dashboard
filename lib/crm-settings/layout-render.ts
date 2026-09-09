import { valutaFormula, type ValoreFormula } from "./formula-eval"
import type { LayoutCampo, LayoutFormato, LayoutPagina } from "./layout"

/**
 * Logica di resa di un layout configurato, separata dalla UI.
 *
 * Sta qui e non nel componente perche' e' la parte che va verificata: come si
 * calcola un campo con formula e come si formatta un valore decidono i numeri
 * che l'utente legge sulla scheda.
 */

/**
 * I valori del record indicizzati per etichetta di campo.
 *
 * Le formule si riferiscono ai campi per etichetta ({Importo Contrattuale}),
 * mentre il record li espone per chiave applicativa. Nel nostro caso le due
 * cose coincidono — le chiavi del layout SONO le etichette Zoho — ma la mappa
 * resta il punto unico da cambiare se un domani divergessero.
 */
export function mappaValori(record: Record<string, unknown>): Map<string, ValoreFormula> {
  const mappa = new Map<string, ValoreFormula>()
  for (const [chiave, valore] of Object.entries(record)) {
    if (
      valore === null ||
      typeof valore === "string" ||
      typeof valore === "number" ||
      typeof valore === "boolean"
    ) {
      mappa.set(chiave, valore)
    }
  }
  return mappa
}

export type ValoreCampo =
  | { stato: "valore"; valore: unknown }
  | { stato: "calcolato"; valore: ValoreFormula }
  | { stato: "errore"; messaggio: string }

/**
 * Il valore da mostrare per un campo.
 *
 * Un campo con formula viene calcolato al momento: non c'e' una colonna che
 * lo contiene, e non deve essercene una, altrimenti tornerebbe il problema di
 * tenere allineati valore e dipendenze a ogni modifica.
 *
 * Una formula rotta non fa saltare la scheda: torna un errore che il
 * componente mostra come tale, mentre tutti gli altri campi restano leggibili.
 */
export function valoreCampo(
  campo: LayoutCampo,
  record: Record<string, unknown>,
  valori: Map<string, ValoreFormula>,
): ValoreCampo {
  if (campo.formula) {
    const esito = valutaFormula(campo.formula.expr, valori)
    return esito.ok
      ? { stato: "calcolato", valore: esito.valore }
      : { stato: "errore", messaggio: esito.errore }
  }
  return { stato: "valore", valore: record[campo.fieldKey] }
}

/**
 * Formatta un valore per la lettura.
 *
 * Locale italiano: separatore delle migliaia e virgola decimale, come nel
 * resto del CRM e come mostrava Zoho.
 */
export function formattaValore(
  valore: unknown,
  formato: LayoutFormato,
  tipo?: string,
): string {
  const vuoto = formato.placeholder ?? "—"

  if (valore === null || valore === undefined || valore === "") return vuoto
  if (typeof valore === "boolean") return valore ? "Sì" : "No"

  // Diversi campi booleani arrivano dal database come testo ("true"/"false"):
  // e' un residuo dell'import Zoho, dove le colonne erano stringhe. Senza
  // questo la scheda mostrerebbe "true" al posto di "Sì".
  if (valore === "true") return "Sì"
  if (valore === "false") return "No"

  // Date e timestamp arrivano in forma ISO ("2026-07-28T12:00:00+00:00").
  // Mostrarli cosi' com'e' costringe a decifrare fuso e millisecondi per
  // leggere un giorno: si stampa la data, e l'ora solo quando non e'
  // mezzanotte, cioe' quando qualcuno l'ha davvero indicata.
  if (typeof valore === "string") {
    const iso = valore.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/)
    if (iso) {
      const [, anno, mese, giorno, ore, minuti] = iso
      const data = `${giorno}/${mese}/${anno}`
      return ore && !(ore === "00" && minuti === "00") ? `${data} ${ore}:${minuti}` : data
    }
  }

  if (typeof valore === "number") {
    if (!Number.isFinite(valore)) return vuoto
    const decimali = formato.decimali
    const testo = valore.toLocaleString("it-IT", {
      minimumFractionDigits: decimali ?? 0,
      maximumFractionDigits: decimali ?? 2,
      // L'italiano non raggrupperebbe i numeri di quattro cifre: 9895 resta
      // "9895" e solo da 10.000 in su compare il punto. Zoho invece li
      // raggruppava sempre (sulle stampe delle schede si legge "9.895"), e
      // chi legge questi importi tutti i giorni e' abituato cosi'.
      useGrouping: "always",
    })
    if (tipo === "currency") return `${testo} ${formato.valuta ?? "€"}`.trim()
    if (tipo === "percent") return `${testo}%`
    return testo
  }

  return String(valore)
}

/**
 * Un campo e' modificabile a mano solo se non e' calcolato e non e' stato
 * congelato dall'admin. I calcolati non lo sono per definizione: il valore
 * viene dalla formula.
 */
export function campoScrivibile(campo: LayoutCampo): boolean {
  return !campo.solaLettura && campo.formula === null
}

/**
 * Le pagine che hanno davvero qualcosa da mostrare.
 *
 * Una pagina senza componente dedicato e senza campi visibili resterebbe una
 * voce di navbar che porta al vuoto: meglio non disegnarla affatto.
 */
export function paginePiene(pagine: LayoutPagina[]): LayoutPagina[] {
  return pagine.filter(
    (pagina) =>
      pagina.componente !== null ||
      pagina.blocchi.some((blocco) => blocco.campi.length > 0),
  )
}

/**
 * L'ancora usata dai link della navbar e dallo scroll verso una sezione.
 * Deriva dalla page_key, che resta stabile anche se l'etichetta cambia.
 */
export function ancoraPagina(pageKey: string): string {
  return `section-${pageKey}`
}
