import { INSTALLATORI_CRM_SELECT_COLUMNS, type InstallatoreCrmRecord } from "./installatori-mapping"
import { inChunks } from "./repository"
import { normalizeZohoId } from "./normalizers"
import type { SupabaseLike } from "./types"

export async function fetchInstallatoriByZohoId(
  supabase: SupabaseLike,
  zohoIds: string[],
): Promise<Map<string, InstallatoreCrmRecord>> {
  const installatori = new Map<string, InstallatoreCrmRecord>()
  const lookupIds = [...new Set(zohoIds.flatMap((id) => (id ? [id, `zcrm_${id}`] : [])))]

  await inChunks(lookupIds, async (chunk) => {
    let columns: string[] = [...INSTALLATORI_CRM_SELECT_COLUMNS]
    let data: unknown[] | null = null
    for (;;) {
      const result = await supabase
        .from("installatori")
        .select(columns.join(","))
        .in("zoho_id", chunk)
      if (!result.error) {
        data = (result.data ?? []) as unknown[]
        break
      }

      const missingColumn = result.error.message.match(/column installatori\.([a-zA-Z0-9_]+) does not exist/)?.[1]
      if (!missingColumn || !columns.includes(missingColumn)) {
        throw new Error(`installatori: ${result.error.message}`)
      }
      columns = columns.filter((column) => column !== missingColumn)
    }

    for (const row of ((data ?? []) as unknown as InstallatoreCrmRecord[])) {
      if (row.zoho_id) installatori.set(normalizeZohoId(row.zoho_id), row)
    }
  })

  return installatori
}
