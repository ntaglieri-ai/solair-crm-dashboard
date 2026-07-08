import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiRecord } from "@/lib/permissions/server"

export async function GET() {
  const guard = await requireApiRecord("compiti", "view")
  if (guard.response) return guard.response

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("utenti")
    .select("id,zoho_id,nome")
    .eq("attivo", true)
    .order("nome")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    proprietari: (data ?? []).map((u) => ({
      id: u.id as string,
      zoho_id: (u.zoho_id as string | null) ?? "",
      nome: (u.nome as string) ?? "",
    })),
  })
}
