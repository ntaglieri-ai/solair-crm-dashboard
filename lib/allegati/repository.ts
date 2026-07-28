// CRUD sui collegamenti (link esterni) degli allegati record, generico per
// Lead/Cliente/Installatori. Nessuno slot nominato, nessuna categoria speciale
// — solo la lista reale di cosa e' stato caricato per quel record (decisione
// esplicita di Nando 25/07: "questi sei punti devono sparire, deve essere
// semplicemente la visualizzazione di cio' che la cartella contiene").
//
// I FILE non passano piu' di qui: dal 27/07 la sezione "Documenti" legge e
// scrive solo su Nextcloud (lib/nextcloud/admin-webdav.ts), unica fonte di
// verita'. La tabella `documenti` resta nel DB ma non e' piu' usata da questo
// flusso — decisione su drop/cleanup rimandata.

import { createClient } from "@/lib/supabase/server"
import type { AllegatoRecordTipo } from "./paths"

export type CollegamentoRow = {
  id: string
  titolo: string
  url: string
  record_id: string
  record_tipo: AllegatoRecordTipo
  creato_da: string
  created_at: string
}

export async function listCollegamenti(
  recordTipo: AllegatoRecordTipo,
  recordId: string,
): Promise<CollegamentoRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("collegamenti")
    .select("*")
    .eq("record_tipo", recordTipo)
    .eq("record_id", recordId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as CollegamentoRow[]
}

export async function insertCollegamento(
  row: Omit<CollegamentoRow, "id" | "created_at">,
): Promise<CollegamentoRow> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("collegamenti").insert(row).select().single()
  if (error) throw new Error(error.message)
  return data as CollegamentoRow
}

export async function deleteCollegamentoRow(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("collegamenti").delete().eq("id", id)
  if (error) throw new Error(error.message)
}
