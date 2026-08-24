// Descrizione e metadati della riga di audit scritta a ogni export CSV.
//
// Sta a parte dai due route handler perche' Lead e Clienti devono produrre
// righe leggibili allo stesso modo: chi legge il registro sta cercando "chi ha
// scaricato quanti record e con quale filtro", e la risposta non puo' dipendere
// dal modulo che l'ha scritta.
//
// Cosa NON finisce qui dentro: le righe esportate. L'audit registra la misura
// e il criterio dell'estrazione, mai i dati personali estratti — duplicarli nel
// registro creerebbe una seconda copia degli stessi dati, con la stessa
// sensibilita' e nessuna finalita' in piu'.

/** Ambito dell'estrazione: filtri della lista, o una selezione di righe. */
export type ExportScope = "filtro" | "selezione"

export interface ExportAuditInput {
  rows: unknown[]
  total: number
  truncated: boolean
}

/** "Export CSV Lead (filtro): 342 record esportati" */
export function descriviExport(
  entita: string,
  scope: ExportScope,
  result: ExportAuditInput,
): string {
  const base = `Export CSV ${entita} (${scope}): ${result.rows.length} record esportati`
  return result.truncated
    ? `${base} su ${result.total} corrispondenti (troncato)`
    : base
}

/**
 * Contenuto di `dati_dopo`: quanto e' uscito, quanto corrispondeva davvero, e
 * in base a quale criterio. Il flag `troncato` e' la parte che serve di piu' a
 * distanza: dice che quel CSV non e' l'insieme completo.
 */
export function datiExport(
  scope: ExportScope,
  result: ExportAuditInput,
  criterio: Record<string, string> | null,
): Record<string, unknown> {
  return {
    record_esportati: result.rows.length,
    record_totali: result.total,
    troncato: result.truncated,
    criterio: scope === "selezione" ? "selezione esplicita" : (criterio ?? {}),
  }
}

/**
 * Filtri attivi letti dalla query string, cosi' com'erano al momento
 * dell'export. Si tengono solo le chiavi di filtro: page/pageSize/fields
 * descrivono la paginazione, non l'insieme estratto.
 */
export function criteriDaSearchParams(
  sp: URLSearchParams,
  chiavi: string[],
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const chiave of chiavi) {
    const valore = sp.get(chiave)
    if (valore) out[chiave] = valore
  }
  return out
}

// --- Export negato ----------------------------------------------------------
// Un export bloccato e' un evento di sicurezza quanto uno riuscito: dice che
// qualcuno ha provato a estrarre dati che non gli competono. Senza questa riga
// il tentativo non lascerebbe traccia da nessuna parte, perche' il 403 non
// passa da nessun altro registro.
//
// Stesso tipo_evento di un export riuscito (`export_dati`) con `esito: failed`:
// chi cerca "gli export di questo utente" li trova entrambi con un filtro solo,
// e li distingue dall'esito. E' lo stesso schema gia' usato per gli invii email
// bloccati per consenso mancante (lib/email/consent.ts).

import { logAudit } from "./log"
import type { AuditModulo } from "./constants"

/**
 * Messaggio restituito al chiamante. Esplicito e uguale per tutti i moduli: chi
 * riceve il 403 deve capire che gli manca un permesso, non pensare a un guasto.
 * Il generico "Forbidden" di requireApiRecord non basta a distinguere le due
 * cose.
 */
export function messaggioExportNegato(entita: string): string {
  return `Il tuo ruolo non ha il permesso di esportare ${entita}. Chiedi a un amministratore di abilitare l'azione "export" per il tuo ruolo in Impostazioni CRM > Permessi.`
}

export async function logExportNegato(params: {
  entita: string
  modulo: AuditModulo
  ruoloCode: string
  /** Ambito richiesto, per capire cosa stava cercando di portare via. */
  scope: ExportScope
  criterio: Record<string, string> | null
  /** Quante righe erano state selezionate, quando l'ambito e' una selezione. */
  idsRichiesti: number | null
  attore?: { id: string | null; nome: string | null }
  request?: Request
}): Promise<void> {
  console.warn(
    `[export] negato a ruolo ${params.ruoloCode || "sconosciuto"} su ${params.entita} (${params.scope})`,
  )

  await logAudit({
    tipo_evento: "export_dati",
    esito: "failed",
    modulo: params.modulo,
    attore: params.attore,
    request: params.request,
    descrizione: `Export CSV ${params.entita} NEGATO: il ruolo ${params.ruoloCode || "sconosciuto"} non ha il permesso di export`,
    dati_dopo: {
      esito: "negato",
      motivo: "permesso record 'export' assente",
      ruolo: params.ruoloCode || null,
      ambito: params.scope,
      criterio: params.scope === "selezione" ? "selezione esplicita" : (params.criterio ?? {}),
      record_richiesti: params.idsRichiesti,
    },
  })
}
