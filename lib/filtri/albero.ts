/**
 * Filtri componibili: la struttura.
 *
 * Un filtro e' un albero. Un gruppo tiene insieme dei nodi con un
 * connettore — tutti in E oppure tutti in O — e ogni nodo puo' essere una
 * condizione o, a sua volta, un altro gruppo. L'annidamento non ha limiti
 * di forma: serve a esprimere cose come
 *
 *   (Sede e' Catania OPPURE Sede e' Palermo) E Stato e' Contattato
 *
 * che una lista piatta di condizioni non sa dire.
 *
 * Le condizioni arrivano dal browser e diventano un'interrogazione al
 * database: qui non ci si fida di nulla. Campo e operatore devono comparire
 * nel catalogo dei campi ammessi del modulo, e i valori vengono trattati
 * come dati, mai come pezzi di query.
 */

export type Connettore = "e" | "o"

export type OperatoreTesto =
  | "contiene"
  | "non_contiene"
  | "uguale"
  | "diverso"
  | "inizia_con"
  | "vuoto"
  | "non_vuoto"

export type OperatoreElenco = "uno_di" | "nessuno_di" | "vuoto" | "non_vuoto"
export type OperatoreNumero =
  | "uguale"
  | "diverso"
  | "maggiore"
  | "minore"
  | "fra"
  | "vuoto"
  | "non_vuoto"
export type OperatoreData =
  | "uguale"
  | "prima"
  | "dopo"
  | "fra"
  | "ultimi_giorni"
  | "vuoto"
  | "non_vuoto"
export type OperatoreBooleano = "vero" | "falso"
export type OperatoreCollegato = "presente" | "assente"

export type Operatore =
  | OperatoreTesto
  | OperatoreElenco
  | OperatoreNumero
  | OperatoreData
  | OperatoreBooleano
  | OperatoreCollegato

/** Il tipo del campo decide quali operatori hanno senso. */
export type TipoCampo = "testo" | "elenco" | "numero" | "data" | "booleano" | "collegato"

export const OPERATORI_PER_TIPO: Record<TipoCampo, readonly Operatore[]> = {
  testo: ["contiene", "non_contiene", "uguale", "diverso", "inizia_con", "vuoto", "non_vuoto"],
  elenco: ["uno_di", "nessuno_di", "vuoto", "non_vuoto"],
  numero: ["uguale", "diverso", "maggiore", "minore", "fra", "vuoto", "non_vuoto"],
  data: ["uguale", "prima", "dopo", "fra", "ultimi_giorni", "vuoto", "non_vuoto"],
  booleano: ["vero", "falso"],
  // I collegati non sono colonne: sono domande su altre tabelle ("ha
  // attivita' aperte?"), e l'unica cosa sensata da chiedere e' se ce ne
  // sono o no.
  collegato: ["presente", "assente"],
}

/** Operatori che non vogliono valori: chiederli sarebbe un errore. */
const SENZA_VALORE: ReadonlySet<Operatore> = new Set([
  "vuoto",
  "non_vuoto",
  "vero",
  "falso",
  "presente",
  "assente",
])

export function operatoreSenzaValore(operatore: Operatore): boolean {
  return SENZA_VALORE.has(operatore)
}

export type Condizione = {
  tipo: "condizione"
  /** Chiave del campo, come compare nel catalogo del modulo. */
  campo: string
  operatore: Operatore
  /** Valori dell'operatore. Vuoto per gli operatori che non ne vogliono. */
  valori: (string | number | boolean)[]
}

export type Gruppo = {
  tipo: "gruppo"
  connettore: Connettore
  nodi: Nodo[]
}

export type Nodo = Condizione | Gruppo

/** Un campo filtrabile, come lo dichiara il modulo. */
export type CampoFiltrabile = {
  chiave: string
  etichetta: string
  tipo: TipoCampo
  /** Valori ammessi, per i campi a elenco. */
  opzioni?: readonly string[]
}

export const GRUPPO_VUOTO: Gruppo = { tipo: "gruppo", connettore: "e", nodi: [] }

/**
 * Tetti tecnici, non funzionali.
 *
 * L'annidamento e' libero per chi compone un filtro dall'interfaccia: a
 * dieci livelli non ci arriva nessuno. Servono contro un albero costruito
 * ad arte e spedito all'endpoint, che senza un limite terrebbe occupato il
 * server a tradurre ricorsivamente il nulla.
 */
export const PROFONDITA_MASSIMA = 10
export const CONDIZIONI_MASSIME = 100

export type EsitoValidazione =
  | { ok: true; gruppo: Gruppo }
  | { ok: false; errore: string }

