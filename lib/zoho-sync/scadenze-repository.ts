import { SCADENZE_CRM_SELECT_COLUMNS, type ScadenzaCrmRecord } from "./scadenze-mapping"
import { inChunks } from "./repository"
import { normalizeZohoId } from "./normalizers"
import type { SupabaseLike } from "./types"

export async function fetchScadenzeByZohoId(
  supabase: SupabaseLike,
  zohoIds: string[],
): Promise<Map<string, ScadenzaCrmRecord>> {
  const scadenze = new Map<string, ScadenzaCrmRecord>()
  const lookupIds = [...new Set(zohoIds.flatMap((id) => (id ? [id, `zcrm_${id}`] : [])))]

  await inChunks(lookupIds, async (chunk) => {
    const { data, error } = await supabase
      .from("scadenze")
      .select(SCADENZE_CRM_SELECT_COLUMNS.join(","))
      .in("zoho_id", chunk)
    if (error) throw new Error(`scadenze: ${error.message}`)

    for (const row of ((data ?? []) as unknown as ScadenzaCrmRecord[])) {
      if (row.zoho_id) scadenze.set(normalizeZohoId(row.zoho_id), row)
    }
  })

  return scadenze
}
