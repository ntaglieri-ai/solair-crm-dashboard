// Persistenza cifrata delle app-password Nextcloud, tramite RPC pgcrypto.
// Tutto passa dal service_role (createAdminClient): i segreti non toccano mai
// un client autenticato dal browser.

import { createAdminClient } from "@/lib/supabase/admin"
import { nextcloudCredKey } from "./config"

export type NextcloudCredStatus = "active" | "pending" | "failed" | "disabled"

export type StoreCredentialParams = {
  utenteId: string
  username: string
  appPassword?: string | null
  status: NextcloudCredStatus
  lastError?: string | null
}

/**
 * Upsert cifrato della credenziale. Se appPassword e' assente/vuota la riga
 * viene aggiornata mantenendo l'eventuale password gia' salvata (utile per
 * aggiornare solo status/errore).
 */
export async function storeNextcloudCredential(
  params: StoreCredentialParams,
): Promise<{ error: string | null }> {
  const admin = createAdminClient()
  if (!admin) return { error: "Supabase service role non configurato" }

  const { error } = await admin.rpc("nextcloud_cred_upsert", {
    p_utente_id: params.utenteId,
    p_username: params.username,
    p_app_password: params.appPassword ?? null,
    p_key: nextcloudCredKey(),
    p_status: params.status,
    p_last_error: params.lastError ?? null,
  })

  return { error: error?.message ?? null }
}

/** Decifra e ritorna la app-password dell'utente, o null se assente. */
export async function getNextcloudAppPassword(
  utenteId: string,
): Promise<string | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const { data, error } = await admin.rpc("nextcloud_cred_get_password", {
    p_utente_id: utenteId,
    p_key: nextcloudCredKey(),
  })

  if (error) {
    console.error("[nextcloud] decrypt app-password fallita:", error.message)
    return null
  }
  return (data as string | null) ?? null
}

/**
 * Ritorna lo userid Nextcloud memorizzato per l'utente, o null se mai
 * provisionato (nessuna riga). Da chiamare PRIMA di cancellare la riga utenti:
 * la FK e' `on delete cascade`, quindi dopo la delete la credenziale (e con essa
 * nc_username) sparisce e non sapremmo piu' quale account NC rimuovere.
 */
export async function getNextcloudUsername(
  utenteId: string,
): Promise<string | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const { data, error } = await admin
    .from("nextcloud_credentials")
    .select("nc_username")
    .eq("utente_id", utenteId)
    .maybeSingle()

  if (error || !data) return null
  return (data.nc_username as string | null) ?? null
}

export type NextcloudCredentialRow = {
  utente_id: string
  nc_username: string
  status: NextcloudCredStatus
  last_error: string | null
  updated_at: string
  has_password: boolean
}

/** Legge lo stato di provisioning (senza segreti) per uno o piu' utenti. */
export async function getNextcloudCredentialStatuses(
  utenteIds?: string[],
): Promise<Map<string, NextcloudCredentialRow>> {
  const admin = createAdminClient()
  const map = new Map<string, NextcloudCredentialRow>()
  if (!admin) return map

  let query = admin
    .from("nextcloud_credentials")
    .select("utente_id, nc_username, status, last_error, updated_at, app_password_enc")
  if (utenteIds && utenteIds.length > 0) query = query.in("utente_id", utenteIds)

  const { data, error } = await query
  if (error || !data) return map

  for (const row of data as Array<Record<string, unknown>>) {
    map.set(row.utente_id as string, {
      utente_id: row.utente_id as string,
      nc_username: row.nc_username as string,
      status: row.status as NextcloudCredStatus,
      last_error: (row.last_error as string | null) ?? null,
      updated_at: row.updated_at as string,
      has_password: row.app_password_enc != null,
    })
  }
  return map
}
