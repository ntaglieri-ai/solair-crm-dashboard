import type { SupabaseClient } from "@supabase/supabase-js"

export const CODICE_SCONTO_TAG = {
  name: "Codice sconto",
  color: "#F97316",
}

export async function ensureLeadTag(
  supabase: SupabaseClient,
  name = CODICE_SCONTO_TAG.name,
  color = CODICE_SCONTO_TAG.color,
): Promise<string> {
  const normalized = name.trim()
  if (!normalized) throw new Error("Nome tag non valido")

  const lookup = await supabase
    .from("tag")
    .select("id")
    .eq("modulo", "lead")
    .ilike("nome", normalized)
    .maybeSingle()

  if (lookup.error) throw new Error(`ensureLeadTag lookup: ${lookup.error.message}`)
  if (lookup.data?.id) return lookup.data.id as string

  const created = await supabase
    .from("tag")
    .insert({ nome: normalized, colore: color, modulo: "lead" })
    .select("id")
    .single()

  if (!created.error && created.data?.id) return created.data.id as string

  const retry = await supabase
    .from("tag")
    .select("id")
    .eq("modulo", "lead")
    .ilike("nome", normalized)
    .maybeSingle()

  if (retry.error || !retry.data?.id) {
    throw new Error(`ensureLeadTag insert: ${created.error?.message ?? retry.error?.message ?? "tag non creato"}`)
  }

  return retry.data.id as string
}

export async function assignLeadTag(
  supabase: SupabaseClient,
  leadId: string,
  tagId: string,
) {
  const assigned = await supabase
    .from("lead_tags")
    .upsert({ lead_id: leadId, tag_id: tagId }, { onConflict: "lead_id,tag_id" })

  if (assigned.error) throw new Error(`assignLeadTag: ${assigned.error.message}`)
}
