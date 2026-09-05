import { NextResponse } from "next/server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  ROBERTA_LAST_SYNC_SETTING_KEY,
  runRobertaKnowledgeSync,
} from "@/lib/roberta/sync-runner"

export const runtime = "nodejs"
export const maxDuration = 120

async function requireRobertaCatalogAccess() {
  const permissions = await getCurrentPermissions()
  if (
    !permissions.canPage("crm_settings.system.roberta") &&
    !permissions.canAction("offerta_commerciale.manage")
  ) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { response: null }
}

export async function GET() {
  const guard = await requireRobertaCatalogAccess()
  if (guard.response) return guard.response

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin client non configurato" },
      { status: 503 },
    )
  }

  const [
    { count: sources },
    { count: chunks },
    { count: catalogItems },
    { data: recentSources },
    { data: lastSyncSetting },
  ] = await Promise.all([
    supabase
      .from("roberta_knowledge_sources")
      .select("source_key", { count: "exact", head: true }),
    supabase
      .from("roberta_knowledge_chunks")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("roberta_catalog_items")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("roberta_knowledge_sources")
      .select("nome, cartella, stato, testo_chars, synced_at, errore")
      .order("synced_at", { ascending: false })
      .limit(8),
    supabase
      .from("crm_settings")
      .select("valore")
      .eq("chiave", ROBERTA_LAST_SYNC_SETTING_KEY)
      .maybeSingle(),
  ])

  const lastSyncValue = lastSyncSetting?.valore
  const lastSync =
    typeof lastSyncValue === "object" &&
    lastSyncValue != null &&
    typeof (lastSyncValue as { syncedAt?: unknown }).syncedAt === "string"
      ? {
          ok: (lastSyncValue as { ok?: unknown }).ok === true,
          syncedAt: (lastSyncValue as { syncedAt: string }).syncedAt,
          error:
            typeof (lastSyncValue as { error?: unknown }).error === "string"
              ? (lastSyncValue as { error: string }).error
              : null,
        }
      : null

  return NextResponse.json({
    sources: sources ?? 0,
    chunks: chunks ?? 0,
    catalogItems: catalogItems ?? 0,
    lastSync,
    recentSources: recentSources ?? [],
  })
}

export async function POST(request: Request) {
  const guard = await requireRobertaCatalogAccess()
  if (guard.response) return guard.response

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin client non configurato" },
      { status: 503 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as { force?: boolean }

  try {
    const result = await runRobertaKnowledgeSync({ force: body.force === true })
    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Errore aggiornamento conoscenza Roberta"
    console.error("[roberta/knowledge/sync]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