function valoreSemplice(valore: unknown): valore is string | number | boolean {
  return (
    typeof valore === "string" || typeof valore === "number" || typeof valore === "boolean"
  )
}

/**
 * Controlla un albero ricevuto dall'esterno e ne restituisce una copia
 * ripulita: solo campi presenti nel catalogo, solo operatori compatibili
 * con il loro tipo, solo valori semplici.
 *
 * Non corregge in silenzio: un campo sconosciuto o un operatore incompatibile
 * fanno fallire tutto. Scartare la condizione e proseguire darebbe all'utente
 * una lista filtrata in modo diverso da quello che ha chiesto, senza dirglielo.
 */
export function validaAlbero(
  grezzo: unknown,
  catalogo: readonly CampoFiltrabile[],
): EsitoValidazione {
  const perChiave = new Map(catalogo.map((campo) => [campo.chiave, campo]))
  let condizioni = 0

  function nodo(valore: unknown, profondita: number): Nodo | string {
    if (profondita > PROFONDITA_MASSIMA) return "Filtro annidato troppo in profondita'"
    if (!valore || typeof valore !== "object") return "Nodo del filtro non valido"

    const oggetto = valore as Record<string, unknown>

    if (oggetto.tipo === "gruppo") {
      const connettore = oggetto.connettore
      if (connettore !== "e" && connettore !== "o") return "Connettore non valido"
      if (!Array.isArray(oggetto.nodi)) return "Gruppo senza nodi"

      const nodi: Nodo[] = []
      for (const figlio of oggetto.nodi) {
        const esito = nodo(figlio, profondita + 1)
        if (typeof esito === "string") return esito
        nodi.push(esito)
      }
      return { tipo: "gruppo", connettore, nodi }
    }

    if (oggetto.tipo !== "condizione") return "Nodo del filtro non riconosciuto"

    condizioni += 1
    if (condizioni > CONDIZIONI_MASSIME) return "Troppe condizioni nel filtro"

    const campo = typeof oggetto.campo === "string" ? perChiave.get(oggetto.campo) : undefined
    if (!campo) return `Campo non filtrabile: ${String(oggetto.campo)}`

    const operatore = oggetto.operatore as Operatore
    if (!OPERATORI_PER_TIPO[campo.tipo].includes(operatore)) {
      return `Operatore non valido per ${campo.etichetta}`
    }

    const valori = Array.isArray(oggetto.valori) ? oggetto.valori.filter(valoreSemplice) : []

    if (operatoreSenzaValore(operatore)) {
      return { tipo: "condizione", campo: campo.chiave, operatore, valori: [] }
    }

    if (!valori.length) return `Manca il valore per ${campo.etichetta}`
    if ((operatore === "fra") && valori.length !== 2) {
      return `${campo.etichetta}: servono due valori`
    }
    // Un campo a elenco accetta solo i suoi valori: cosi' non si puo'
    // interrogare il database con un valore inventato.
    if (campo.opzioni) {
      const ammessi = new Set(campo.opzioni)
      for (const valore of valori) {
        if (!ammessi.has(String(valore))) {
          return `${campo.etichetta}: valore non ammesso`
        }
      }
    }

    return { tipo: "condizione", campo: campo.chiave, operatore, valori }
  }

  const esito = nodo(grezzo, 0)
  if (typeof esito === "string") return { ok: false, errore: esito }
  if (esito.tipo !== "gruppo") return { ok: false, errore: "Il filtro deve partire da un gruppo" }
  return { ok: true, gruppo: esito }
}

/** Quante condizioni contiene un filtro, per il contatore accanto al pulsante. */
export function contaCondizioni(nodo: Nodo): number {
  if (nodo.tipo === "condizione") return 1
  return nodo.nodi.reduce((somma, figlio) => somma + contaCondizioni(figlio), 0)
}

/**
 * Toglie i gruppi rimasti senza condizioni.
 *
 * Comporre un filtro lascia spesso gruppi aperti e mai riempiti: tradotti
 * cosi' come sono darebbero condizioni vuote, che il database interpreta
 * come "nessun risultato" invece che "nessun vincolo".
 */
export function potaVuoti(gruppo: Gruppo): Gruppo {
  const nodi: Nodo[] = []
  for (const figlio of gruppo.nodi) {
    if (figlio.tipo === "condizione") {
      nodi.push(figlio)
      continue
    }
    const potato = potaVuoti(figlio)
    if (potato.nodi.length) nodi.push(potato)
  }
  return { ...gruppo, nodi }
}
