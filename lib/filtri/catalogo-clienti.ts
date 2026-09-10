import { CLIENTI_RECORD_FIELDS } from "@/lib/clienti/zoho-fields"
import type { LayoutPagina } from "@/lib/crm-settings/layout"
import {
  catalogoDaLayout,
  colonnePerCampo,
  type DescrittoreCampo,
} from "./catalogo-da-layout"
import type { CampoFiltrabile } from "./albero"
import type { GruppoCampi } from "./catalogo-lead"

/**
 * I campi filtrabili dei Clienti.
 *
 * Non c'e' un elenco scritto a mano: i campi sono centosessantadue e si
 * disallineerebbe subito. I gruppi vengono dal layout della scheda, i tipi
 * dal catalogo campi del modulo. Aggiungendo un campo dalla pagina Layout
 * diventa filtrabile da solo.
 */

const PER_APP_FIELD = new Map(
  CLIENTI_RECORD_FIELDS.map((campo) => [campo.appField, campo]),
)

/** Colonne raggiungibili dal filtro: quello che non e' qui non si traduce. */
export const COLONNE_CLIENTI = colonnePerCampo(CLIENTI_RECORD_FIELDS)

/**
 * Costruisce i gruppi filtrabili per i Clienti.
 *
 * `opzioniPerCampo` porta i valori configurati delle tendine: arrivano dai
 * dati veri, cosi' un valore aggiunto in configurazione compare nel filtro
 * senza toccare il codice.
 */
export function gruppiCampiClienti(
  pagine: LayoutPagina[],
  opzioniPerCampo: Record<string, readonly string[]> = {},
): GruppoCampi[] {
  const descrittore = (fieldKey: string): DescrittoreCampo | null => {
    const campo = PER_APP_FIELD.get(fieldKey)
    if (!campo) return null
    const opzioni = opzioniPerCampo[fieldKey]
    return { tipo: campo.type, opzioni: opzioni?.length ? opzioni : undefined }
  }

  const gruppi = catalogoDaLayout(pagine, descrittore)

  // I contenuti collegati non sono campi della scheda: sono domande su altre
  // tabelle, e stanno in fondo come sul Lead.
  return [...gruppi, { chiave: "collegati", etichetta: "Contenuti collegati", campi: COLLEGATI_CLIENTI }]
}

export const COLLEGATI_CLIENTI: CampoFiltrabile[] = [
  { chiave: "Attività", etichetta: "Attività", tipo: "collegato" },
  { chiave: "Note", etichetta: "Note", tipo: "collegato" },
  { chiave: "Allegati", etichetta: "Allegati", tipo: "collegato" },
  { chiave: "E-mail inviate", etichetta: "E-mail inviate", tipo: "collegato" },
  { chiave: "Eventi in calendario", etichetta: "Eventi in calendario", tipo: "collegato" },
]

/**
 * Il catalogo piatto per la validazione lato server.
 *
 * Senza layout — quando la validazione avviene fuori da una pagina — si
 * ricade sull'elenco completo dei campi del modulo: interessa che il campo
 * esista e di che tipo sia, non in quale sezione della scheda compaia.
 */
export function catalogoClientiCompleto(): CampoFiltrabile[] {
  const campi: CampoFiltrabile[] = CLIENTI_RECORD_FIELDS.map((campo) => ({
    chiave: campo.appField,
    etichetta: campo.appField,
    tipo:
      campo.type === "numeric"
        ? "numero"
        : campo.type === "boolean"
          ? "booleano"
          : campo.type === "timestamp"
            ? "data"
            : "testo",
  }))
  return [...campi, ...COLLEGATI_CLIENTI]
}
