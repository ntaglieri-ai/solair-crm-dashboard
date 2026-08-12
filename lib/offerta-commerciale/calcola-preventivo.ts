/**
 * Calcolo centralizzato del prezzo di una configurazione commerciale.
 *
 * Fino ad ora la formula viveva solo come espressioni inline nel tab "calcolo"
 * di offerta-commerciale-client.tsx: non riusabile, non testabile, non
 * raggiungibile dal sito. Qui e' la stessa aritmetica, con due differenze
 * volute:
 *
 *  - la batteria si indica in kWh reali, non come indice posizionale
 *    nell'array `taglie` della marca (l'indice resta un dettaglio interno del
 *    formato listino, non un parametro dell'API);
 *  - i codici sconto entrano nel calcolo, cosa che la UI non fa ancora.
 *
 * L'ordine delle operazioni e' quello del listino: lo sconto colpisce
 * fotovoltaico + accumulo, l'EPS si somma dopo e non viene mai scontato.
 */

import type { CatalogoCommerciale, CodiceSconto, MatriceAccumulo, RegolaSconto } from "./types"

/** Solo le sezioni del catalogo che servono al calcolo. */
export type CatalogoPerCalcolo = Pick<
  CatalogoCommerciale,
  "fotovoltaico" | "accumuli" | "sconti" | "codici_sconto"
>

export type IngressoPreventivo = {
  kwp: number
  batteria_marca: string
  batteria_kwh: number
  zona: string
  eps?: boolean
  eps_gift?: boolean
  codice_sconto?: string | null
}

export type EsitoPreventivo = {
  prezzo_base: number
  sovrapprezzo_batteria: number
  prezzo_totale_prima_sconto: number
  /** Percentuale di zona effettivamente entrata nel calcolo (0 se sostituita da un codice non cumulabile). */
  sconto_zona_applicato: number
  /** Il codice che ha modificato il prezzo, null se assente/ignorato. */
  codice_sconto_applicato: CodiceSconto | null
  sconto_percentuale_finale: number
  sconto_importo: number
  eps_prezzo: number
  eps_omaggio: boolean
  prezzo_totale: number
  /** Scostamenti non bloccanti: zona senza regola, codice ignorato, sconto limitato al 100%. */
  avvisi: string[]
}

export type MotivoErrorePreventivo =
  | "kwp_non_disponibile"
  | "marca_non_disponibile"
  | "taglia_non_disponibile"
  | "combinazione_non_a_listino"

/** Input incompatibile con il listino pubblicato: il chiamante lo mappa su un 400. */
export class ErrorePreventivo extends Error {
  readonly motivo: MotivoErrorePreventivo
  readonly disponibili: (string | number)[]

  constructor(motivo: MotivoErrorePreventivo, message: string, disponibili: (string | number)[] = []) {
    super(message)
    this.name = "ErrorePreventivo"
    this.motivo = motivo
    this.disponibili = disponibili
  }
}

// Le taglie sono decimali (5.8, 12.9, 21.4): il confronto esatto tra float
// non e' affidabile, stessa tolleranza usata in parse-listino.ts.
const TOLLERANZA_KWH = 0.001

/** Stessa normalizzazione applicata in fase di salvataggio (store.ts). */
export function normalizzaCodiceSconto(value: string): string {
  return value.trim().slice(0, 40).toUpperCase().replace(/\s+/g, "-")
}

function arrotonda(value: number): number {
  return Math.round(value * 100) / 100
}

function confronta(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase("it-IT") === b.trim().toLocaleLowerCase("it-IT")
}

/** Marca di accumulo, con match tollerante su maiuscole/spazi. */
export function trovaAccumulo(catalogo: CatalogoPerCalcolo, marca: string): MatriceAccumulo | null {
  return catalogo.accumuli.find((item) => confronta(item.marca, marca)) ?? null
}

/** Regola di sconto per zona e potenza; null se nessuna copre la combinazione. */
export function trovaRegolaZona(
  catalogo: CatalogoPerCalcolo,
  zona: string,
  kwp: number,
): RegolaSconto | null {
  return catalogo.sconti.find(
    (rule) => confronta(rule.zona, zona) && kwp >= rule.kwp_min && kwp <= rule.kwp_max,
  ) ?? null
}

/**
 * Codice sconto attivo corrispondente. Restituisce anche il motivo dello
 * scarto, cosi' il chiamante puo' dire al cliente perche' il codice non ha
 * cambiato il prezzo invece di mostrargli in silenzio l'importo pieno.
 */
function risolviCodice(
  catalogo: CatalogoPerCalcolo,
  richiesto: string,
): { codice: CodiceSconto | null; avviso: string | null } {
  const cercato = normalizzaCodiceSconto(richiesto)
  const trovato = (catalogo.codici_sconto ?? []).find((item) => item.codice === cercato)

  if (!trovato) return { codice: null, avviso: `Codice sconto "${cercato}" non riconosciuto.` }
  if (!trovato.attivo) return { codice: null, avviso: `Codice sconto "${cercato}" non piu' attivo.` }

  // Solo i codici a percentuale hanno oggi un effetto sul totale.
  // TODO: definire l'impatto di tipo "importo" (sconto in euro) e "omaggio"
  // (accessorio incluso): finche' non e' deciso, il prezzo resta quello pieno
  // e lo si dichiara nell'avviso invece di far finta che lo sconto ci sia.
  if (trovato.tipo !== "percentuale") {
    return {
      codice: null,
      avviso: `Codice sconto "${cercato}" di tipo "${trovato.tipo}": nessun effetto automatico sul totale.`,
    }
  }
  if (!trovato.valore || trovato.valore <= 0) {
    return { codice: null, avviso: `Codice sconto "${cercato}" senza percentuale valorizzata.` }
  }

  return { codice: trovato, avviso: null }
}

