import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { unisciValoriMultipli, valoriMultipli } from "./valori-multipli"

/**
 * Stato cliente scritto da fuori (MCP): a scelta multipla, ogni parte deve
 * essere uno stato configurato in crm_stato_cliente, la stessa lista che il
 * CRM mostra nelle tendine. Maiuscole e spazi non contano; il valore salvato
 * usa l'etichetta configurata e il formato "A;B".
 *
 * Accetta "A;B" oppure un elenco. Restituisce null quando non resta nessuno
 * stato (campo svuotato). Lancia un errore leggibile con gli stati ammessi.
 */
export async function normalizzaStatoCliente(
  supabase: SupabaseClient,
  valore: unknown,
): Promise<string | null> {
  const richiesti = valoriMultipli(valore)
  if (richiesti.length === 0) return null

  const { data, error } = await supabase
    .from("crm_stato_cliente")
    .select("valore")
    .eq("attivo", true)
    .order("ordinamento", { ascending: true })
  if (error) throw new Error(`Lettura degli stati cliente non riuscita: ${error.message}`)

  const ammessi = (data ?? []).map((riga) => String(riga.valore))
  const perChiave = new Map(ammessi.map((stato) => [stato.toLowerCase(), stato]))
  const sconosciuti = richiesti.filter((stato) => !perChiave.has(stato.toLowerCase()))
  if (sconosciuti.length > 0) {
    throw new Error(
      `Stato cliente non valido: ${sconosciuti.join(", ")}. Stati ammessi: ${ammessi.join(", ")}. ` +
        'Piu\' stati si separano con ";".',
    )
  }
  return unisciValoriMultipli(richiesti.map((stato) => perChiave.get(stato.toLowerCase())!)) || null
}
