import { createAdminClient } from "@/lib/supabase/admin"
import {
  DEFAULT_ROBERTA_SOURCES,
  fetchRobertaConfiguredDocuments,
  syncRobertaKnowledge,
  type RobertaKnowledgeSourceConfig,
} from "@/lib/roberta/knowledge"

const SOURCES_SETTING_KEY = "roberta.knowledge.sources"
export const ROBERTA_LAST_SYNC_SETTING_KEY = "roberta.knowledge.last_sync"

export async function loadRobertaSources(supabase: ReturnType<typeof createAdminClient>) {
  if (!supabase) return DEFAULT_ROBERTA_SOURCES
  const { data } = await supabase
    .from("crm_settings")
    .select("valore")
    .eq("chiave", SOURCES_SETTING_KEY)
    .maybeSingle()

  return Array.isArray(data?.valore) && data.valore.length > 0
    ? (data.valore as RobertaKnowledgeSourceConfig[])
    : DEFAULT_ROBERTA_SOURCES
}

export async function runRobertaKnowledgeSync(options: { force?: boolean } = {}) {
  const supabase = createAdminClient()
  if (!supabase) {
    throw new Error("Supabase admin client non configurato")
  }

  const started = Date.now()
  const syncedAt = new Date().toISOString()

  try {
    const sources = await loadRobertaSources(supabase)
    const documenti = await fetchRobertaConfiguredDocuments(supabase, sources)
    const result = await syncRobertaKnowledge(supabase, documenti, {
      force: options.force === true,
      activeSources: sources.filter((source) => source.active).length,
    })
    await supabase.from("crm_settings").upsert(
      {
        chiave: ROBERTA_LAST_SYNC_SETTING_KEY,
        valore: {
          ok: result.errors.length === 0,
          syncedAt,
          durationMs: Date.now() - started,
          force: options.force === true,
          result,
          warnings: result.warnings,
          error: result.errors[0] ?? null,
        },
        descrizione: "Ultimo controllo automatico/manuale conoscenza RobertaBot",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chiave" },
    )
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sync RobertaBot"
    await supabase.from("crm_settings").upsert(
      {
        chiave: ROBERTA_LAST_SYNC_SETTING_KEY,
        valore: {
          ok: false,
          syncedAt,
          durationMs: Date.now() - started,
          force: options.force === true,
          result: null,
          error: message,
        },
        descrizione: "Ultimo controllo automatico/manuale conoscenza RobertaBot",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chiave" },
    )
    throw error
  }
}
