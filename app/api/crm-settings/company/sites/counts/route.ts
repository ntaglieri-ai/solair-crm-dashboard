import { NextResponse } from "next/server"
import { requireApiAction } from "@/lib/permissions/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const guard = await requireApiAction("company.sites.view")
  if (guard.response) return guard.response

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("utenti")
    .select("sede")
    .not("sede", "is", null)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const counts: Record<string, number> = {}
  for (const user of data ?? []) {
    const site = user.sede?.trim()
    if (site) counts[site] = (counts[site] ?? 0) + 1
  }
  return NextResponse.json({ counts })
}
