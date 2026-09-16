import type { LayoutPagina } from "./layout"

/**
 * Decisione di un trascinamento nel Layout Editor, separata dalla UI.
 *
 * Sta fuori dal componente perche' e' la parte che sbaglia in silenzio: un
 * indice a -1 o un contenitore risolto male non danno errore, semplicemente
 * rimettono l'elemento dov'era. Qui e' logica pura su dati normali, quindi
 * dimostrabile con dei test invece che a forza di prove nel browser.
 */

/** Cosa sta viaggiando sotto il cursore, o cosa gli sta sotto. */
export type DatiTrascinamento =
  | { tipo: "pagina"; paginaId: string }
  | { tipo: "blocco"; paginaId: string; bloccoId: string }
  | { tipo: "campo"; paginaId: string; bloccoId: string }
  /** Area di rilascio di un blocco: l'unico bersaglio di un blocco vuoto. */
  | { tipo: "area-blocco"; paginaId: string; bloccoId: string }

export type AzioneTrascinamento =
  | { azione: "riordina-pagine"; ordine: string[] }
  | { azione: "riordina-blocchi"; paginaId: string; ordine: string[] }
  | { azione: "riordina-campi"; bloccoId: string; ordine: string[] }
  | {
      azione: "sposta-campo"
      campoId: string
      origine: string
      destinazione: string
      indice: number
    }

function muovi<T>(elementi: T[], da: number, a: number): T[] {
  const copia = [...elementi]
  copia.splice(a, 0, copia.splice(da, 1)[0])
  return copia
}

/**
 * Traduce un rilascio nell'operazione da compiere, o `null` se non c'e'
 * niente da fare.
 *
 * `sopra` puo' essere un fratello, il contenitore stesso o la sua area di
 * rilascio: un campo lasciato in un punto vuoto della griglia risolve sul
 * blocco, non su un campo, e va trattato come "in fondo" invece che come un
 * indice mancante.
 */
export function decidiTrascinamento(
  pagine: LayoutPagina[],
  attivoId: string,
  sopraId: string,
  attivo: DatiTrascinamento | undefined,
  sopra: DatiTrascinamento | undefined,
): AzioneTrascinamento | null {
  if (!attivo || !sopra || attivoId === sopraId) return null

  if (attivo.tipo === "pagina") {
    // Una pagina si riordina solo contro un'altra pagina: rilasciata su un
    // blocco, l'indice sarebbe -1 e sposterebbe l'elemento sbagliato.
    if (sopra.tipo !== "pagina") return null
    const da = pagine.findIndex((p) => p.id === attivoId)
    const a = pagine.findIndex((p) => p.id === sopraId)
    if (da < 0 || a < 0 || da === a) return null
    return { azione: "riordina-pagine", ordine: muovi(pagine, da, a).map((p) => p.id) }
  }

  if (attivo.tipo === "blocco") {
    if (sopra.tipo === "campo" || sopra.tipo === "area-blocco") return null
    if (sopra.tipo !== "blocco") return null
    // I blocchi non cambiano pagina: si riordinano dentro la loro.
    if (sopra.paginaId !== attivo.paginaId) return null
    const pagina = pagine.find((p) => p.id === attivo.paginaId)
    if (!pagina) return null
    const da = pagina.blocchi.findIndex((b) => b.id === attivoId)
    const a = pagina.blocchi.findIndex((b) => b.id === sopraId)
    if (da < 0 || a < 0 || da === a) return null
    return {
      azione: "riordina-blocchi",
      paginaId: pagina.id,
      ordine: muovi(pagina.blocchi, da, a).map((b) => b.id),
    }
  }

  if (attivo.tipo !== "campo") return null

  // Un campo resta nella sua pagina: fra blocchi di pagine diverse non si
  // sposta, e il server applica la stessa regola.
  if (sopra.tipo === "pagina" || sopra.paginaId !== attivo.paginaId) return null

  const pagina = pagine.find((p) => p.id === attivo.paginaId)
  const origine = pagina?.blocchi.find((b) => b.id === attivo.bloccoId)
  const destinazione = pagina?.blocchi.find((b) => b.id === sopra.bloccoId)
  if (!pagina || !origine || !destinazione) return null

  const da = origine.campi.findIndex((c) => c.id === attivoId)
  if (da < 0) return null

  if (origine.id === destinazione.id) {
    const a =
      sopra.tipo === "campo"
        ? origine.campi.findIndex((c) => c.id === sopraId)
        : origine.campi.length - 1
    if (a < 0 || da === a) return null
    return {
      azione: "riordina-campi",
      bloccoId: origine.id,
      ordine: muovi(origine.campi, da, a).map((c) => c.id),
    }
  }

  const indice =
    sopra.tipo === "campo"
      ? Math.max(0, destinazione.campi.findIndex((c) => c.id === sopraId))
      : destinazione.campi.length

  return {
    azione: "sposta-campo",
    campoId: attivoId,
    origine: origine.id,
    destinazione: destinazione.id,
    indice,
  }
}
