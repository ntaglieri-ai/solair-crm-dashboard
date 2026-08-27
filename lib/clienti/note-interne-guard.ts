import { NextResponse } from "next/server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import { canAccessNoteInterne } from "./note-interne"

/**
 * Guard delle route delle note interne.
 *
 * Risponde 404, non 403: il requisito e' "zero tracce per gli altri
 * ruoli", e un 403 confermerebbe che a quell'indirizzo c'e' qualcosa.
 * Un agente che curiosa l'endpoint vede la stessa risposta che vedrebbe
 * per una rotta inesistente.
 */
export async function requireApiNoteInterne() {
  const permissions = await getCurrentPermissions()
  if (!canAccessNoteInterne(permissions.snapshot.subject.ruoloCode)) {
    return {
      permissions,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    }
  }
  return { permissions, response: null }
}
