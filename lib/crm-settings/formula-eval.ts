/**
 * Valutazione delle formule dei campi calcolati.
 *
 * Le espressioni arrivano dalla configurazione del layout, che un admin puo'
 * modificare da interfaccia. Per questo NON si usa eval() ne' new Function():
 * significherebbe eseguire codice arbitrario scritto da chi ha accesso alla
 * pagina Layout, con i permessi del server. Qui c'e' un parser che riconosce
 * soltanto il linguaggio descritto sotto, e tutto il resto e' errore.
 *
 * Linguaggio riconosciuto, ricalcato su quello che Zoho usa davvero nelle
 * formule del modulo Clienti:
 *
 *   {Nome Campo}              riferimento a un altro campo
 *   123  1.5  0.35            numeri
 *   'testo'  "testo"          stringhe
 *   + - * /                   aritmetica
 *   ( )                       raggruppamento
 *   == !=                     confronto
 *   If(cond, allora, altrimenti)
 *
 * Volutamente niente altro: ogni costrutto in piu' andrebbe prima trovato
 * davvero in una formula Zoho, poi implementato con il suo comportamento
 * verificato — non aggiunto per simmetria.
 */

export type ValoreFormula = number | string | boolean | null

export type EsitoValutazione =
  | { ok: true; valore: ValoreFormula }
  | { ok: false; errore: string }

/* ------------------------------------------------------------------ lexer */

type Token =
  | { tipo: "numero"; valore: number }
  | { tipo: "stringa"; valore: string }
  | { tipo: "campo"; nome: string }
  | { tipo: "identificatore"; nome: string }
  | { tipo: "operatore"; valore: string }
  | { tipo: "fine" }

function tokenizza(expr: string): Token[] | { errore: string } {
  const token: Token[] = []
  let i = 0

  while (i < expr.length) {
    const c = expr[i]

    if (/\s/.test(c)) {
      i += 1
      continue
    }

    // {Nome Campo}
    if (c === "{") {
      const fine = expr.indexOf("}", i)
      if (fine === -1) return { errore: "Riferimento a campo non chiuso" }
      const nome = expr.slice(i + 1, fine).trim()
      if (!nome) return { errore: "Riferimento a campo vuoto" }
      token.push({ tipo: "campo", nome })
      i = fine + 1
      continue
    }

    // 'testo' oppure "testo"
    if (c === "'" || c === '"') {
      const fine = expr.indexOf(c, i + 1)
      if (fine === -1) return { errore: "Stringa non chiusa" }
      token.push({ tipo: "stringa", valore: expr.slice(i + 1, fine) })
      i = fine + 1
      continue
    }

    if (/[0-9]/.test(c)) {
      let j = i
      while (j < expr.length && /[0-9.]/.test(expr[j])) j += 1
      const testo = expr.slice(i, j)
      const numero = Number(testo)
      if (!Number.isFinite(numero)) return { errore: `Numero non valido: ${testo}` }
      token.push({ tipo: "numero", valore: numero })
      i = j
      continue
    }

    if (/[A-Za-z_]/.test(c)) {
      let j = i
      while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j])) j += 1
      token.push({ tipo: "identificatore", nome: expr.slice(i, j) })
      i = j
      continue
    }

    if (expr.startsWith("==", i) || expr.startsWith("!=", i)) {
      token.push({ tipo: "operatore", valore: expr.slice(i, i + 2) })
      i += 2
      continue
    }

    if ("+-*/(),".includes(c)) {
      token.push({ tipo: "operatore", valore: c })
      i += 1
      continue
    }

    return { errore: `Carattere non riconosciuto: ${c}` }
  }

  token.push({ tipo: "fine" })
  return token
}

/* ----------------------------------------------------------------- parser */

type Nodo =
  | { tipo: "numero"; valore: number }
  | { tipo: "stringa"; valore: string }
  | { tipo: "campo"; nome: string }
  | { tipo: "binario"; op: string; sinistra: Nodo; destra: Nodo }
  | { tipo: "negazione"; operando: Nodo }
  | { tipo: "se"; condizione: Nodo; allora: Nodo; altrimenti: Nodo }

class ErroreParsing extends Error {}

/**
 * Discesa ricorsiva. Precedenze, dalla piu' bassa: confronto, addizione,
 * moltiplicazione, unario, primario.
 */
