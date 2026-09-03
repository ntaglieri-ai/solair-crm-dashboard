import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { ClienteReferencePayload } from "@/lib/cliente-tag-store"

export async function loadClienteReferenceData(): Promise<ClienteReferencePayload> {
  const supabase = await createClient()
  const [tagsResult, ownersResult, installerRowsResult] = await Promise.all([
    supabase.from("tag").select("id,nome,colore,created_at").eq("modulo", "cliente").order("nome"),
    supabase.from("utenti").select("id,nome,attivo").order("nome"),
    // Valori distinti REALI dalla colonna testo clienti.installatore — non
    // dall'anagrafica installatori, perche' e' quella colonna a essere
    // confrontata dal filtro server (vedi tipo ClienteReferencePayload).
    supabase.from("clienti").select("installatore").not("installatore", "is", null).neq("installatore", ""),
  ])

  const error = tagsResult.error ?? ownersResult.error ?? installerRowsResult.error
  if (error) throw new Error(`Riferimenti Cliente: ${error.message}`)

  const installerNames = [...new Set(
    (installerRowsResult.data ?? [])
      .map((row) => (row.installatore as string | null)?.trim())
      .filter((name): name is string => Boolean(name)),
  )].sort((a, b) => a.localeCompare(b))

  return {
    tags: (tagsResult.data ?? []).map((tag) => ({
      id: tag.id,
      name: tag.nome,
      color: tag.colore,
      createdAt: tag.created_at,
    })),
    // Le assegnazioni vengono caricate dalla query della sola pagina visibile.
    clienteTagIds: {},
    owners: (ownersResult.data ?? []).filter((owner) => owner.attivo).map(({ id, nome }) => ({ id, nome })),
    ownerNames: Object.fromEntries((ownersResult.data ?? []).map((owner) => [owner.id, owner.nome])),
    installerNames,
  }
}
