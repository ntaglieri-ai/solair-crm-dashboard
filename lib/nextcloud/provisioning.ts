// Provisioning Nextcloud via OCS Provisioning API (admin basic auth).
// Flusso per nuovo utente CRM:
//   1. POST cloud/users            -> crea account con password tecnica casuale;
//                                     l'accesso umano passa da Supabase OIDC
//   2. GET  core/getapppassword    -> autenticato COME il nuovo utente, conia
//                                     una app-password revocabile
//   3. la app-password viene cifrata e salvata (vedi credentials.ts)
// La password tecnica non viene salvata dal CRM. WebDAV e i client usano
// app-password/token separati; browser e nuovi dispositivi usano OIDC.

import { randomBytes } from "node:crypto"
import {
  basicAuth,
  nextcloudAdminConfig,
  nextcloudProvisioningConfig,
  nextcloudUsernameFromEmail,
  ocsHeaders,
  type NextcloudAdminConfig,
} from "./config"
import {
  getNextcloudAppPassword,
  storeNextcloudCredential,
  type NextcloudCredStatus,
} from "./credentials"
// Ciclo di import con path-permissions.ts (che importa nextcloudGroupForRole):
// benigno, entrambi i lati si usano solo dentro funzioni, mai in valutazione
// di modulo.
import { computeRequiredGroupShares, normalizeNcPath, type NcGroupShare } from "./path-permissions"

type OcsMeta = { status: string; statuscode: number; message: string }

// La Provisioning API restituisce 100 (OCS v1) o 200 (OCS v2) in caso di
// successo; 102 = risorsa gia' esistente.
function isOcsOk(meta: OcsMeta): boolean {
  return meta.statuscode === 100 || meta.statuscode === 200
}

