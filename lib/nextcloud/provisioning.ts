// Provisioning Nextcloud via OCS Provisioning API (admin basic auth).
// Flusso per nuovo utente CRM:
//   1. POST cloud/users            -> crea account con la stessa password
//                                     temporanea usata da Supabase Auth
//   2. GET  core/getapppassword    -> autenticato COME il nuovo utente, conia
//                                     una app-password revocabile
//   3. la app-password viene cifrata e salvata (vedi credentials.ts)
// La password principale non viene salvata dal CRM; serve al login web ed e'
// riallineata a ogni cambio/reset. WebDAV usa una app-password separata.

import { randomBytes } from "node:crypto"
import {
  basicAuth,
  nextcloudAdminConfig,
  nextcloudUsernameFromEmail,
  ocsHeaders,
  type NextcloudAdminConfig,
} from "./config"
import {
  getNextcloudAppPassword,
  storeNextcloudCredential,
  type NextcloudCredStatus,
} from "./credentials"

type OcsMeta = { status: string; statuscode: number; message: string }

const CRM_NEXTCLOUD_GROUPS = new Set([
  "solair-superadmin",
  "solair-admin",
  "solair-director",
  "solair-standard",
  "solair-agent",
])
const LEGACY_CRM_GROUPS = new Set(["agent", "director", "standard"])

export function nextcloudGroupForRole(roleCode: string): string | null {
  const normalized = roleCode.trim().toUpperCase()
  if (!["SUPERADMIN", "ADMIN", "DIRECTOR", "STANDARD", "AGENT"].includes(normalized)) {
    return null
  }
  return `solair-${normalized.toLowerCase()}`
}

// La Provisioning API restituisce 100 (OCS v1) o 200 (OCS v2) in caso di
// successo; 102 = risorsa gia' esistente.
function isOcsOk(meta: OcsMeta): boolean {
  return meta.statuscode === 100 || meta.statuscode === 200
}

async function parseOcs(res: Response): Promise<{ meta: OcsMeta; data: unknown }> {
  const text = await res.text()
  try {
    const json = JSON.parse(text) as { ocs?: { meta?: OcsMeta; data?: unknown } }
    return {
      meta: json.ocs?.meta ?? { status: "failure", statuscode: res.status, message: text.slice(0, 200) },
      data: json.ocs?.data ?? null,
    }
  } catch {
    return {
      meta: { status: "failure", statuscode: res.status, message: text.slice(0, 200) || res.statusText },
      data: null,
    }
  }
}

async function ocsRequest(
  cfg: NextcloudAdminConfig,
  path: string,
  init: RequestInit = {},
): Promise<{ meta: OcsMeta; data: unknown }> {
  const headers = new Headers(init.headers)
  headers.set("Authorization", basicAuth(cfg.adminUser, cfg.adminPassword))
  headers.set("OCS-APIRequest", "true")
  headers.set("Accept", "application/json")
  return parseOcs(
    await fetch(`${cfg.baseUrl}/ocs/v2.php/cloud/${path}${path.includes("?") ? "&" : "?"}format=json`, {
      ...init,
      headers,
    }),
  )
}

/**
 * Rende il gruppo Nextcloud una proiezione del ruolo CRM. Aggiunge sempre il
 * gruppo nuovo prima di rimuovere quelli vecchi, e non tocca mai gruppi non
 * gestiti (in particolare il gruppo amministrativo nativo `admin`).
 */
