import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { ReferencePayload } from "@/lib/tag-store"

async function allAssignments() {
  const supabase = await createClient()
  const rows: Array<{ lead_id: string; tag_id: string }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("lead_tags")
      .select("lead_id,tag_id")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

export async function loadLeadReferenceData(): Promise<ReferencePayload> {
  const supabase = await createClient()
  const [tagsResult, ownersResult, installersResult, assignments] =
    await Promise.all([
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
      allAssignments(),
    ])

  const error = tagsResult.error ?? ownersResult.error ?? installersResult.error
  if (error) throw new Error(`Riferimenti Lead: ${error.message}`)

  return {
    tags: (tagsResult.data ?? []).map((tag) => ({
      id: tag.id,
      name: tag.nome,
      color: tag.colore,
    })),
    leadTagIds: assignments.reduce<Record<string, string[]>>(
      (result, assignment) => {
        ;(result[assignment.lead_id] ??= []).push(assignment.tag_id)
        return result
      },
      {},
    ),
    owners: ownersResult.data ?? [],
    installers: installersResult.data ?? [],
  }
}
