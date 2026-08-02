import { NextResponse } from "next/server"
import { searchRobertaKnowledge } from "@/lib/roberta/knowledge"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const expectedKey = process.env.LISTINO_READ_KEY
  if (!expectedKey) {
    console.error("[roberta-knowledge] LISTINO_READ_KEY non configurata")
    return NextResponse.json({ error: "Sorgente non configurata" }, { status: 503 })
  }

  const authHeader = request.headers.get("authorization") ?? ""
  const providedKey = authHeader.replace(/^Bearer\s+/i, "")
  if (providedKey !== expectedKey) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin client non configurato" },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""
  const limitParam = Number(searchParams.get("limit") ?? "8")
  const limit = Number.isFinite(limitParam)
    ? Math.min(20, Math.max(1, Math.round(limitParam)))
    : 8

  try {
    const result = await searchRobertaKnowledge(supabase, q, limit)
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Errore lettura conoscenza Roberta"
    console.error("[roberta-knowledge]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
