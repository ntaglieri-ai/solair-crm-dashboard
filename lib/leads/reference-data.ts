import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { ReferencePayload } from "@/lib/tag-store"

export async function loadLeadReferenceData(): Promise<ReferencePayload> {
  const supabase = await createClient()
  const [tagsResult, ownersResult, installersResult] = await Promise.all([
      supabase
        .from("tag")
        .select("id,nome,colore")
        .eq("modulo", "lead")
        .order("nome"),
      supabase
        .from("utenti")
        .select("id,nome")
        .eq("attivo", true)
        .order("nome"),
      supabase
        .from("installatori")
        .select("id,nome")
        .eq("attivo", true)
        .order("nome"),
    ])

  const error = tagsResult.error ?? ownersResult.error ?? installersResult.error
  if (error) throw new Error(`Riferimenti Lead: ${error.message}`)

  return {
    tags: (tagsResult.data ?? []).map((tag) => ({
      id: tag.id,
      name: tag.nome,
      color: tag.colore,
    })),
    // Le assegnazioni vengono caricate dalla query della sola pagina visibile.
    leadTagIds: {},
    owners: ownersResult.data ?? [],
    installers: installersResult.data ?? [],
  }
}
