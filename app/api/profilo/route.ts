import { NextResponse } from "next/server"

import { getCurrentPermissions } from "@/lib/permissions/server"
import { createClient } from "@/lib/supabase/server"
import {
  joinName,
  normalizeProfilePreferences,
  profileSettingsKey,
} from "@/lib/profile/personal-profile"

type ProfilePatchBody = {
  nome?: unknown
  cognome?: unknown
  email?: unknown
  preferences?: unknown
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

export async function PATCH(request: Request) {
  const permissions = await getCurrentPermissions()
  const subject = permissions.snapshot.subject
  if (!subject.authUserId || !subject.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as ProfilePatchBody | null
  if (!body) {
    return NextResponse.json({ error: "Payload non valido" }, { status: 400 })
  }
  if ("email" in body && body.email !== subject.email) {
    return NextResponse.json(
      { error: "L'email di accesso puo' essere modificata solo da un amministratore." },
      { status: 400 },
    )
  }

  const nome = cleanText(body.nome, 80)
  const cognome = cleanText(body.cognome, 80)
  const fullName = joinName(nome, cognome)
  if (!fullName) {
    return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 })
  }

  const preferences = normalizeProfilePreferences(body.preferences)
  const supabase = await createClient()
  const [{ error: userError }, { error: settingsError }] = await Promise.all([
    supabase
      .from("utenti")
      .update({ nome: fullName })
      .eq("id", subject.userId),
    supabase.from("crm_settings").upsert(
      {
        chiave: profileSettingsKey(subject.authUserId),
        valore: preferences,
        descrizione: "Preferenze profilo personale",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chiave" },
    ),
  ])

  const error = userError ?? settingsError
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    profile: {
      nome,
      cognome,
      fullName,
      preferences,
    },
  })
}