export async function syncNextcloudUserGroup(
  userid: string,
  roleCode: string,
): Promise<{ ok: boolean; group: string | null; error: string | null }> {
  const cfg = nextcloudAdminConfig()
  const desired = nextcloudGroupForRole(roleCode)
  if (!cfg) return { ok: false, group: desired, error: "Credenziali admin Nextcloud non configurate" }
  if (!desired) return { ok: false, group: null, error: `Ruolo CRM non supportato: ${roleCode}` }

  try {
    const created = await ocsRequest(cfg, "groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ groupid: desired }),
    })
    // 102 = il gruppo esiste gia'.
    if (!isOcsOk(created.meta) && created.meta.statuscode !== 102) {
      return { ok: false, group: desired, error: `Creazione gruppo ${desired} fallita (OCS ${created.meta.statuscode}: ${created.meta.message})` }
    }

    const added = await ocsRequest(cfg, `users/${encodeURIComponent(userid)}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ groupid: desired }),
    })
    // Alcune versioni rispondono 102 se l'utente e' gia' nel gruppo.
    if (!isOcsOk(added.meta) && added.meta.statuscode !== 102) {
      return { ok: false, group: desired, error: `Assegnazione a ${desired} fallita (OCS ${added.meta.statuscode}: ${added.meta.message})` }
    }

    const current = await ocsRequest(cfg, `users/${encodeURIComponent(userid)}`)
    if (!isOcsOk(current.meta)) {
      return { ok: false, group: desired, error: `Lettura gruppi utente fallita (OCS ${current.meta.statuscode}: ${current.meta.message})` }
    }
    const groups = ((current.data as { groups?: unknown } | null)?.groups ?? []) as unknown
    const currentGroups = Array.isArray(groups) ? groups.filter((g): g is string => typeof g === "string") : []

    for (const group of currentGroups) {
      if (group === desired || (!CRM_NEXTCLOUD_GROUPS.has(group) && !LEGACY_CRM_GROUPS.has(group))) continue
      const removed = await ocsRequest(
        cfg,
        `users/${encodeURIComponent(userid)}/groups?groupid=${encodeURIComponent(group)}`,
        { method: "DELETE" },
      )
      if (!isOcsOk(removed.meta)) {
        return { ok: false, group: desired, error: `Rimozione dal vecchio gruppo ${group} fallita (OCS ${removed.meta.statuscode}: ${removed.meta.message})` }
      }
    }

    return { ok: true, group: desired, error: null }
  } catch (e) {
    return { ok: false, group: desired, error: e instanceof Error ? e.message : "Errore rete Nextcloud" }
  }
}

/** Password casuale forte (classi miste) che rispetta le policy Nextcloud. */
export function generateStrongPassword(): string {
  const raw = randomBytes(24).toString("base64").replace(/[^a-zA-Z0-9]/g, "")
  // Garantisce almeno una maiuscola, una minuscola, un numero e un simbolo.
  return `Aa1!${raw}`.slice(0, 28)
}

export type ProvisionResult = {
  status: NextcloudCredStatus
  username: string
  appPassword: string | null
  error: string | null
}

/**
 * Allinea la password principale di un account Nextcloud tramite Provisioning
 * API. La password non viene salvata: l'app-password tecnica WebDAV resta
 * separata e continua a essere valida.
 */
export async function setNextcloudUserPassword(
  userid: string,
  password: string,
): Promise<{ ok: boolean; error: string | null }> {
  const cfg = nextcloudAdminConfig()
  if (!cfg) return { ok: false, error: "Credenziali admin Nextcloud non configurate" }

  try {
    const res = await fetch(
      `${cfg.baseUrl}/ocs/v2.php/cloud/users/${encodeURIComponent(userid)}?format=json`,
      {
        method: "PUT",
        headers: ocsHeaders({
          Authorization: basicAuth(cfg.adminUser, cfg.adminPassword),
          "Content-Type": "application/x-www-form-urlencoded",
        }),
        body: new URLSearchParams({ key: "password", value: password }),
      },
    )
    const { meta } = await parseOcs(res)
    if (isOcsOk(meta)) return { ok: true, error: null }
    return { ok: false, error: `OCS ${meta.statuscode}: ${meta.message}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Errore rete Nextcloud" }
  }
}

/**
 * Crea l'account Nextcloud. Ritorna lo statuscode OCS (100 = ok, 102 = esiste).
 *
 * NB: l'email NON viene passata alla creazione di proposito. Nextcloud invia
 * la propria mail di benvenuto ("Welcome to Storage Share") solo se `email` e'
 * valorizzata nella POST addUser (vedi UsersController::addUser upstream). Per
 * l'utente finale l'account Nextcloud e' invisibile: l'accesso passa sempre
 * dal CRM via app-password — quindi quella mail e' rumore indesiderato e va
 * soppressa. L'email viene impostata subito dopo via setUserEmail (PUT
 * editUser), che NON scatena alcuna mail di benvenuto.
 */
