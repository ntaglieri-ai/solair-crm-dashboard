import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import { normalizeAppearance } from "@/lib/crm-settings/appearance"

async function context() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const permissions = await getCurrentPermissions()
  if (!permissions.canAction("appearance.personal.manage")) return null
  return { supabase, user }
}

export async function GET() {
  const current = await context()
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const key = `user.appearance.${current.user.id}`
  const { data, error } = await current.supabase
    .from("crm_settings")
    .select("valore")
    .eq("chiave", key)
    .maybeSingle()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ value: normalizeAppearance(data?.valore) })
}

export async function PATCH(request: Request) {
  const current = await context()
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = (await request.json().catch(() => null)) as {
    value?: unknown
  } | null
  if (!body || !("value" in body)) {
    return NextResponse.json({ error: "Payload non valido" }, { status: 400 })
  }
  const key = `user.appearance.${current.user.id}`
  const value = normalizeAppearance(body.value)
  const { error } = await current.supabase.from("crm_settings").upsert(
    {
      chiave: key,
      valore: value,
      descrizione: "Preferenze aspetto account",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chiave" },
  )
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, value })
}
