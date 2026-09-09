import { NOTE_INTERNE_CLIENTI } from "@/lib/notes/note-interne-config"
import { requireApiNoteInterne as requireApiNoteInterneGenerico } from "@/lib/notes/note-interne-guard"

/**
 * Guard delle note interne del Cliente.
 *
 * La logica sta in @/lib/notes/note-interne-guard, condivisa con
 * Installatori: qui resta solo l'aggancio alla configurazione del modulo,
 * cosi' le route del Cliente non cambiano.
 */
export function requireApiNoteInterne(clienteId?: string) {
  return requireApiNoteInterneGenerico(NOTE_INTERNE_CLIENTI, clienteId)
}
