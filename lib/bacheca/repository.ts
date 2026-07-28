import { createClient } from "@/lib/supabase/server"
import {
  isBachecaLivello,
  type BachecaLivello,
  type BachecaMessaggio,
} from "./types"

const SELECT_COLUMNS = "id, titolo, testo, livello, pin, created_at, utenti:creato_da(nome)"

type BachecaRow = {
  id: string
  titolo: string | null
  testo: string | null
  livello: string | null
  pin: boolean | null
  created_at: string
  utenti: { nome: string | null } | null
}

function mapRow(row: BachecaRow): BachecaMessaggio {
  const livello: BachecaLivello = isBachecaLivello(row.livello) ? row.livello : "info"
  return {
    id: row.id,
    titolo: row.titolo ?? "",
    testo: row.testo ?? "",
    livello,
    pin: row.pin === true,
    autore: row.utenti?.nome ?? null,
    createdAt: row.created_at,
  }
}

/**
 * Elenco completo: pin in cima, poi cronologico inverso. Stesso ordine sia per
 * il ticker del widget sia per il dialog "Vedi tutte" — la differenza e' solo
 * quante righe ne mostra la UI, non l'ordinamento.
 */
export async function listBachecaMessaggi(limit = 100): Promise<BachecaMessaggio[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("bacheca_messaggi")
    .select(SELECT_COLUMNS)
    .order("pin", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as BachecaRow[]).map(mapRow)
}

/**
 * Variante per il render server della dashboard: un errore qui (tipicamente la
 * tabella non ancora creata sull'ambiente) non deve far esplodere l'intera
 * pagina — il widget parte vuoto e si ripopola al primo refresh via API.
 */
export async function listBachecaMessaggiSafe(limit = 100): Promise<BachecaMessaggio[]> {
  try {
    return await listBachecaMessaggi(limit)
  } catch (error) {
    console.warn(
      "[bacheca] elenco non disponibile al render:",
      error instanceof Error ? error.message : error,
    )
    return []
  }
}

export async function createBachecaMessaggio(input: {
  titolo: string
  testo: string
  livello: BachecaLivello
  pin: boolean
  creatoDa: string | null
}): Promise<BachecaMessaggio> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("bacheca_messaggi")
    .insert({
      titolo: input.titolo,
      testo: input.testo,
      livello: input.livello,
      pin: input.pin,
      creato_da: input.creatoDa,
    })
    .select(SELECT_COLUMNS)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as unknown as BachecaRow)
}

export async function deleteBachecaMessaggio(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("bacheca_messaggi").delete().eq("id", id)
  if (error) throw new Error(error.message)
}