function provisioningFailure(action: string, meta: OcsMeta): string {
  if (/password confirmation is required/i.test(meta.message)) {
    return `${action}: Nextcloud richiede la password principale. Configurare NEXTCLOUD_PROVISIONING_USER e NEXTCLOUD_PROVISIONING_PASSWORD; le app-password non sono ammesse per le API amministrative.`
  }
  return `${action} (OCS ${meta.statuscode}: ${meta.message})`
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

// Sincronizzazione ruolo CRM -> gruppo Nextcloud. Prefisso solair- per evitare
// collisione col gruppo amministrativo nativo di Nextcloud (admin). I gruppi
// legacy senza prefisso (agent/director/standard) erano usati nel test
// manuale del 23/07 prima del refactor: vengono rimossi come i gruppi
// gestiti attuali se un utente li ha ancora.
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
 * Come ocsRequest ma sulla Share API, che vive su un path base diverso
 * (/apps/files_sharing/... invece di /cloud/...).
 */
async function ocsShareRequest(
  cfg: NextcloudAdminConfig,
  query: string,
  init: RequestInit = {},
): Promise<{ meta: OcsMeta; data: unknown }> {
  const headers = new Headers(init.headers)
  headers.set("Authorization", basicAuth(cfg.adminUser, cfg.adminPassword))
  headers.set("OCS-APIRequest", "true")
  headers.set("Accept", "application/json")
  const base = `${cfg.baseUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares`
  return parseOcs(await fetch(`${base}${query}${query.includes("?") ? "&" : "?"}format=json`, { ...init, headers }))
}

type OcsShare = { id?: string | number; share_with?: string; share_type?: number | string; permissions?: number | string }

const SHARE_TYPE_GROUP = 1

// L'istanza limita la creazione di condivisioni a ~20 ogni 10 minuti per
// utente: oltre quella soglia la POST risponde 429 con corpo vuoto e senza
// Retry-After. La finestra e' troppo lunga per aspettarla dentro la richiesta,
// quindi si fa un solo ritentativo breve (copre un burst transitorio) e poi il
// chiamante interrompe il giro: la funzione e' idempotente, il salvataggio
// successivo riprende da dove si era fermato.
const RATE_LIMIT_RETRY_MS = 1000

function isRateLimited(meta: OcsMeta): boolean {
  return meta.statuscode === 429
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Rende reale su Nextcloud l'accesso dichiarato in permessi_cartelle_nextcloud:
 * condivide `path` con il gruppo `group`. Idempotente — se la condivisione
 * esiste gia' con gli stessi permessi non fa nulla, se esiste con permessi
 * diversi li allinea (altrimenti un readonly promosso a editable in tabella non
 * si rifletterebbe mai sul filesystem). Non lancia mai: il chiamante logga e
 * prosegue.
 */
export async function shareGroupFolderIfNeeded(
  cfg: NextcloudAdminConfig,
  group: string,
  path: string,
  permissions = 31,
): Promise<{ ok: boolean; error: string | null; rateLimited?: boolean }> {
  try {
    const existing = await ocsShareRequest(cfg, `?path=${encodeURIComponent(path)}`)
    // 404 = la cartella non esiste su Nextcloud: inutile tentare la POST, che
    // fallirebbe comunque consumando una richiesta del rate limit.
    if (existing.meta.statuscode === 404) {
      return { ok: false, error: `Percorso inesistente su Nextcloud: "${path}"` }
    }
    if (isOcsOk(existing.meta)) {
      const shares = (Array.isArray(existing.data) ? existing.data : []) as OcsShare[]
      const found = shares.find(
        (s) => s?.share_with === group && Number(s?.share_type) === SHARE_TYPE_GROUP,
      )
      if (found) {
        if (Number(found.permissions) === permissions || found.id == null) return { ok: true, error: null }
        const updated = await ocsShareRequest(cfg, `/${encodeURIComponent(String(found.id))}`, {
          method: "PUT",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ permissions: String(permissions) }),
        })
        return isOcsOk(updated.meta)
          ? { ok: true, error: null }
          : { ok: false, error: `Aggiornamento permessi fallito (OCS ${updated.meta.statuscode}: ${updated.meta.message})` }
      }
    }

    let created = await ocsShareRequest(cfg, "", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        path,
        shareType: String(SHARE_TYPE_GROUP),
        shareWith: group,
        permissions: String(permissions),
      }),
    })
    if (isRateLimited(created.meta)) {
      await sleep(RATE_LIMIT_RETRY_MS)
      created = await ocsShareRequest(cfg, "", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          path,
          shareType: String(SHARE_TYPE_GROUP),
          shareWith: group,
          permissions: String(permissions),
        }),
      })
    }
    if (isOcsOk(created.meta)) return { ok: true, error: null }
    if (isRateLimited(created.meta)) {
      return {
        ok: false,
        rateLimited: true,
        error: "Rate limit Nextcloud (429): riprovare il salvataggio fra ~10 minuti",
      }
    }
    // Alcune versioni rispondono 403/404 con questo messaggio quando la
    // condivisione esiste gia': e' comunque lo stato desiderato.
    if (/already shared|gia.{0,3} condivis/i.test(created.meta.message)) return { ok: true, error: null }
    return { ok: false, error: `OCS ${created.meta.statuscode}: ${created.meta.message}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Errore rete Nextcloud" }
  }
}

/**
 * Elimina le condivisioni di gruppo non piu' previste dalla tabella: senza
 * questo passaggio portare un accesso a "hidden" non toglierebbe l'accesso
 * fisico, perche' la condivisione creata in precedenza sopravvive.
 *
 * Tocca SOLO i gruppi gestiti dal CRM (solair-*): condivisioni verso utenti
 * singoli, link pubblici o altri gruppi non vengono mai rimosse. Di contro, una
 * condivisione creata a mano verso un gruppo solair-* e non rappresentata in
 * tabella viene revocata: e' il prezzo del "la tabella e' l'unica fonte".
 */
export async function revokeStaleGroupShares(
  cfg: NextcloudAdminConfig,
  attese: NcGroupShare[],
): Promise<{ rimosse: number; errori: string[] }> {
  const errori: string[] = []
  let rimosse = 0
  try {
    const elenco = await ocsShareRequest(cfg, "")
    if (!isOcsOk(elenco.meta)) {
      return {
        rimosse: 0,
        errori: [`Lettura condivisioni fallita (OCS ${elenco.meta.statuscode}: ${elenco.meta.message})`],
      }
    }
    const previste = new Set(attese.map((s) => `${s.folder} ${s.group}`))
    const shares = (Array.isArray(elenco.data) ? elenco.data : []) as (OcsShare & { path?: string })[]

    for (const share of shares) {
      const group = share.share_with
      if (Number(share.share_type) !== SHARE_TYPE_GROUP) continue
      if (!group || !CRM_NEXTCLOUD_GROUPS.has(group)) continue
      const folder = normalizeNcPath(share.path ?? "").replace(/\/+$/, "")
      if (!folder || previste.has(`${folder} ${group}`)) continue

      const rimossa = await ocsShareRequest(cfg, `/${encodeURIComponent(String(share.id))}`, { method: "DELETE" })
      if (isOcsOk(rimossa.meta)) rimosse++
      else errori.push(`"${folder}" -> ${group}: OCS ${rimossa.meta.statuscode} ${rimossa.meta.message}`)
    }
  } catch (e) {
    errori.push(e instanceof Error ? e.message : "Errore rete Nextcloud")
  }
  return { rimosse, errori }
}

/**
 * Rende il gruppo Nextcloud una proiezione del ruolo CRM. Aggiunge sempre il
 * gruppo nuovo prima di rimuovere quelli vecchi (se il passo di rimozione
 * fallisse a meta' strada, l'utente non resta mai senza alcun gruppo), e non
 * tocca mai gruppi non gestiti (in particolare il gruppo admin nativo).
 *
 * IMPORTANTE: questa funzione fa diverse chiamate di rete sequenziali verso
 * Nextcloud (crea gruppo, assegna, leggi gruppi attuali, rimuovi i vecchi).
 * Un primo tentativo (23/07) la chiamava in modo sincrono dentro la richiesta
 * HTTP del cambio ruolo, bloccandola per la somma di tutte queste chiamate —
 * stesso problema di lentezza gia' risolto per creazione/cancellazione
 * account. E' stato revertito per questo. Va SEMPRE invocata dentro after(),
 * mai atteso direttamente nella response del route handler.
 */
export async function syncNextcloudUserGroup(
  userid: string,
  roleCode: string,
): Promise<{ ok: boolean; group: string | null; error: string | null }> {
  const cfg = nextcloudProvisioningConfig()
  const desired = nextcloudGroupForRole(roleCode)
  if (!cfg) return { ok: false, group: desired, error: "Credenziali admin Nextcloud non configurate" }
  if (!desired) return { ok: false, group: null, error: `Ruolo CRM non supportato: ${roleCode}` }

  try {
    let current = await ocsRequest(cfg, `users/${encodeURIComponent(userid)}`)
    if (!isOcsOk(current.meta)) {
      return {
        ok: false,
        group: desired,
        error: `Lettura gruppi utente fallita (OCS ${current.meta.statuscode}: ${current.meta.message})`,
      }
    }
    const groups = ((current.data as { groups?: unknown } | null)?.groups ?? []) as unknown
    let currentGroups = Array.isArray(groups) ? groups.filter((g): g is string => typeof g === "string") : []

    if (!currentGroups.includes(desired)) {
      const created = await ocsRequest(cfg, "groups", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ groupid: desired }),
      })
      // 102 = il gruppo esiste gia'.
      if (!isOcsOk(created.meta) && created.meta.statuscode !== 102) {
        return {
          ok: false,
          group: desired,
          error: provisioningFailure(`Creazione gruppo ${desired} fallita`, created.meta),
        }
      }

      const added = await ocsRequest(cfg, `users/${encodeURIComponent(userid)}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ groupid: desired }),
      })
      if (!isOcsOk(added.meta) && added.meta.statuscode !== 102) {
        return {
          ok: false,
          group: desired,
          error: provisioningFailure(`Assegnazione a ${desired} fallita`, added.meta),
        }
      }

      current = await ocsRequest(cfg, `users/${encodeURIComponent(userid)}`)
      const refreshed = ((current.data as { groups?: unknown } | null)?.groups ?? []) as unknown
      currentGroups = Array.isArray(refreshed)
        ? refreshed.filter((g): g is string => typeof g === "string")
        : []
      if (!isOcsOk(current.meta) || !currentGroups.includes(desired)) {
        return { ok: false, group: desired, error: `Verifica gruppo ${desired} fallita` }
      }
    }

    for (const group of currentGroups) {
      if (group === desired || (!CRM_NEXTCLOUD_GROUPS.has(group) && !LEGACY_CRM_GROUPS.has(group))) continue
      const removed = await ocsRequest(
        cfg,
        `users/${encodeURIComponent(userid)}/groups?groupid=${encodeURIComponent(group)}`,
        { method: "DELETE" },
      )
      if (!isOcsOk(removed.meta)) {
        return {
          ok: false,
          group: desired,
          error: `Rimozione dal vecchio gruppo ${group} fallita (OCS ${removed.meta.statuscode}: ${removed.meta.message})`,
        }
      }
    }

    // L'appartenenza al gruppo da sola non da' accesso fisico ai file: le
    // cartelle vanno condivise col gruppo. Prima si revocano le condivisioni
    // CRM non piu' previste, cosi' un nuovo AGENT non eredita vecchie share
    // troppo larghe rimaste su solair-agent (es. la radice Solair).
    //
    // Best-effort: non fa fallire la sincronizzazione del ruolo, perche'
    // account e credenziale devono restare recuperabili dal pannello utenti.
    try {
      const shares = await computeRequiredGroupShares()
      const revoca = await revokeStaleGroupShares(cfg, shares)
      if (revoca.rimosse > 0) {
        console.info(`[nextcloud] condivisioni non piu' previste revocate: ${revoca.rimosse}`)
      }
      for (const errore of revoca.errori) {
        console.warn(`[nextcloud] revoca condivisione fallita: ${errore}`)
      }

      for (const share of shares) {
        if (share.group !== desired) continue
        const result = await shareGroupFolderIfNeeded(cfg, share.group, share.folder, share.permissions)
        if (!result.ok) {
          console.warn(`[nextcloud] condivisione "${share.folder}" -> ${share.group} fallita: ${result.error}`)
        }
        // Raggiunto il limite: le condivisioni restanti fallirebbero tutte.
        if (result.rateLimited) break
      }
    } catch (e) {
      console.warn("[nextcloud] calcolo condivisioni di gruppo fallito:", e instanceof Error ? e.message : e)
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
  params: { userid: string; password: string; displayName: string; group: string },
): Promise<OcsMeta> {
  const body = new URLSearchParams({
    userid: params.userid,
    password: params.password,
    displayName: params.displayName,
  })
  body.append("groups[]", params.group)
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
  const cfg = nextcloudProvisioningConfig()
  const username = nextcloudUsernameFromEmail(utente.email)
  const group = nextcloudGroupForRole(utente.ruolo)

  if (!cfg) {
    const error = "Credenziali provisioning Nextcloud non configurate"
    await storeNextcloudCredential({ utenteId: utente.id, username, status: "pending", lastError: error })
    return { status: "pending", username, appPassword: null, error }
  }
  if (!group) {
    const error = `Ruolo CRM non supportato dal provisioning Nextcloud: ${utente.ruolo}`
    await storeNextcloudCredential({ utenteId: utente.id, username, status: "failed", lastError: error })
    return { status: "failed", username, appPassword: null, error }
  }

  try {
    const initialPassword = utente.password ?? generateStrongPassword()
    const meta = await createUser(cfg, {
      userid: username,
      password: initialPassword,
      displayName: utente.nome,
      group,
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
      const error = provisioningFailure("Creazione account Nextcloud fallita", meta)
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

    const groupSync = await syncNextcloudUserGroup(username, utente.ruolo)
    if (!groupSync.ok) {
      const error = groupSync.error ?? `Assegnazione gruppo ${group} fallita`
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

/**
 * Riconcilia un utente CRM in modo idempotente:
 * - se l'account Nextcloud non esiste, lo crea gia' nel gruppo del ruolo;
 * - se esiste, allinea e verifica il gruppo;
 * - dichiara active solo se esistono anche le credenziali WebDAV cifrate.
 */
export async function reconcileNextcloudUser(utente: {
  id: string
  email: string
  nome: string
  ruolo: string
}): Promise<ProvisionResult> {
  const username = nextcloudUsernameFromEmail(utente.email)
  const exists = await nextcloudUserExists(username)
  if (exists === false) return provisionNextcloudUser(utente)
  if (exists === null) {
    const error = "Verifica account Nextcloud non riuscita"
    await storeNextcloudCredential({ utenteId: utente.id, username, status: "failed", lastError: error })
    return { status: "failed", username, appPassword: null, error }
  }

  const groupSync = await syncNextcloudUserGroup(username, utente.ruolo)
  if (!groupSync.ok) {
    const error = groupSync.error ?? "Sincronizzazione gruppo Nextcloud fallita"
    await storeNextcloudCredential({ utenteId: utente.id, username, status: "failed", lastError: error })
    return { status: "failed", username, appPassword: null, error }
  }

  const appPassword = await getNextcloudAppPassword(utente.id)
  if (!appPassword) {
    const error = `Account Nextcloud esistente e gruppo ${groupSync.group} corretto, ma credenziale WebDAV assente: riconciliazione credenziale necessaria`
    await storeNextcloudCredential({ utenteId: utente.id, username, status: "failed", lastError: error })
    return { status: "failed", username, appPassword: null, error }
  }

  await storeNextcloudCredential({
    utenteId: utente.id,
    username,
    status: "active",
    lastError: null,
  })
  return { status: "active", username, appPassword: null, error: null }
}
