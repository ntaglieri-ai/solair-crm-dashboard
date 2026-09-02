import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentPermissions } from "@/lib/permissions/server"

export async function GET() {
  const permissions = await getCurrentPermissions()
  if (!permissions.snapshot.subject.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("utenti")
    .select("id,nome")
    .eq("attivo", true)
    .order("nome")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data ?? [] })
}
