// Configurazione e accessori env per l'integrazione Nextcloud.
// Le chiamate di provisioning usano le credenziali admin (basic auth); le
// credenziali per-utente sono app-password cifrate a DB.

export type NextcloudAdminConfig = {
  baseUrl: string
  adminUser: string
  adminPassword: string
}

export function normalizeNextcloudBaseUrl(value: string | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(candidate)
    if (!url.hostname) return null
    url.hash = ""
    url.search = ""
    return url.toString().replace(/\/+$/, "")
  } catch {
    return null
  }
}

/** URL base Nextcloud, senza slash finale. Lancia se assente. */
export function nextcloudBaseUrl(): string {
  const url = normalizeNextcloudBaseUrl(process.env.NEXTCLOUD_URL)
  if (!url) throw new Error("NEXTCLOUD_URL non configurato o non valido")
  return url
}

/**
 * Credenziali admin per la Provisioning API. Ritorna null se non configurate,
 * cosi' il chiamante puo' degradare in modo esplicito (status pending/failed)
 * invece di crashare.
 */
export function nextcloudAdminConfig(): NextcloudAdminConfig | null {
  const baseUrl = normalizeNextcloudBaseUrl(process.env.NEXTCLOUD_URL)
  const adminUser = process.env.NEXTCLOUD_ADMIN_USER
  const adminPassword = process.env.NEXTCLOUD_ADMIN_PASSWORD
  if (!baseUrl || !adminUser || !adminPassword) return null
  return { baseUrl, adminUser, adminPassword }
}

/**
 * Credenziale dedicata alle API di provisioning. Nextcloud 33 rifiuta le
 * app-password sulle operazioni amministrative protette da conferma password:
 * serve quindi la password principale di un account locale autorizzato.
 *
 * Il fallback mantiene compatibili gli ambienti esistenti, ma in produzione
 * e' preferibile configurare le due variabili NEXTCLOUD_PROVISIONING_* con un
 * account tecnico dedicato, senza riusare l'account umano amministratore.
 */
export function nextcloudProvisioningConfig(): NextcloudAdminConfig | null {
  const baseUrl = normalizeNextcloudBaseUrl(process.env.NEXTCLOUD_URL)
  const adminUser = process.env.NEXTCLOUD_PROVISIONING_USER || process.env.NEXTCLOUD_ADMIN_USER
  const adminPassword =
    process.env.NEXTCLOUD_PROVISIONING_PASSWORD || process.env.NEXTCLOUD_ADMIN_PASSWORD
  if (!baseUrl || !adminUser || !adminPassword) return null
  return { baseUrl, adminUser, adminPassword }
}

/** Chiave simmetrica pgcrypto per cifrare/decifrare le app-password. */
export function nextcloudCredKey(): string {
  const key = process.env.NEXTCLOUD_CRED_ENC_KEY
  if (!key) throw new Error("NEXTCLOUD_CRED_ENC_KEY non configurato")
  return key
}

/** Header base per le chiamate OCS. */
export function ocsHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "OCS-APIRequest": "true",
    Accept: "application/json",
    ...extra,
  }
}

export function basicAuth(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`
}

/**
 * Deriva lo userid Nextcloud dall'email CRM. Nextcloud accetta email come
 * userid; normalizziamo in minuscolo e trimmiamo. Deterministico cosi' il
 * retry punta sempre allo stesso account.
 */
export function nextcloudUsernameFromEmail(email: string): string {
  return email.trim().toLowerCase()
}
