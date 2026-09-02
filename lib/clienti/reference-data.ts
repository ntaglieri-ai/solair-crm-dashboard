import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { ClienteReferencePayload } from "@/lib/cliente-tag-store"

export async function loadClienteReferenceData(): Promise<ClienteReferencePayload> {
  const supabase = await createClient()
  const [tagsResult, ownersResult] = await Promise.all([
    supabase.from("tag").select("id,nome,colore,created_at").eq("modulo", "cliente").order("nome"),
    supabase.from("utenti").select("id,nome,attivo").order("nome"),
  ])

  const error = tagsResult.error ?? ownersResult.error
  if (error) throw new Error(`Riferimenti Cliente: ${error.message}`)

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
  }
}
