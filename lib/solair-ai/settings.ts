import "server-only"

import { createClient } from "@/lib/supabase/server"
import { ENTITA_AI, isEntitaAI } from "./tipi"
import type { EntitaAI } from "./tipi"

export type ImpostazioneAI = {
  entita: EntitaAI
  nextcloudPath: string
  attivo: boolean
  indicizzazioneAttiva: boolean
  aggiornatoIl: string | null
  ultimoSyncIl: string | null
  ultimoSyncEsito: string | null
  ultimoSyncErrore: string | null
  ultimoSyncFile: number
}

type RigaImpostazione = {
  entita: string
  nextcloud_path: string | null
  attivo: boolean | null
  indicizzazione_attiva?: boolean | null
  aggiornato_il: string | null
  ultimo_sync_il?: string | null
  ultimo_sync_esito?: string | null
  ultimo_sync_errore?: string | null
  ultimo_sync_file?: number | null
}

/** Riga di default per un'entita' che a DB non c'e' ancora (migration non applicata). */
function vuota(entita: EntitaAI): ImpostazioneAI {
  return {
    entita,
    nextcloudPath: "",
    attivo: true,
    indicizzazioneAttiva: false,
    aggiornatoIl: null,
    ultimoSyncIl: null,
    ultimoSyncEsito: null,
    ultimoSyncErrore: null,
    ultimoSyncFile: 0,
  }
}

/**
 * Le tre righe di configurazione, sempre tutte e tre e sempre nello stesso
 * ordine: la pagina di configurazione mostra tre campi fissi, non una lista
 * che cambia lunghezza a seconda di cosa c'e' a database.
 */
export async function leggiImpostazioniAI(): Promise<ImpostazioneAI[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crm_ai_settings")
    .select(
      "entita, nextcloud_path, attivo, indicizzazione_attiva, aggiornato_il, ultimo_sync_il, ultimo_sync_esito, ultimo_sync_errore, ultimo_sync_file",
    )

  // Tabella assente = migration non ancora applicata. La pagina deve poter
  // aprirsi lo stesso e dire cosa manca, non rispondere 500.
  if (error) return ENTITA_AI.map(vuota)

  const righe = new Map(
    ((data ?? []) as RigaImpostazione[])
      .filter((riga) => isEntitaAI(riga.entita))
      .map((riga) => [
        riga.entita as EntitaAI,
        {
          entita: riga.entita as EntitaAI,
          nextcloudPath: riga.nextcloud_path ?? "",
          attivo: riga.attivo !== false,
          indicizzazioneAttiva: false,
          aggiornatoIl: riga.aggiornato_il,
          ultimoSyncIl: riga.ultimo_sync_il ?? null,
          ultimoSyncEsito: riga.ultimo_sync_esito ?? null,
          ultimoSyncErrore: riga.ultimo_sync_errore ?? null,
          ultimoSyncFile: riga.ultimo_sync_file ?? 0,
        } satisfies ImpostazioneAI,
      ]),
  )

  return ENTITA_AI.map((entita) => righe.get(entita) ?? vuota(entita))
}

export async function leggiImpostazioneAI(entita: EntitaAI): Promise<ImpostazioneAI> {
  const tutte = await leggiImpostazioniAI()
  return tutte.find((riga) => riga.entita === entita) ?? vuota(entita)
}

/**
 * Stessa normalizzazione del CHECK a database: niente slash iniziale o
 * finale, niente doppi slash, niente risalite. Il path finisce dentro una
 * URL WebDAV e "../" la porterebbe fuori dalla cartella configurata.
 */
export function normalizzaPath(valore: string): string {
  const pulito = valore
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "")
  if (pulito.split("/").some((segmento) => segmento === "..")) return ""
  return pulito
}

export async function salvaImpostazioniAI(
  utenteId: string | null,
  modifiche: {
    entita: EntitaAI
    nextcloudPath: string
    attivo: boolean
    indicizzazioneAttiva?: boolean
  }[],
): Promise<void> {
  const supabase = await createClient()
  const adesso = new Date().toISOString()

  // Update riga per riga e non upsert: le tre righe esistono gia' dalla
  // migration e non c'e' policy di INSERT: un upsert su una riga assente
  // fallirebbe in silenzio con la RLS invece di dire cosa non va.
  for (const modifica of modifiche) {
    const { error } = await supabase
      .from("crm_ai_settings")
      .update({
        nextcloud_path: normalizzaPath(modifica.nextcloudPath),
        attivo: modifica.attivo,
        indicizzazione_attiva: false,
        aggiornato_da: utenteId,
        aggiornato_il: adesso,
      })
      .eq("entita", modifica.entita)
    if (error) {
      throw new Error(`Salvataggio configurazione ${modifica.entita} non riuscito: ${error.message}`)
    }
  }
}
