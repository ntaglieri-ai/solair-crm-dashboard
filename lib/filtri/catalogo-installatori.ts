import type { LayoutPagina } from "@/lib/crm-settings/layout"
import { CANALE_PREFERITO_LABELS } from "@/lib/installatori/api-types"
import { catalogoDaLayout, type DescrittoreCampo } from "./catalogo-da-layout"
import type { CampoFiltrabile } from "./albero"
import type { GruppoCampi } from "./catalogo-lead"

/**
 * I campi filtrabili degli Installatori.
 *
 * Come per i Clienti, i gruppi vengono dal layout della scheda: un campo
 * aggiunto dalla pagina Layout diventa filtrabile senza toccare codice.
 *
 * Il modulo ha pochi campi e nessun catalogo tipizzato come quello dei
 * Clienti, quindi i tipi stanno qui — ma sono otto, e il layout resta la
 * fonte di quali esistono e come sono raggruppati.
 */

const TIPI: Record<string, DescrittoreCampo> = {
  nome: { tipo: "text" },
  email: { tipo: "text" },
  email_secondaria: { tipo: "text" },
  telefono: { tipo: "text" },
  tag: { tipo: "text" },
  note: { tipo: "text" },
  attivo: { tipo: "boolean" },
  canale_preferito: { tipo: "text", opzioni: Object.keys(CANALE_PREFERITO_LABELS) },
  proprietario_nome: { tipo: "text" },
  created_at: { tipo: "timestamp" },
  updated_at: { tipo: "timestamp" },
}

/** Colonne raggiungibili dal filtro: quello che non e' qui non si traduce. */
export const COLONNE_INSTALLATORI: Record<string, string> = Object.fromEntries(
  Object.keys(TIPI)
    // proprietario_nome non e' una colonna: il nome si risolve altrove, e
    // filtrarci sopra vorrebbe dire interrogare una tabella diversa.
    .filter((chiave) => chiave !== "proprietario_nome")
    .map((chiave) => [chiave, chiave]),
)

export const COLLEGATI_INSTALLATORI: CampoFiltrabile[] = [
  { chiave: "Note", etichetta: "Note", tipo: "collegato" },
  { chiave: "Allegati", etichetta: "Allegati", tipo: "collegato" },
  { chiave: "E-mail inviate", etichetta: "E-mail inviate", tipo: "collegato" },
]

export function gruppiCampiInstallatori(pagine: LayoutPagina[]): GruppoCampi[] {
  const gruppi = catalogoDaLayout(pagine, (fieldKey) => TIPI[fieldKey] ?? null)
  return [
    ...gruppi,
    { chiave: "collegati", etichetta: "Contenuti collegati", campi: COLLEGATI_INSTALLATORI },
  ]
}

/** Il catalogo piatto per la validazione lato server. */
export function catalogoInstallatoriCompleto(): CampoFiltrabile[] {
  const campi: CampoFiltrabile[] = Object.entries(TIPI).map(([chiave, info]) => ({
    chiave,
    etichetta: chiave,
    tipo: info.opzioni?.length
      ? "elenco"
      : info.tipo === "boolean"
        ? "booleano"
        : info.tipo === "timestamp"
          ? "data"
          : info.tipo === "numeric"
            ? "numero"
            : "testo",
    opzioni: info.opzioni,
  }))
  return [...campi, ...COLLEGATI_INSTALLATORI]
}