function analizza(token: Token[]): Nodo {
  let posizione = 0

  const corrente = () => token[posizione]

  function consuma(valore: string) {
    const t = corrente()
    if (t.tipo !== "operatore" || t.valore !== valore) {
      throw new ErroreParsing(`Atteso '${valore}'`)
    }
    posizione += 1
  }

  function confronto(): Nodo {
    let sinistra = addizione()
    while (corrente().tipo === "operatore") {
      const t = corrente() as { tipo: "operatore"; valore: string }
      if (t.valore !== "==" && t.valore !== "!=") break
      posizione += 1
      sinistra = { tipo: "binario", op: t.valore, sinistra, destra: addizione() }
    }
    return sinistra
  }

  function addizione(): Nodo {
    let sinistra = moltiplicazione()
    while (corrente().tipo === "operatore") {
      const t = corrente() as { tipo: "operatore"; valore: string }
      if (t.valore !== "+" && t.valore !== "-") break
      posizione += 1
      sinistra = { tipo: "binario", op: t.valore, sinistra, destra: moltiplicazione() }
    }
    return sinistra
  }

  function moltiplicazione(): Nodo {
    let sinistra = unario()
    while (corrente().tipo === "operatore") {
      const t = corrente() as { tipo: "operatore"; valore: string }
      if (t.valore !== "*" && t.valore !== "/") break
      posizione += 1
      sinistra = { tipo: "binario", op: t.valore, sinistra, destra: unario() }
    }
    return sinistra
  }

  function unario(): Nodo {
    const t = corrente()
    if (t.tipo === "operatore" && t.valore === "-") {
      posizione += 1
      return { tipo: "negazione", operando: unario() }
    }
    return primario()
  }

  function primario(): Nodo {
    const t = corrente()

    if (t.tipo === "numero") {
      posizione += 1
      return { tipo: "numero", valore: t.valore }
    }

    if (t.tipo === "stringa") {
      posizione += 1
      return { tipo: "stringa", valore: t.valore }
    }

    if (t.tipo === "campo") {
      posizione += 1
      return { tipo: "campo", nome: t.nome }
    }

    if (t.tipo === "identificatore") {
      // L'unica funzione riconosciuta. Zoho la scrive "If"; il confronto e'
      // senza distinzione di maiuscole per tolleranza.
      if (t.nome.toLowerCase() !== "if") {
        throw new ErroreParsing(`Funzione non riconosciuta: ${t.nome}`)
      }
      posizione += 1
      consuma("(")
      const condizione = confronto()
      consuma(",")
      const allora = confronto()
      consuma(",")
      const altrimenti = confronto()
      consuma(")")
      return { tipo: "se", condizione, allora, altrimenti }
    }

    if (t.tipo === "operatore" && t.valore === "(") {
      posizione += 1
      const dentro = confronto()
      consuma(")")
      return dentro
    }

    throw new ErroreParsing("Espressione incompleta")
  }

  const radice = confronto()
  if (corrente().tipo !== "fine") {
    throw new ErroreParsing("Contenuto in eccesso alla fine dell'espressione")
  }
  return radice
}

/* -------------------------------------------------------------- valutazione */

/**
 * Un campo vuoto vale 0 nei calcoli.
 *
 * E' il comportamento di Zoho, dove un importo non compilato non azzera la
 * formula ma partecipa come zero. Cambiarlo qui vorrebbe dire che le stesse
 * pratiche darebbero numeri diversi prima e dopo la migrazione.
 */
function comeNumero(valore: ValoreFormula): number {
  if (typeof valore === "number") return valore
  if (typeof valore === "boolean") return valore ? 1 : 0
  if (valore === null || valore === "") return 0
  const numero = Number(String(valore).replace(",", "."))
  return Number.isFinite(numero) ? numero : 0
}

function uguali(a: ValoreFormula, b: ValoreFormula): boolean {
  // Confronto fra testi quando almeno uno dei due e' testo: le formule Zoho
  // confrontano la modalita' di pagamento con stringhe come '30-50-20', che
  // non vanno convertite in numero.
  if (typeof a === "string" || typeof b === "string") {
    return String(a ?? "") === String(b ?? "")
  }
  return comeNumero(a) === comeNumero(b)
}

function valuta(nodo: Nodo, valori: Map<string, ValoreFormula>): ValoreFormula {
  switch (nodo.tipo) {
    case "numero":
      return nodo.valore
    case "stringa":
      return nodo.valore
    case "campo": {
      // Un campo assente si comporta come vuoto: la scheda deve mostrare un
      // numero anche quando un dato non e' stato compilato.
      const valore = valori.get(nodo.nome)
      return valore === undefined ? null : valore
    }
    case "negazione":
      return -comeNumero(valuta(nodo.operando, valori))
    case "se":
      return valuta(nodo.condizione, valori)
        ? valuta(nodo.allora, valori)
        : valuta(nodo.altrimenti, valori)
    case "binario": {
      const sinistra = valuta(nodo.sinistra, valori)
      const destra = valuta(nodo.destra, valori)
      switch (nodo.op) {
        case "==":
          return uguali(sinistra, destra)
        case "!=":
          return !uguali(sinistra, destra)
        case "+":
          return comeNumero(sinistra) + comeNumero(destra)
        case "-":
          return comeNumero(sinistra) - comeNumero(destra)
        case "*":
          return comeNumero(sinistra) * comeNumero(destra)
        case "/": {
          const divisore = comeNumero(destra)
          // Divisione per zero: null invece di Infinity, cosi' la scheda
          // mostra un campo vuoto e non un valore assurdo.
          return divisore === 0 ? null : comeNumero(sinistra) / divisore
        }
        default:
          return null
      }
    }
  }
}

/**
 * Calcola una formula sui valori di un record.
 *
 * Non lancia mai: un errore torna come esito negativo, perche' una formula
 * scritta male in configurazione non deve far fallire il caricamento di una
 * scheda intera.
 */
export function valutaFormula(
  expr: string,
  valori: Map<string, ValoreFormula>,
): EsitoValutazione {
  const token = tokenizza(expr)
  if ("errore" in token) return { ok: false, errore: token.errore }

  try {
    const albero = analizza(token)
    return { ok: true, valore: valuta(albero, valori) }
  } catch (errore) {
    return {
      ok: false,
      errore: errore instanceof ErroreParsing ? errore.message : "Formula non valutabile",
    }
  }
}

/** I campi da cui dipende una formula, per sapere cosa serve avere in mano. */
export function dipendenzeFormula(expr: string): string[] {
  const token = tokenizza(expr)
  if ("errore" in token) return []
  const nomi = token.filter((t) => t.tipo === "campo").map((t) => (t as { nome: string }).nome)
  return [...new Set(nomi)]
}
