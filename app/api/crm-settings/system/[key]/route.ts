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
  const { key } = await params
  if (!isSystemSettingKey(key)) {
    return NextResponse.json({ error: "Configurazione non valida" }, { status: 400 })
  }
  const requiredAction =
    key === "company.profile"
      ? "company.profile.view"
      : key === "system.sedi"
        ? "company.sites.view"
        : key === "company.integrations.make"
          ? "maintenance.integrations.manage"
          : key === "maintenance.nextcloud"
            ? "maintenance.file_manager.manage"
          : "crm_settings.system.default_values.manage"
  const guard = await requireApiAction(requiredAction)
  if (guard.response) return guard.response
  if (
    (key === "company.integrations.make" || key === "maintenance.nextcloud") &&
    !guard.permissions.isSuperadmin
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
  const { key } = await params
  if (!isSystemSettingKey(key)) {
    return NextResponse.json({ error: "Configurazione non valida" }, { status: 400 })
  }
  const requiredAction =
    key === "company.profile"
      ? "company.profile.edit"
      : key === "system.sedi"
        ? "company.sites.manage"
        : key === "company.integrations.make"
          ? "maintenance.integrations.manage"
          : key === "maintenance.nextcloud"
            ? "maintenance.file_manager.manage"
          : "crm_settings.system.default_values.manage"
  const guard = await requireApiAction(requiredAction)
  if (guard.response) return guard.response
  if (
    (key === "company.integrations.make" || key === "maintenance.nextcloud") &&
    !guard.permissions.isSuperadmin
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
