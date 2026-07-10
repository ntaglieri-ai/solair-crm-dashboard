// Provisioning Nextcloud via OCS Provisioning API (admin basic auth).
// Flusso per nuovo utente CRM:
//   1. POST cloud/users            -> crea account con password casuale forte
//   2. GET  core/getapppassword    -> autenticato COME il nuovo utente, conia
//                                     una app-password revocabile
//   3. la app-password viene cifrata e salvata (vedi credentials.ts)
// La password iniziale casuale viene scartata: per login/WebDAV si usa sempre
// la app-password.

import { randomBytes } from "node:crypto"
import {
  basicAuth,
  nextcloudAdminConfig,
  nextcloudUsernameFromEmail,
  ocsHeaders,
  type NextcloudAdminConfig,
} from "./config"
import {
  storeNextcloudCredential,
  type NextcloudCredStatus,
} from "./credentials"

type OcsMeta = { status: string; statuscode: number; message: string }

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

/** Crea l'account Nextcloud. Ritorna lo statuscode OCS (100 = ok, 102 = esiste). */
async function createUser(
  cfg: NextcloudAdminConfig,
  params: { userid: string; password: string; email: string; displayName: string },
): Promise<OcsMeta> {
  const body = new URLSearchParams({
    userid: params.userid,
    password: params.password,
    email: params.email,
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
}): Promise<ProvisionResult> {
  const cfg = nextcloudAdminConfig()
  const username = nextcloudUsernameFromEmail(utente.email)

  if (!cfg) {
    const error = "Credenziali admin Nextcloud non configurate (NEXTCLOUD_ADMIN_USER/PASSWORD)"
    await storeNextcloudCredential({ utenteId: utente.id, username, status: "pending", lastError: error })
    return { status: "pending", username, appPassword: null, error }
  }

  try {
    const initialPassword = generateStrongPassword()
    const meta = await createUser(cfg, {
      userid: username,
      password: initialPassword,
      email: utente.email,
      displayName: utente.nome,
    })

    // 102 = utente gia' esistente: non conosciamo la sua password, non
    // possiamo coniare una app-password senza resettarla. Segnaliamo failed
    // per riconciliazione manuale invece di fingere un successo.
    if (meta.statuscode === 102) {
      const error = `Account Nextcloud "${username}" gia' esistente: riconciliazione manuale necessaria`
      await storeNextcloudCredential({ utenteId: utente.id, username, status: "failed", lastError: error })
      return { status: "failed", username, appPassword: null, error }
    }

    if (!isOcsOk(meta)) {
      const error = `Creazione account Nextcloud fallita (OCS ${meta.statuscode}: ${meta.message})`
      await storeNextcloudCredential({ utenteId: utente.id, username, status: "failed", lastError: error })
      return { status: "failed", username, appPassword: null, error }
    }

    const appPassword = await mintAppPassword(cfg, username, initialPassword)
    if (!appPassword) {
      const error = "Account creato ma generazione app-password fallita"
      await storeNextcloudCredential({ utenteId: utente.id, username, status: "failed", lastError: error })
      return { status: "failed", username, appPassword: null, error }
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
