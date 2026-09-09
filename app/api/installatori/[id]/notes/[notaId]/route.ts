import { aggiornaNota, eliminaNota, type NoteModuloConfig } from "@/lib/notes/note-crud-server"

/**
 * Modifica e cancellazione di una nota installatore.
 *
 * La logica sta in lib/notes/note-crud-server: le note di tutti i moduli
 * vivono nella stessa tabella, e qui cambia solo di quale record si tratta.
 */
const CONFIG: NoteModuloConfig = {
  modulo: "installatori",
  recordTipo: "installatore",
  tabellaRecord: "installatori",
  colonnaProprietario: "proprietario_id",
  nonTrovato: "Installatore non trovato",
}

type Params = { params: Promise<{ id: string; notaId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { id, notaId } = await params
  return aggiornaNota(CONFIG, request, id, notaId)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id, notaId } = await params
  return eliminaNota(CONFIG, id, notaId)
}
