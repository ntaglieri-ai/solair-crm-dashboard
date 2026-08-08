// Gate dei tre documenti obbligatori (spec FASE 1.3): un lead diventa cliente
// solo se nella sua sottocartella "Documenti obbligatori" ci sono esattamente
// tre file.
//
// Il gate e' PURO CONTEGGIO, per scelta esplicita:
//  - nessun record a DB (gli allegati non sono righe: la fonte di verita' e'
//    sempre e solo la cartella Nextcloud, come per /api/allegati);
//  - nessun parsing del nome file (niente convenzioni tipo "1_CI.pdf" da far
//    rispettare a mano ai commerciali);
//  - nessuna eliminazione automatica di allegati, mai — se i file sono di
//    troppo o sbagliati, li sistema una persona.

import { listFolder } from "@/lib/nextcloud/admin-webdav"
import { documentiObbligatoriFolderPath } from "./paths"

export const DOCUMENTI_OBBLIGATORI_RICHIESTI = 3

export type ConteggioDocumentiObbligatori = {
  /** false = non e' stato possibile leggere la cartella (Nextcloud giu'/misconfig). */
  ok: boolean
  count: number
  richiesti: number
  completo: boolean
  folderPath: string
  error?: string
}

/**
 * Conta i file presenti nella sottocartella "Documenti obbligatori" del lead.
 *
 * Cartella inesistente (404 -> listFolder torna ok con lista vuota) = 0 file:
 * non e' un errore, e' semplicemente un lead per cui non e' stato ancora
 * caricato nulla (o creato prima del backfill) e il gate resta chiuso.
 */
export async function contaDocumentiObbligatori(
  leadId: string,
  nomeLead: string,
): Promise<ConteggioDocumentiObbligatori> {
  const folderPath = documentiObbligatoriFolderPath(leadId, nomeLead)
  const listing = await listFolder(folderPath)

  if (!listing.ok) {
    return {
      ok: false,
      count: 0,
      richiesti: DOCUMENTI_OBBLIGATORI_RICHIESTI,
      completo: false,
      folderPath,
      error: listing.error ?? `Lettura cartella Nextcloud fallita (${listing.status})`,
    }
  }

  // Solo i file: se qualcuno crea una sottocartella dentro "Documenti
  // obbligatori" non deve valere come documento.
  const count = listing.items.filter((item) => !item.isFolder).length

  return {
    ok: true,
    count,
    richiesti: DOCUMENTI_OBBLIGATORI_RICHIESTI,
    completo: count === DOCUMENTI_OBBLIGATORI_RICHIESTI,
    folderPath,
  }
}

/** Messaggio unico usato dal gate di conversione e (poi) dalla UI. */
export function messaggioGateNonSoddisfatto(count: number): string {
  return `Servono esattamente ${DOCUMENTI_OBBLIGATORI_RICHIESTI} documenti obbligatori (trovati: ${count})`
}
