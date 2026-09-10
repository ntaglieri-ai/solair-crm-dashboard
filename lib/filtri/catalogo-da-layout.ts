import type { LayoutPagina } from "@/lib/crm-settings/layout"
import type { CampoFiltrabile, TipoCampo } from "./albero"
import type { GruppoCampi } from "./catalogo-lead"

/**
 * Il catalogo dei campi filtrabili, ricavato dal layout.
 *
 * Scriverlo a mano funziona finche' i campi sono trenta; sui Clienti sono
 * centosessantadue, e un elenco separato si disallinea al primo campo nuovo
 * — e' gia' successo con i consensi del Lead, filtrabili solo dopo che
 * qualcuno se n'e' accorto.
 *
 * Il layout invece sa gia' quali campi esistono e come sono raggruppati:
 * Anagrafica, Impianto, Pagamenti. Ricavando i gruppi da li', un campo
 * aggiunto dalla pagina Layout diventa filtrabile senza toccare codice, e
 * chi cerca "Capacita' Batterie" la trova sotto Impianto, dov'e' abituato a
 * vederla.
 */

/** Il tipo di archiviazione del modulo, tradotto in tipo filtrabile. */
export type TipoModulo = "text" | "numeric" | "boolean" | "timestamp"

const TIPO_FILTRO: Record<TipoModulo, TipoCampo> = {
  text: "testo",
  numeric: "numero",
  boolean: "booleano",
  timestamp: "data",
}

export type DescrittoreCampo = {
  /** Tipo di archiviazione, dal catalogo campi del modulo. */
  tipo: TipoModulo
  /**
   * Valori ammessi, quando il campo e' una tendina. Un campo testo con
   * valori configurati si comporta da elenco: cercarlo scrivendo sarebbe
   * inutilmente faticoso quando le scelte sono cinque.
   */
  opzioni?: readonly string[]
}

/**
 * Costruisce i gruppi filtrabili da un layout.
 *
 * I campi calcolati restano fuori: non sono colonne, si ottengono da una
 * formula al momento di disegnare la scheda, e il database non saprebbe
 * filtrarci sopra.
 *
 * Restano fuori anche i campi di cui il modulo non conosce il tipo: senza
 * quello non si saprebbe quali operatori offrire.
 */
export function catalogoDaLayout(
  pagine: LayoutPagina[],
  descrittore: (fieldKey: string) => DescrittoreCampo | null,
): GruppoCampi[] {
  const gruppi: GruppoCampi[] = []

  for (const pagina of pagine) {
    const campi: CampoFiltrabile[] = []

    for (const blocco of pagina.blocchi) {
      for (const campo of blocco.campi) {
        if (!campo.visible) continue
        if (campo.formula) continue

        const info = descrittore(campo.fieldKey)
        if (!info) continue

        campi.push({
          chiave: campo.fieldKey,
          etichetta: campo.labelOverride ?? campo.fieldKey,
          tipo: info.opzioni?.length ? "elenco" : TIPO_FILTRO[info.tipo],
          opzioni: info.opzioni,
        })
      }
    }

    // Una pagina senza campi filtrabili — quelle a componente dedicato, per
    // esempio — non deve comparire come gruppo vuoto.
    if (campi.length) {
      gruppi.push({ chiave: pagina.pageKey, etichetta: pagina.label, campi })
    }
  }

  return gruppi
}

/**
 * La mappa campo -> colonna del database, ricavata dallo stesso catalogo.
 *
 * Serve alla traduzione in interrogazione, ed e' il punto in cui si decide
 * quali colonne sono raggiungibili: un campo che non compare qui non viene
 * tradotto, quindi non c'e' modo di far filtrare il database su una colonna
 * arbitraria.
 */
export function colonnePerCampo(
  campi: readonly { appField: string; column: string }[],
): Record<string, string> {
  const mappa: Record<string, string> = {}
  for (const campo of campi) mappa[campo.appField] = campo.column
  return mappa
}
