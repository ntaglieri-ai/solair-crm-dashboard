/**
 * Spostamento di un campo in un altro blocco, anche di un'altra pagina.
 *
 * Vive fuori dai componenti perche' serve identico in due punti: la pagina
 * Layout schede e la scheda vera (Cliente/Lead), dove un amministratore
 * sistema la disposizione mentre la guarda. Due copie divergerebbero.
 *
 * Il trascinamento resta confinato alla pagina (vedi layout-dnd.ts): il
 * cambio di pagina passa solo di qui.
 */

/** Chiave di pagina che governa la modifica del layout: rw = amministratore. */
export const LAYOUT_PAGE_KEY = "crm_settings.system.layout"

export type DestinazioneCampo =
  | { tipo: "blocco"; bloccoId: string }
  /**
   * Pagina ancora senza blocchi (Documenti, per esempio): non esiste un
   * contenitore in cui mettere il campo, quindi se ne crea uno. Senza questo
   * ramo quelle pagine sarebbero irraggiungibili dal comando.
   */
  | { tipo: "pagina-vuota"; paginaId: string; etichettaBlocco: string }

export type EsitoSpostamento = { ok: true } | { ok: false; errore: string }

async function chiamata(init: RequestInit): Promise<{ ok: boolean; dati: Record<string, unknown> }> {
  const risposta = await fetch("/api/crm-settings/layout", init)
  const dati = (await risposta.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: risposta.ok, dati }
}

export async function spostaCampo(
  modulo: string,
  campoId: string,
  destinazione: DestinazioneCampo,
): Promise<EsitoSpostamento> {
  let bloccoId: string

  if (destinazione.tipo === "pagina-vuota") {
    const creato = await chiamata({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modulo,
        tipo: "blocco",
        paginaId: destinazione.paginaId,
        label: destinazione.etichettaBlocco,
      }),
    })
    if (!creato.ok || typeof creato.dati.id !== "string") {
      return {
        ok: false,
        errore:
          typeof creato.dati.error === "string"
            ? creato.dati.error
            : "Creazione del blocco di destinazione non riuscita",
      }
    }
    bloccoId = creato.dati.id
  } else {
    bloccoId = destinazione.bloccoId
  }

  const spostato = await chiamata({
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modulo, tipo: "campo", id: campoId, bloccoId }),
  })

  if (!spostato.ok) {
    return {
      ok: false,
      errore:
        typeof spostato.dati.error === "string"
          ? spostato.dati.error
          : "Spostamento non riuscito",
    }
  }
  return { ok: true }
}
