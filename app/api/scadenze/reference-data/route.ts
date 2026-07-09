import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiRecord } from "@/lib/permissions/server"
import { getDistinctScadenzaTags } from "@/lib/scadenze/repository"

export async function GET() {
  const guard = await requireApiRecord("scadenze", "view")
  if (guard.response) return guard.response

  const supabase = await createClient()
  const [{ data, error }, tags] = await Promise.all([
    supabase.from("utenti").select("id,nome").eq("attivo", true).order("nome"),
    getDistinctScadenzaTags(),
  ])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    proprietari: (data ?? []).map((u) => ({
      id: u.id as string,
      nome: (u.nome as string) ?? "",
    })),
    tags,
  })
}
