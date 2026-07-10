// Configurazione e accessori env per l'integrazione Nextcloud.
// Le chiamate di provisioning usano le credenziali admin (basic auth); le
// credenziali per-utente sono app-password cifrate a DB.

export type NextcloudAdminConfig = {
  baseUrl: string
  adminUser: string
  adminPassword: string
}

/** URL base Nextcloud, senza slash finale. Lancia se assente. */
export function nextcloudBaseUrl(): string {
  const url = process.env.NEXTCLOUD_URL
  if (!url) throw new Error("NEXTCLOUD_URL non configurato")
  return url.replace(/\/+$/, "")
}

/**
 * Credenziali admin per la Provisioning API. Ritorna null se non configurate,
 * cosi' il chiamante puo' degradare in modo esplicito (status pending/failed)
 * invece di crashare.
 */
export function nextcloudAdminConfig(): NextcloudAdminConfig | null {
  const baseUrl = process.env.NEXTCLOUD_URL?.replace(/\/+$/, "")
  const adminUser = process.env.NEXTCLOUD_ADMIN_USER
  const adminPassword = process.env.NEXTCLOUD_ADMIN_PASSWORD
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
