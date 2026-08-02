import { NextResponse } from "next/server"
import { requireApiPage } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  fetchListinoDocuments,
  syncRobertaKnowledge,
} from "@/lib/roberta/knowledge"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET() {
  const guard = await requireApiPage("crm_settings.system.roberta")
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
  ])

  return NextResponse.json({
    sources: sources ?? 0,
    chunks: chunks ?? 0,
    catalogItems: catalogItems ?? 0,
    recentSources: recentSources ?? [],
  })
}

export async function POST(request: Request) {
  const guard = await requireApiPage("crm_settings.system.roberta")
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
    const documenti = await fetchListinoDocuments(request.url)
    const result = await syncRobertaKnowledge(supabase, documenti, {
      force: body.force === true,
    })
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
