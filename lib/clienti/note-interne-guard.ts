import { NextResponse } from "next/server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import { canAccessOwnedRecord } from "@/lib/permissions/data-scope"

/**
 * Guard delle route delle note interne.
 *
 * Risponde 404, non 403: il requisito e' "zero tracce per gli altri
 * ruoli", e un 403 confermerebbe che a quell'indirizzo c'e' qualcosa.
 * Un agente che curiosa l'endpoint vede la stessa risposta che vedrebbe
 * per una rotta inesistente.
 */
export async function requireApiNoteInterne(clienteId?: string) {
  const permissions = await getCurrentPermissions()
  const allowedRecord = !clienteId || await canAccessOwnedRecord(
    permissions.snapshot,
    "clienti",
    "clienti",
    "clienti_proprietario_id",
    clienteId,
  )
  if (!permissions.canAction("clienti.note_interne.view") || !allowedRecord) {
    return {
      permissions,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    }
  }
  return { permissions, response: null }
}
