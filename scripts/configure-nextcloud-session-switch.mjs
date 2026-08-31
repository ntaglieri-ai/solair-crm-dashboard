// Default: read-only. --apply requires the primary password in a process-only
// NEXTCLOUD_SETUP_PASSWORD variable and a successfully deployed CRM callback.
// Never put the password in this script, command arguments or a committed file.
import { pathToFileURL } from "node:url"

export function providerPayload(provider, callback) {
  if (!provider.identifier || !provider.clientId || !provider.discoveryEndpoint
    || typeof provider.scope !== "string" || !provider.settings || typeof provider.settings !== "object") {
    throw new Error("Provider incompleto: aggiornamento annullato")
  }
  return {
    identifier: provider.identifier,
    clientId: provider.clientId,
    discoveryEndpoint: provider.discoveryEndpoint,
    scope: provider.scope,
    settings: provider.settings,
    endSessionEndpoint: callback === undefined ? provider.endSessionEndpoint : callback,
    postLogoutUri: callback === undefined ? provider.postLogoutUri : callback,
    // Omitting clientSecret is intentional: Nextcloud retains the existing one.
  }
}

async function main() {
  const apply = process.argv.includes("--apply")
  const base = process.env.NEXTCLOUD_URL?.replace(/\/+$/, "")
  const origin = new URL(process.env.NEXTCLOUD_CRM_ORIGIN || "https://crm.solairgroup.it").origin
  const callback = new URL("/api/auth/nextcloud/resume", origin).href
  const user = process.env.NEXTCLOUD_ADMIN_USER
  const password = apply ? process.env.NEXTCLOUD_SETUP_PASSWORD : process.env.NEXTCLOUD_ADMIN_PASSWORD
  if (!base || !user || !password) throw new Error("Configurare URL e credenziali; --apply richiede NEXTCLOUD_SETUP_PASSWORD temporanea")
  if (new URL(base).protocol !== "https:" || new URL(origin).protocol !== "https:") throw new Error("HTTPS richiesto")
  const login = new URL(process.env.NEXTCLOUD_OIDC_LOGIN_URL || `${base}/apps/user_oidc/login/3`)
  const id = Number(login.pathname.split("/").pop())
  if (login.origin !== new URL(base).origin || !Number.isSafeInteger(id) || id < 1) throw new Error("Provider URL non valido")
  const headers = {
    Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
    "OCS-APIRequest": "true", "Content-Type": "application/json",
  }
  const api = `${base}/ocs/v2.php/apps/user_oidc/api/v1/provider`
  async function call(url, options = {}) {
    const response = await fetch(url, { ...options, headers, redirect: "error", signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(`API Nextcloud: HTTP ${response.status}`)
    const body = await response.json()
    if (body.ocs?.meta?.status !== "ok") throw new Error("API Nextcloud: operazione rifiutata")
    return body.ocs.data
  }
  async function read() {
    const providers = await call(`${api}?format=json`)
    const provider = providers.find((item) => item.id === id)
    if (!provider) throw new Error("Provider non trovato")
    return provider
  }
  const before = await read()
  const payload = providerPayload(before, callback)
  const probe = await fetch(callback, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(15000) })
  const ready = probe.status === 204 && probe.headers.get("X-Nextcloud-Session-Switch") === "v1"
  console.log(JSON.stringify({
    mode: apply ? "apply" : "read-only", providerId: id, callbackReady: ready,
    currentEndSessionEndpoint: before.endSessionEndpoint,
    currentPostLogoutUri: before.postLogoutUri, targetCallback: callback,
  }, null, 2))
  if (!apply) return
  if (!ready) throw new Error("Pubblicare prima le nuove route CRM. Nessuna modifica eseguita.")
  if (before.endSessionEndpoint === callback && before.postLogoutUri === callback) {
    console.log("Provider gia configurato; nessuna modifica necessaria.")
    return
  }
  const write = (body) => call(`${api}/${id}?format=json`, { method: "PUT", body: JSON.stringify(body) })
  try {
    await write(payload)
    const after = await read()
    if (JSON.stringify(providerPayload(after)) !== JSON.stringify(payload)) {
      throw new Error("Verifica delle impostazioni salvate fallita")
    }
    console.log("Configurazione salvata e riletta. Eseguire ora il collaudo browser Roberta/Nando.")
  } catch {
    // Attempt to restore the full original non-secret configuration, including
    // mappings/scope. Never change the client secret during setup or rollback.
    try {
      await write(providerPayload(before))
      console.error("Attivazione fallita: configurazione precedente ripristinata.")
    } catch {
      console.error("Attivazione non confermata e ripristino non riuscito: verificare il provider nel pannello amministrativo.")
    }
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1 })
}