async function createUser(
  cfg: NextcloudAdminConfig,
  params: { userid: string; password: string; displayName: string },
): Promise<OcsMeta> {
  const body = new URLSearchParams({
    userid: params.userid,
    password: params.password,
    displayName: params.displayName,
  })
  const res = await fetch(`${cfg.baseUrl}/ocs/v2.php/cloud/users?format=json`, {
    method: "POST",
    headers: ocsHeaders({
      Authorization: basicAuth(cfg.adminUser, cfg.adminPassword),
      "Content-Type": "application/x-www-form-urlencoded",
    }),
    body,
  })
  const { meta } = await parseOcs(res)
  return meta
}

/**
 * Imposta l'email dell'account via PUT editUser (key=email). A differenza della
 * creazione con email, questo NON invia la mail di benvenuto di Nextcloud.
 */
async function setUserEmail(
  cfg: NextcloudAdminConfig,
  userid: string,
  email: string,
): Promise<OcsMeta> {
  const res = await fetch(
    `${cfg.baseUrl}/ocs/v2.php/cloud/users/${encodeURIComponent(userid)}?format=json`,
    {
      method: "PUT",
      headers: ocsHeaders({
        Authorization: basicAuth(cfg.adminUser, cfg.adminPassword),
        "Content-Type": "application/x-www-form-urlencoded",
      }),
      body: new URLSearchParams({ key: "email", value: email }),
    },
  )
  const { meta } = await parseOcs(res)
  return meta
}

/**
 * Conia una app-password autenticandosi COME l'utente appena creato
 * (basic auth userid:password iniziale). Stessa tecnica OCS di open/route.ts.
 */
async function mintAppPassword(
  cfg: NextcloudAdminConfig,
  userid: string,
  password: string,
): Promise<string | null> {
  const res = await fetch(`${cfg.baseUrl}/ocs/v2.php/core/getapppassword?format=json`, {
    headers: ocsHeaders({ Authorization: basicAuth(userid, password) }),
  })
  const { meta, data } = await parseOcs(res)
  if (!isOcsOk(meta)) return null
  const apppassword = (data as { apppassword?: string } | null)?.apppassword
  return apppassword ?? null
}

/** Verifica l'esistenza di un account (admin). true/false, null se errore rete. */
export async function nextcloudUserExists(userid: string): Promise<boolean | null> {
  const cfg = nextcloudAdminConfig()
  if (!cfg) return null
  try {
    const res = await fetch(
      `${cfg.baseUrl}/ocs/v2.php/cloud/users/${encodeURIComponent(userid)}?format=json`,
      { headers: ocsHeaders({ Authorization: basicAuth(cfg.adminUser, cfg.adminPassword) }) },
    )
    const { meta } = await parseOcs(res)
    return isOcsOk(meta)
  } catch {
    return null
  }
}

