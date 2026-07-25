// CRUD condiviso su documenti/collegamenti, generico per Lead/Cliente/
// Installatori. Nessuno slot nominato, nessuna categoria speciale — solo
// la lista reale di cosa e' stato caricato per quel record (decisione
// esplicita di Nando 25/07: "questi sei punti devono sparire, deve essere
// semplicemente la visualizzazione di cio' che la cartella contiene").

import { createClient } from "@/lib/supabase/server"
import type { AllegatoRecordTipo } from "./paths"

export type DocumentoRow = {
  id: string
  nome_file: string
  url_storage: string
  categoria: string | null
  dimensione_kb: number | null
  record_id: string
  record_tipo: AllegatoRecordTipo
  caricato_da: string
  created_at: string
}

export type CollegamentoRow = {
  id: string
  titolo: string
  url: string
  record_id: string
  record_tipo: AllegatoRecordTipo
  creato_da: string
  created_at: string
}

export async function listAllegati(recordTipo: AllegatoRecordTipo, recordId: string) {
  const supabase = await createClient()
  const [documenti, collegamenti] = await Promise.all([
    supabase
      .from("documenti")
      .select("*")
      .eq("record_tipo", recordTipo)
      .eq("record_id", recordId)
      .order("created_at", { ascending: false }),
    supabase
      .from("collegamenti")
      .select("*")
      .eq("record_tipo", recordTipo)
      .eq("record_id", recordId)
      .order("created_at", { ascending: false }),
  ])

  if (documenti.error) throw new Error(documenti.error.message)
  if (collegamenti.error) throw new Error(collegamenti.error.message)

  return {
    documenti: (documenti.data ?? []) as DocumentoRow[],
    collegamenti: (collegamenti.data ?? []) as CollegamentoRow[],
  }
}

export async function insertDocumento(
  row: Omit<DocumentoRow, "id" | "created_at" | "categoria"> & { categoria?: string | null },
): Promise<DocumentoRow> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("documenti")
    .insert({ ...row, categoria: row.categoria ?? null })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as DocumentoRow
}

export async function insertCollegamento(
  row: Omit<CollegamentoRow, "id" | "created_at">,
): Promise<CollegamentoRow> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("collegamenti").insert(row).select().single()
  if (error) throw new Error(error.message)
  return data as CollegamentoRow
}

export async function getDocumentoById(id: string): Promise<DocumentoRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("documenti")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as DocumentoRow | null
}

export async function deleteDocumentoRow(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("documenti").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteCollegamentoRow(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("collegamenti").delete().eq("id", id)
  if (error) throw new Error(error.message)
}
