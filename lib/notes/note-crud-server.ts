import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiRecord } from "@/lib/permissions/server"
import { canAccessOwnedRecord } from "@/lib/permissions/data-scope"
import { resolveNoteMentions } from "./mentions-server"
import { parseNotePayload } from "./note-files"
import type { FieldModuleKey } from "@/lib/permissions/field-catalog"

/**
 * Modifica e cancellazione delle note normali.
 *
 * Le note vivono tutte in `attivita`, distinte dal record a cui
 * appartengono: la logica e' quindi una sola, e ogni modulo si limita a
 * dire qual e' il suo record.
 *
 * Chi puo' farlo lo decide il permesso `note.gestione`, concesso per
 * impostazione predefinita a Superadmin e Amministratori. Non e' un elenco
 * di ruoli scritto qui: si toglie e si concede dalla pagina Permessi.
 *
 * La cancellazione e' recuperabile: la riga resta e viene marcata, come per
 * le note interne. Una nota cancellata per sbaglio e' un'informazione persa,
 * e in un CRM le informazioni perse non tornano.
 */

export const AZIONE_GESTIONE_NOTE = "note.gestione"

export type NoteModuloConfig = {
  /** Modulo dei permessi. */
  modulo: FieldModuleKey
  /** Valore di `attivita.record_tipo` per questo modulo. */
  recordTipo: string
  /** Tabella del record a cui la nota appartiene. */
  tabellaRecord: string
  /** Colonna del proprietario sul record, per il perimetro di visibilita'. */
  colonnaProprietario: string
  /** Messaggio quando il record non e' raggiungibile da chi chiede. */
  nonTrovato: string
}

const COLONNE = "id,testo,created_at,utente_id,menzioni,formato,allegati"

/**
 * Verifica in un colpo solo che chi chiede possa gestire le note, che veda
 * il record, e che la nota indicata appartenga davvero a quel record.
 *
 * L'ultimo controllo non e' pedanteria: senza, passando l'id di una nota di
 * un altro record si modificherebbe una nota che non si ha diritto di
 * toccare.
 */
async function verifica(config: NoteModuloConfig, recordId: string, notaId: string) {
  const guard = await requireApiRecord(config.modulo, "edit")
  if (guard.response) return { errore: guard.response }

  if (!guard.permissions.canAction(AZIONE_GESTIONE_NOTE)) {
    return { errore: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  }

  const nelPerimetro = await canAccessOwnedRecord(
    guard.permissions.snapshot,
    config.modulo,
    config.tabellaRecord,
    config.colonnaProprietario,
    recordId,
  )
  if (!nelPerimetro) {
    return { errore: NextResponse.json({ error: config.nonTrovato }, { status: 404 }) }
  }

  const supabase = await createClient()
  const { data: nota } = await supabase
    .from("attivita")
    .select("id")
    .eq("id", notaId)
    .eq("record_tipo", config.recordTipo)
    .eq("record_id", recordId)
    .eq("tipo", "nota")
    .eq("eliminato", false)
    .maybeSingle()

  if (!nota) {
    return { errore: NextResponse.json({ error: "Nota non trovata" }, { status: 404 }) }
  }

  return { guard, supabase }
}

export async function aggiornaNota(
  config: NoteModuloConfig,
  request: Request,
  recordId: string,
  notaId: string,
) {
  const esito = await verifica(config, recordId, notaId)
  if (esito.errore) return esito.errore
  const { guard, supabase } = esito

  const payload = await parseNotePayload(request)
  const testo = payload?.text?.trim() ?? ""
  if (!testo) return NextResponse.json({ error: "Nota vuota" }, { status: 400 })

  const risolte = await resolveNoteMentions(supabase, testo, payload?.mentions ?? [])

  const { data, error } = await supabase
    .from("attivita")
    .update({
      testo,
      menzioni: risolte.mentions,
      formato: "markdown",
      modificato_da: guard.permissions.snapshot.subject.userId,
      modificato_il: new Date().toISOString(),
    })
    .eq("id", notaId)
    .select(COLONNE)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Nessun avviso ai menzionati in modifica: chi era gia' menzionato lo
  // sapeva, e chi viene aggiunto correggendo un refuso non deve ricevere
  // una notifica per una nota di ieri.
  return NextResponse.json(data)
}

export async function eliminaNota(
  config: NoteModuloConfig,
  recordId: string,
  notaId: string,
) {
  const esito = await verifica(config, recordId, notaId)
  if (esito.errore) return esito.errore
  const { guard, supabase } = esito

  const { error } = await supabase
    .from("attivita")
    .update({
      eliminato: true,
      eliminato_il: new Date().toISOString(),
      modificato_da: guard.permissions.snapshot.subject.userId,
    })
    .eq("id", notaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
