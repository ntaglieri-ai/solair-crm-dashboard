import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiAction } from "@/lib/permissions/server"
import { isSystemSettingKey } from "@/lib/crm-settings/system-store"

type Params = {
  params: Promise<{ key: string }>
}

function isMissingStoreError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ""
  return (
    error?.code === "42P01" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  )
}

export async function GET(_request: Request, { params }: Params) {
  const guard = await requireApiAction("crm_settings.system.default_values.manage")
  if (guard.response) return guard.response

  const { key } = await params
  if (!isSystemSettingKey(key)) {
    return NextResponse.json({ error: "Configurazione non valida" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crm_settings")
    .select("valore")
    .eq("chiave", key)
    .maybeSingle()

  if (error) {
    if (isMissingStoreError(error)) return NextResponse.json({ value: null })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (data?.valore !== null && data?.valore !== undefined) {
    return NextResponse.json({ value: data.valore })
  }

  if (key === "system.sedi") {
    const { data: users, error: usersError } = await supabase
      .from("utenti")
      .select("sede")
      .not("sede", "is", null)

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    const counts = new Map<string, number>()
    for (const user of users ?? []) {
      const sede = user.sede?.trim()
      if (sede) counts.set(sede, (counts.get(sede) ?? 0) + 1)
    }

    return NextResponse.json({
      value: Array.from(counts, ([nome, utenti]) => ({
        id: `sede_${nome.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        nome,
        indirizzo: "",
        attiva: true,
        utenti,
      })),
    })
  }

  return NextResponse.json({ value: null })
}

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requireApiAction("crm_settings.system.default_values.manage")
  if (guard.response) return guard.response

  const { key } = await params
  if (!isSystemSettingKey(key)) {
    return NextResponse.json({ error: "Configurazione non valida" }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as { value?: unknown } | null
  if (!body || !("value" in body)) {
    return NextResponse.json({ error: "Payload non valido" }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("crm_settings")
    .upsert(
      {
        chiave: key,
        valore: body.value,
        descrizione: `Configurazione CRM: ${key}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chiave" },
    )

  if (error) {
    if (isMissingStoreError(error)) {
      return NextResponse.json(
        { error: "Tabella crm_settings non disponibile su Supabase." },
        { status: 500 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
