import { createClient } from "@/lib/supabase/server"
import { currentAccountProfileFromSnapshot } from "@/lib/crm-settings/current-account"
import { loadCurrentPermissionSnapshot } from "@/lib/permissions/load-permissions"
import { getNextcloudCredentialStatuses } from "@/lib/nextcloud/credentials"
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
    currentPermissions,
    { data: utenti, error: utentiError },
    { data: ruoli, error: ruoliError },
  ] =
    await Promise.all([
      loadCurrentPermissionSnapshot(),
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

  const ncStatuses = await getNextcloudCredentialStatuses(
    ((utenti ?? []) as Utente[]).map((u) => u.id),
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
      nextcloud_status: ncStatuses.get(utente.id)?.status ?? "pending",
      nextcloud_error: ncStatuses.get(utente.id)?.last_error ?? null,
    })),
    initialRoles: normalizedRoles,
    currentProfile: currentAccountProfileFromSnapshot(currentPermissions),
    initialError: error?.message ?? null,
  }
}

export default async function AccountManagementPage() {
  const data = await loadAccountManagementData()
  return <AccountManagementClient {...data} />
}
