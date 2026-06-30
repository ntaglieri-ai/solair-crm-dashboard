import { createClient } from "@/lib/supabase/server"
import { loadCurrentAccountProfile } from "@/lib/crm-settings/current-account"
import { AccountManagementClient } from "./account-management-client"

type Utente = {
  id: string
  nome: string
  email: string
  ruolo: string
  ruolo_id: string | null
  sede: string
  attivo: boolean
  created_at: string
}

type RuoloProfilo = {
  id: string
  code: string
  nome: string
}

async function loadAccountManagementData() {
  const supabase = await createClient()
  const [
    currentProfile,
    { data: utenti, error: utentiError },
    { data: ruoli, error: ruoliError },
  ] =
    await Promise.all([
      loadCurrentAccountProfile(),
      supabase
        .from("utenti")
        .select("id, nome, email, ruolo, ruolo_id, sede, attivo, created_at")
        .order("nome"),
      supabase
        .from("ruoli")
        .select("id, code, nome")
        .order("ordinamento", { ascending: true }),
    ])

  const error = utentiError ?? ruoliError
  const normalizedRoles = ((ruoli ?? []) as RuoloProfilo[]).map((ruolo) => ({
    ...ruolo,
    code: ruolo.code ?? "",
  }))
  const rolesById = new Map(normalizedRoles.map((ruolo) => [ruolo.id, ruolo]))
  const rolesByCode = new Map(
    normalizedRoles.map((ruolo) => [ruolo.code.toUpperCase(), ruolo]),
  )

  return {
    initialUsers: ((utenti ?? []) as Utente[]).map((utente) => ({
      ...utente,
      ruolo:
        rolesById.get(utente.ruolo_id ?? "")?.code ??
        rolesByCode.get((utente.ruolo ?? "").toUpperCase())?.code ??
        utente.ruolo ??
        "",
      sede: utente.sede ?? "",
      attivo: utente.attivo !== false,
    })),
    initialRoles: normalizedRoles,
    currentProfile,
    initialError: error?.message ?? null,
  }
}

export default async function AccountManagementPage() {
  const data = await loadAccountManagementData()
  return <AccountManagementClient {...data} />
}
