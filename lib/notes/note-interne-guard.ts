import { NextResponse } from "next/server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import { canAccessOwnedRecord } from "@/lib/permissions/data-scope"
import { canAccessNoteInterne } from "@/lib/clienti/note-interne"
import type { NoteInterneConfig } from "./note-interne-config"

/**
 * Guard delle route delle note interne.
 *
 * Tre condizioni insieme: il ruolo deve essere fra quelli ammessi, il
 * permesso di lettura delle note interne deve essere concesso, e il record
 * deve rientrare nel perimetro di visibilita' di chi chiede.
 *
 * Risponde 404 e non 403: a chi non ha accesso, queste note non devono
 * risultare nemmeno esistenti — un 403 confermerebbe che c'e' qualcosa da
 * vedere. La RLS resta comunque l'ultimo controllo.
 */
export async function requireApiNoteInterne(config: NoteInterneConfig, recordId?: string) {
  const permissions = await getCurrentPermissions()

  const allowedRecord =
    !recordId ||
    (await canAccessOwnedRecord(
      permissions.snapshot,
      config.modulo,
      config.tabellaRecord,
      config.colonnaProprietario,
      recordId,
    ))

  if (
    !canAccessNoteInterne(permissions.snapshot.subject.ruoloCode) ||
    !permissions.canAction(config.azione) ||
    !allowedRecord
  ) {
    return {
      permissions,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    }
  }

  return { permissions, response: null }
}
