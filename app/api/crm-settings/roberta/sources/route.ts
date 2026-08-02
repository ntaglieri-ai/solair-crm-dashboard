import { NextResponse } from "next/server"
import { requireApiPage } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  DEFAULT_ROBERTA_SOURCES,
  ROBERTA_SOURCE_CATEGORIES,
  type RobertaKnowledgeSourceConfig,
  type RobertaSourceCategory,
} from "@/lib/roberta/knowledge"

const SETTING_KEY = "roberta.knowledge.sources"

function isCategory(value: unknown): value is RobertaSourceCategory {
  return (
    typeof value === "string" &&
    ROBERTA_SOURCE_CATEGORIES.some((category) => category.value === value)
  )
}

function normalizeSource(value: unknown): RobertaKnowledgeSourceConfig | null {
  if (typeof value !== "object" || value == null) return null
  const source = value as Partial<RobertaKnowledgeSourceConfig>
  if (
    typeof source.id !== "string" ||
    typeof source.label !== "string" ||
    typeof source.path !== "string" ||
    !isCategory(source.categoria)
  ) {
    return null
  }
  return {
    id: source.id.trim() || crypto.randomUUID(),
    label: source.label.trim(),
    categoria: source.categoria,
    path: source.path.trim().replace(/^\/+|\/+$/g, ""),
    active: source.active !== false,
  }
}

export async function GET() {
  const guard = await requireApiPage("crm_settings.system.roberta")
  if (guard.response) return guard.response

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client non configurato" }, { status: 503 })
  }

  const { data, error } = await supabase
    .from("crm_settings")
    .select("valore")
    .eq("chiave", SETTING_KEY)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const stored = Array.isArray(data?.valore)
    ? data.valore.map(normalizeSource).filter(Boolean)
    : null

  return NextResponse.json({
    categories: ROBERTA_SOURCE_CATEGORIES,
    sources: stored?.length ? stored : DEFAULT_ROBERTA_SOURCES,
  })
}

export async function PUT(request: Request) {
  const guard = await requireApiPage("crm_settings.system.roberta")
  if (guard.response) return guard.response

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client non configurato" }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as { sources?: unknown } | null
  const sources = Array.isArray(body?.sources)
    ? body.sources.map(normalizeSource).filter(Boolean)
    : []

  if (sources.length === 0) {
    return NextResponse.json({ error: "Configura almeno una fonte Roberta" }, { status: 400 })
  }

  const { error } = await supabase
    .from("crm_settings")
    .upsert(
      {
        chiave: SETTING_KEY,
        valore: sources,
        descrizione: "Fonti documentali controllate per Roberta",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chiave" },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sources })
}