/** Abilita/disabilita un account Nextcloud (OCS enable/disable). */
export async function setNextcloudUserEnabled(
  userid: string,
  enabled: boolean,
): Promise<{ ok: boolean; error: string | null }> {
  const cfg = nextcloudAdminConfig()
  if (!cfg) return { ok: false, error: "Credenziali admin Nextcloud non configurate" }
  try {
    const action = enabled ? "enable" : "disable"
    const res = await fetch(
      `${cfg.baseUrl}/ocs/v2.php/cloud/users/${encodeURIComponent(userid)}/${action}?format=json`,
      {
        method: "PUT",
        headers: ocsHeaders({ Authorization: basicAuth(cfg.adminUser, cfg.adminPassword) }),
      },
    )
    const { meta } = await parseOcs(res)
    if (isOcsOk(meta)) return { ok: true, error: null }
    return { ok: false, error: `OCS ${meta.statuscode}: ${meta.message}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Errore rete Nextcloud" }
  }
}

/** Elimina un account Nextcloud (usato in cleanup/test). */
export async function deleteNextcloudUser(
  userid: string,
): Promise<{ ok: boolean; error: string | null }> {
  const cfg = nextcloudAdminConfig()
  if (!cfg) return { ok: false, error: "Credenziali admin Nextcloud non configurate" }
  try {
    const res = await fetch(
      `${cfg.baseUrl}/ocs/v2.php/cloud/users/${encodeURIComponent(userid)}?format=json`,
      {
        method: "DELETE",
        headers: ocsHeaders({ Authorization: basicAuth(cfg.adminUser, cfg.adminPassword) }),
      },
    )
    const { meta } = await parseOcs(res)
    if (isOcsOk(meta)) return { ok: true, error: null }
    return { ok: false, error: `OCS ${meta.statuscode}: ${meta.message}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Errore rete Nextcloud" }
  }
}

/**
 * Orchestrazione completa: crea account (se serve), conia app-password, cifra
 * e salva. Non lancia: ritorna sempre un ProvisionResult con lo status, cosi'
 * il chiamante puo' decidere se degradare (pending/failed) senza bloccare.
 */
export async function provisionNextcloudUser(utente: {
  id: string
  email: string
  nome: string
  ruolo: string
  /** Password principale condivisa con il CRM. Se omessa ne viene generata una. */
  password?: string
}): Promise<ProvisionResult> {
  const cfg = nextcloudAdminConfig()
  const username = nextcloudUsernameFromEmail(utente.email)

  if (!cfg) {
    const error = "Credenziali admin Nextcloud non configurate (NEXTCLOUD_ADMIN_USER/PASSWORD)"
    await storeNextcloudCredential({ utenteId: utente.id, username, status: "pending", lastError: error })
    return { status: "pending", username, appPassword: null, error }
  }

  try {
    const initialPassword = utente.password ?? generateStrongPassword()
    const meta = await createUser(cfg, {
      userid: username,
      password: initialPassword,
      displayName: utente.nome,
    })

    // Se esiste gia' ed e' presente una app-password cifrata, il retry viene
    // usato anche come riconciliazione del gruppo senza resettare credenziali.
    if (meta.statuscode === 102) {
      const existingAppPassword = await getNextcloudAppPassword(utente.id)
      if (existingAppPassword) {
        const groupSync = await syncNextcloudUserGroup(username, utente.ruolo)
        await storeNextcloudCredential({
          utenteId: utente.id,
          username,
          status: groupSync.ok ? "active" : "failed",
          lastError: groupSync.error,
        })
        return {
          status: groupSync.ok ? "active" : "failed",
          username,
          appPassword: existingAppPassword,
          error: groupSync.error,
        }
      }
      const error = `Account Nextcloud "${username}" gia' esistente: riconciliazione manuale necessaria`
      await storeNextcloudCredential({ utenteId: utente.id, username, status: "failed", lastError: error })
      return { status: "failed", username, appPassword: null, error }
    }

    if (!isOcsOk(meta)) {
      const error = `Creazione account Nextcloud fallita (OCS ${meta.statuscode}: ${meta.message})`
      await storeNextcloudCredential({ utenteId: utente.id, username, status: "failed", lastError: error })
      return { status: "failed", username, appPassword: null, error }
    }

    // Email impostata dopo la creazione (PUT), per non far partire la mail di
    // benvenuto di Nextcloud. Non fatale: l'account e l'app-password funzionano
    // comunque, l'email e' solo metadato lato Nextcloud.
    const emailMeta = await setUserEmail(cfg, username, utente.email)
    if (!isOcsOk(emailMeta)) {
      console.warn(
        `[nextcloud] impostazione email fallita per "${username}" (OCS ${emailMeta.statuscode}: ${emailMeta.message})`,
      )
    }

    const appPassword = await mintAppPassword(cfg, username, initialPassword)
    if (!appPassword) {
      const error = "Account creato ma generazione app-password fallita"
      await storeNextcloudCredential({ utenteId: utente.id, username, status: "failed", lastError: error })
      return { status: "failed", username, appPassword: null, error }
    }

    const groupSync = await syncNextcloudUserGroup(username, utente.ruolo)
    if (!groupSync.ok) {
      const error = `Account creato ma sincronizzazione gruppo fallita: ${groupSync.error}`
      await storeNextcloudCredential({ utenteId: utente.id, username, appPassword, status: "failed", lastError: error })
      return { status: "failed", username, appPassword, error }
    }

    const stored = await storeNextcloudCredential({
      utenteId: utente.id,
      username,
      appPassword,
      status: "active",
      lastError: null,
    })
    if (stored.error) {
      return { status: "failed", username, appPassword, error: `Salvataggio credenziale fallito: ${stored.error}` }
    }

    return { status: "active", username, appPassword, error: null }
  } catch (e) {
    const error = e instanceof Error ? e.message : "Errore rete Nextcloud"
    await storeNextcloudCredential({ utenteId: utente.id, username, status: "failed", lastError: error })
    return { status: "failed", username, appPassword: null, error }
  }
}
