import {
  operatoreSenzaValore,
  type CampoFiltrabile,
  type Condizione,
  type Gruppo,
  type Nodo,
} from "./albero"

/**
 * Dall'albero del filtro all'interrogazione.
 *
 * PostgREST esprime E/O annidati con una stringa: `and(a.eq.1,or(b.eq.2,c.eq.3))`.
 * Il filtro resta quindi una sola interrogazione al database, senza scaricare
 * le righe e scartarle in memoria — su diecimila lead la differenza si vede.
 *
 * Il rischio sta nei valori: finiscono dentro quella stringa, dove virgole e
 * parentesi hanno significato. Un valore che le contiene, se lasciato
 * passare, cambia la struttura della condizione. Per questo ogni valore
 * viene racchiuso fra virgolette e le virgolette interne raddoppiate — e i
 * nomi di colonna non arrivano mai dall'esterno, ma dal catalogo.
 */

export type EsitoTraduzione =
  | { ok: true; espressione: string | null }
  | { ok: false; errore: string }

/**
 * Un valore dentro l'espressione PostgREST.
 *
 * Le virgolette delimitano il valore, quindi virgole e parentesi al suo
 * interno smettono di essere separatori. Le virgolette che il valore
 * contiene davvero si raddoppiano, altrimenti chiuderebbero il valore a
 * meta' e il resto verrebbe letto come sintassi.
 */
function valoreSicuro(valore: string | number | boolean): string {
  if (typeof valore === "boolean") return valore ? "true" : "false"
  if (typeof valore === "number") {
    if (!Number.isFinite(valore)) return "0"
    return String(valore)
  }
  return `"${valore.replace(/"/g, '""')}"`
}

/** Come sopra, ma per i valori dentro `in.(...)`, che vuole le parentesi. */
function elencoSicuro(valori: (string | number | boolean)[]): string {
  return `(${valori.map((valore) => valoreSicuro(valore)).join(",")})`
}

function giorniFa(giorni: number): string {
  const data = new Date()
  data.setDate(data.getDate() - giorni)
  return data.toISOString()
}

function condizione(
  nodo: Condizione,
  colonnaPer: (chiave: string) => string | null,
): string | null {
  const colonna = colonnaPer(nodo.campo)
  // Nessuna colonna: e' un campo su una tabella collegata, tradotto altrove.
  if (!colonna) return null

  const [primo, secondo] = nodo.valori
  if (!operatoreSenzaValore(nodo.operatore) && primo === undefined) return null

  switch (nodo.operatore) {
    case "contiene":
      return `${colonna}.ilike.${valoreSicuro(`%${String(primo)}%`)}`
    case "non_contiene":
      return `${colonna}.not.ilike.${valoreSicuro(`%${String(primo)}%`)}`
    case "inizia_con":
      return `${colonna}.ilike.${valoreSicuro(`${String(primo)}%`)}`
    case "uguale":
      return `${colonna}.eq.${valoreSicuro(primo!)}`
    case "diverso":
      return `${colonna}.neq.${valoreSicuro(primo!)}`
    case "uno_di":
      return `${colonna}.in.${elencoSicuro(nodo.valori)}`
    case "nessuno_di":
      return `${colonna}.not.in.${elencoSicuro(nodo.valori)}`
    case "maggiore":
    case "dopo":
      return `${colonna}.gt.${valoreSicuro(primo!)}`
    case "minore":
    case "prima":
      return `${colonna}.lt.${valoreSicuro(primo!)}`
    case "fra":
      // Estremi inclusi: chi scrive "fra 10 e 20" si aspetta che 10 e 20 ci
      // siano.
      return `and(${colonna}.gte.${valoreSicuro(primo!)},${colonna}.lte.${valoreSicuro(secondo!)})`
    case "ultimi_giorni":
      return `${colonna}.gte.${valoreSicuro(giorniFa(Number(primo) || 0))}`
    case "vero":
      return `${colonna}.is.true`
    case "falso":
      // Un booleano non compilato vale "no" per chi guarda la scheda: senza
      // questo, filtrare "e' no" perderebbe tutte le righe mai toccate.
      return `or(${colonna}.is.false,${colonna}.is.null)`
    case "vuoto":
      return `${colonna}.is.null`
    case "non_vuoto":
      return `${colonna}.not.is.null`
    default:
      return null
  }
}

function nodoTradotto(
  nodo: Nodo,
  colonnaPer: (chiave: string) => string | null,
): string | null {
  if (nodo.tipo === "condizione") return condizione(nodo, colonnaPer)

  const pezzi = nodo.nodi
    .map((figlio) => nodoTradotto(figlio, colonnaPer))
    .filter((pezzo): pezzo is string => pezzo !== null)

  if (!pezzi.length) return null
  // Un gruppo con un solo figlio non ha bisogno di involucro: `and(x)` e `x`
  // dicono la stessa cosa, e senza involucro l'espressione resta leggibile.
  if (pezzi.length === 1) return pezzi[0]

  return `${nodo.connettore === "o" ? "or" : "and"}(${pezzi.join(",")})`
}

/**
 * Traduce un albero gia' validato.
 *
 * Torna `null` quando non c'e' nulla da filtrare: un filtro vuoto non deve
 * diventare una condizione impossibile, deve semplicemente non esserci.
 */
export function traduciAlbero(
  gruppo: Gruppo,
  catalogo: readonly CampoFiltrabile[],
  colonnaPerCampo: Record<string, string>,
): EsitoTraduzione {
  const conosciuti = new Set(catalogo.map((campo) => campo.chiave))

  const colonnaPer = (chiave: string): string | null => {
    // Doppia rete: la chiave deve stare nel catalogo E avere una colonna
    // dichiarata. Nessun nome di colonna arriva mai da fuori.
    if (!conosciuti.has(chiave)) return null
    return colonnaPerCampo[chiave] ?? null
  }

  try {
    return { ok: true, espressione: nodoTradotto(gruppo, colonnaPer) }
  } catch (errore) {
    return {
      ok: false,
      errore: errore instanceof Error ? errore.message : "Filtro non traducibile",
    }
  }
}

/**
 * Le condizioni sui collegati ("ha attivita' aperte"), che non sono colonne
 * del record ma domande su altre tabelle.
 *
 * Restano fuori dall'espressione e vengono raccolte qui: chi interroga il
 * database le risolve con una lettura a parte e restringe per identificativo.
 */
export function condizioniCollegate(gruppo: Gruppo): Condizione[] {
  const trovate: Condizione[] = []
  function visita(nodo: Nodo) {
    if (nodo.tipo === "condizione") {
      if (nodo.operatore === "presente" || nodo.operatore === "assente") trovate.push(nodo)
      return
    }
    nodo.nodi.forEach(visita)
  }
  visita(gruppo)
  return trovate
}