/**
 * Prezzo di una configurazione, con il dettaglio di come ci si arriva.
 *
 * Lancia ErrorePreventivo se la combinazione non esiste nel listino.
 */
export function calcolaPreventivo(
  catalogo: CatalogoPerCalcolo,
  ingresso: IngressoPreventivo,
): EsitoPreventivo {
  const avvisi: string[] = []

  const rigaFotovoltaico = catalogo.fotovoltaico.find((row) => row.kwp === ingresso.kwp)
  if (!rigaFotovoltaico) {
    throw new ErrorePreventivo(
      "kwp_non_disponibile",
      `Potenza ${ingresso.kwp} kWp non presente nel listino pubblicato.`,
      catalogo.fotovoltaico.map((row) => row.kwp),
    )
  }

  const accumulo = trovaAccumulo(catalogo, ingresso.batteria_marca)
  if (!accumulo) {
    throw new ErrorePreventivo(
      "marca_non_disponibile",
      `Marca accumulo "${ingresso.batteria_marca}" non presente nel listino pubblicato.`,
      catalogo.accumuli.map((item) => item.marca),
    )
  }

  const indiceTaglia = accumulo.taglie.findIndex(
    (taglia) => Math.abs(taglia - ingresso.batteria_kwh) < TOLLERANZA_KWH,
  )
  if (indiceTaglia < 0) {
    throw new ErrorePreventivo(
      "taglia_non_disponibile",
      `Capacita' ${ingresso.batteria_kwh} kWh non disponibile per ${accumulo.marca}.`,
      accumulo.taglie,
    )
  }

  const sovrapprezzo = accumulo.prezzi[String(ingresso.kwp)]?.[indiceTaglia]
  if (sovrapprezzo == null || !Number.isFinite(sovrapprezzo)) {
    throw new ErrorePreventivo(
      "combinazione_non_a_listino",
      `Combinazione ${ingresso.kwp} kWp + ${accumulo.marca} ${ingresso.batteria_kwh} kWh non presente nel listino: richiedere una verifica commerciale.`,
    )
  }

  const prezzoBase = rigaFotovoltaico.prezzo
  const subtotale = prezzoBase + sovrapprezzo

  // TODO: qui vanno innestate le regole speciali oggi vive solo nel parser
  // (parse-listino.ts): batterie da 5 kWh, potenze sotto i 6 kWp, secondo
  // inverter in parallelo. Oggi sono gia' spalmate nella matrice `prezzi`
  // durante l'import del PDF; quando diventeranno regole di calcolo andranno
  // applicate al subtotale prima dello sconto.

  const regolaZona = trovaRegolaZona(catalogo, ingresso.zona, ingresso.kwp)
  if (!regolaZona) {
    avvisi.push(
      `Nessuna regola di sconto per la zona "${ingresso.zona}" a ${ingresso.kwp} kWp: applicato prezzo pieno.`,
    )
  }

  const percentualeZona = regolaZona?.percentuale ?? 0
  const { codice, avviso } = ingresso.codice_sconto?.trim()
    ? risolviCodice(catalogo, ingresso.codice_sconto)
    : { codice: null, avviso: null }
  if (avviso) avvisi.push(avviso)

  // Cumulabile: il codice si somma alla zona. Non cumulabile: la sostituisce,
  // anche quando vale meno (e' una scelta commerciale sul codice, non una
  // ricerca del massimo sconto).
  const percentualeCodice = codice?.valore ?? 0
  const scontoZonaApplicato = codice && !codice.cumulabile_con_sconto_zona ? 0 : percentualeZona
  const percentualeGrezza = scontoZonaApplicato + percentualeCodice
  const percentualeFinale = Math.min(100, Math.max(0, percentualeGrezza))
  if (percentualeGrezza > 100) {
    avvisi.push(`Sconto cumulato al ${percentualeGrezza}%: limitato al 100%.`)
  }

  const scontoImporto = arrotonda((subtotale * percentualeFinale) / 100)

  const epsRichiesto = ingresso.eps === true
  const epsOmaggio = epsRichiesto && ingresso.eps_gift === true && regolaZona?.eps_omaggiabile === true
  const epsPrezzo = epsRichiesto && !epsOmaggio ? regolaZona?.eps_prezzo ?? 0 : 0

  return {
    prezzo_base: arrotonda(prezzoBase),
    sovrapprezzo_batteria: arrotonda(sovrapprezzo),
    prezzo_totale_prima_sconto: arrotonda(subtotale),
    sconto_zona_applicato: scontoZonaApplicato,
    codice_sconto_applicato: codice,
    sconto_percentuale_finale: percentualeFinale,
    sconto_importo: scontoImporto,
    eps_prezzo: arrotonda(epsPrezzo),
    eps_omaggio: epsOmaggio,
    prezzo_totale: arrotonda(subtotale - scontoImporto + epsPrezzo),
    avvisi,
  }
}
