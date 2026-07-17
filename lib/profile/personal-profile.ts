import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { PermissionSnapshot } from "@/lib/permissions/types"

export type PersonalProfilePreferences = {
  telefono: string
  mansione: string
  bio: string
  avatarMode: "initials" | "photo"
  avatarColor: string
  avatarUrl: string
}

export type PersonalProfileData = {
  id: string | null
  authUserId: string
  nome: string
  cognome: string
  fullName: string
  email: string
  ruoloNome: string
  ruoloCode: string
  sede: string | null
  createdAt: string | null
  preferences: PersonalProfilePreferences
}

const DEFAULT_PREFERENCES: PersonalProfilePreferences = {
  telefono: "",
  mansione: "",
  bio: "",
  avatarMode: "initials",
  avatarColor: "#1e3a5f",
  avatarUrl: "",
}

export function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { nome: parts[0] ?? "", cognome: "" }
  return {
    nome: parts.slice(0, -1).join(" "),
    cognome: parts.at(-1) ?? "",
  }
}

export function joinName(nome: string, cognome: string) {
  return [nome.trim(), cognome.trim()].filter(Boolean).join(" ")
}

export function normalizeProfilePreferences(value: unknown): PersonalProfilePreferences {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const avatarMode = input.avatarMode === "photo" ? "photo" : "initials"
  const avatarColor =
    typeof input.avatarColor === "string" && /^#[0-9a-f]{6}$/i.test(input.avatarColor)
      ? input.avatarColor
      : DEFAULT_PREFERENCES.avatarColor

  return {
    telefono: typeof input.telefono === "string" ? input.telefono.slice(0, 40) : "",
    mansione: typeof input.mansione === "string" ? input.mansione.slice(0, 80) : "",
    bio: typeof input.bio === "string" ? input.bio.slice(0, 320) : "",
    avatarMode,
    avatarColor,
    avatarUrl: typeof input.avatarUrl === "string" ? input.avatarUrl.slice(0, 600_000) : "",
  }
}

export function profileSettingsKey(authUserId: string) {
  return `user.profile.${authUserId}`
}

export async function loadPersonalProfile(
  snapshot: PermissionSnapshot,
): Promise<PersonalProfileData | null> {
  const subject = snapshot.subject
  if (!subject.authUserId) return null

  const supabase = await createClient()
  const [utenteResult, settingsResult] = await Promise.all([
    subject.userId
      ? supabase
          .from("utenti")
          .select("id,nome,email,sede,created_at")
          .eq("id", subject.userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("crm_settings")
      .select("valore")
      .eq("chiave", profileSettingsKey(subject.authUserId))
      .maybeSingle(),
  ])

  const row = utenteResult.data as {
    id?: string
    nome?: string | null
    email?: string | null
    sede?: string | null
    created_at?: string | null
  } | null
  const fullName = row?.nome ?? subject.nome
  const nameParts = splitFullName(fullName)

  return {
    id: row?.id ?? subject.userId,
    authUserId: subject.authUserId,
    nome: nameParts.nome,
    cognome: nameParts.cognome,
    fullName,
    email: row?.email ?? subject.email ?? "",
    ruoloNome: subject.ruoloNome,
    ruoloCode: String(subject.ruoloCode),
    sede: row?.sede ?? subject.sede,
    createdAt: row?.created_at ?? null,
    preferences: normalizeProfilePreferences(settingsResult.data?.valore),
  }
}
