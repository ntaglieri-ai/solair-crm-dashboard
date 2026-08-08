// Applicazione del tag "Italia" al Cliente (spec FASE 2, punto 2.3).
//
// Regola: se la provincia postale del cliente NON e' una delle nove siciliane,
// il cliente e' "fuori area" e va marcato con il tag "Italia" — cosi' chi apre
// la lista vede subito le pratiche lontane senza dover aprire l'indirizzo.
// La regola in se' (sigle, nome e colore del tag) sta in ./tag-italia-regola,
// modulo puro condiviso con lo script di backfill.
//
// PERCHE' UN HOOK APPLICATIVO E NON UN TRIGGER SUL DB
// 1. In supabase/migrations non c'e' un solo trigger: le funzioni SQL
//    presenti sono RPC (get_dashboard_aggregates, pubblica_catalogo_*) o
//    helper per le policy RLS (bacheca_can_manage, nc_path_perms_can_write).
//    Tutte le regole di business automatiche stanno in TypeScript — il gate
//    dei tre documenti obbligatori (1.3) e' nella route di conversione, non in
//    un constraint. Mettere questa in PL/pgSQL creerebbe il primo posto
//    "invisibile" dove il CRM cambia dati da solo.
// 2. La logica "trova o crea il tag" esiste gia' in TS
//    (app/api/clienti/reference-data/route.ts, azione create_assign): stesso
//    lookup case-insensitive su modulo='cliente', stessa palette colori.
//    Riscriverla in SQL vorrebbe dire due fonti di verita' su come nasce un
//    tag, che divergono alla prima modifica.
// 3. Un trigger vive nella stessa transazione della scrittura: se l'insert su
//    cliente_tags fallisse, farebbe fallire il salvataggio del cliente. Qui il
//    tag e' un'automazione accessoria — un suo errore va loggato, non deve
//    perdere i dati che l'utente ha appena inserito.
// 4. Tutte le scritture applicative su clienti.provincia_indirizzo_postale
//    passano da lib/clienti/repository.ts (createClienteRecord /
//    updateClienteRecord): due soli punti di aggancio, verificato con grep su
//    app/ e lib/. L'unico altro writer e' scripts/migrations/
//    import-zoho-clienti.mjs, script una tantum di import storico gia' girato.
import { createClient } from "@/lib/supabase/server"
import {
  TAG_ITALIA_COLORE,
  TAG_ITALIA_NOME,
  richiedeTagItalia,
} from "@/lib/clienti/tag-italia-regola"

export {
  PROVINCE_SICILIANE,
  TAG_ITALIA_NOME,
  isProvinciaSiciliana,
  richiedeTagItalia,
} from "@/lib/clienti/tag-italia-regola"

type ServerClient = Awaited<ReturnType<typeof createClient>>

async function trovaTagItalia(supabase: ServerClient): Promise<string | null> {
  // limit(1) e non maybeSingle(): se in passato qualcuno ha creato a mano sia
  // "Italia" che "italia", maybeSingle() darebbe errore invece di riusarne uno.
  const { data, error } = await supabase
    .from("tag")
    .select("id")
    .eq("modulo", "cliente")
    .ilike("nome", TAG_ITALIA_NOME)
    .limit(1)
  if (error) {
    console.error(`[clienti/tag-italia] lettura tag "${TAG_ITALIA_NOME}":`, error.message)
    return null
  }
  return (data?.[0]?.id as string | undefined) ?? null
}

async function trovaOCreaTagItalia(supabase: ServerClient): Promise<string | null> {
  const esistente = await trovaTagItalia(supabase)
  if (esistente) return esistente

  const creato = await supabase
    .from("tag")
    .insert({ nome: TAG_ITALIA_NOME, colore: TAG_ITALIA_COLORE, modulo: "cliente" })
    .select("id")
    .single()
  if (!creato.error && creato.data) return creato.data.id as string

  // Due conversioni in parallelo possono provare a creare il tag insieme:
  // prima di dichiarare fallimento rileggiamo, il tag potrebbe esserci ora.
  const riletto = await trovaTagItalia(supabase)
  if (riletto) return riletto

  console.error(
    `[clienti/tag-italia] creazione tag "${TAG_ITALIA_NOME}":`,
    creato.error?.message,
  )
  return null
}

/**
 * Applica il tag "Italia" al cliente se la provincia non e' siciliana.
 * Idempotente e non bloccante: non solleva mai eccezioni, gli errori finiscono
 * nei log (stesso pattern del resto del repository) perche' il salvataggio del
 * cliente non deve fallire per un tag.
 *
 * Nota di scope: il tag viene solo aggiunto, mai rimosso. Se una provincia
 * sbagliata viene corretta in una siciliana il tag resta e va tolto a mano —
 * la spec 2.3 chiede solo l'applicazione, e una rimozione automatica
 * cancellerebbe anche il tag messo a mano da un operatore.
 *
 * @returns true se il tag risulta assegnato dopo questa chiamata.
 */
export async function applicaTagItalia(
  clienteId: string,
  provincia: unknown,
): Promise<boolean> {
  if (!clienteId || !richiedeTagItalia(provincia)) return false

  const supabase = await createClient()
  const tagId = await trovaOCreaTagItalia(supabase)
  if (!tagId) return false

  // ignoreDuplicates: se il tag e' gia' sul cliente non facciamo nulla, cosi'
  // non sovrascriviamo assegnato_da/assegnato_il di un'assegnazione manuale.
  const { error } = await supabase
    .from("cliente_tags")
    .upsert(
      { cliente_id: clienteId, tag_id: tagId },
      { onConflict: "cliente_id,tag_id", ignoreDuplicates: true },
    )
  if (error) {
    console.error(
      `[clienti/tag-italia] assegnazione al cliente ${clienteId}:`,
      error.message,
    )
    return false
  }

  return true
}
