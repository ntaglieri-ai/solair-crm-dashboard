// WebDAV lato ADMIN per gli allegati record (Lead/Cliente/Installatori).
// Diverso da lib/nextcloud/webdav.ts, che usa l'app-password PERSONALE
// dell'utente loggato (modulo Documenti esistente) — qui serve invece
// l'auth admin condivisa, stesso principio già usato in provisioning.ts,
// perché la Team Folder "Solair" è condivisa tra tutti, non nello spazio
// personale di un singolo utente.

import { nextcloudAdminConfig, basicAuth } from "./config"

export type WebDavResult = { ok: boolean; status: number; error?: string }

function davUrl(path: string, baseUrl: string, adminUser: string): string {
  const encodedSegments = path
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/")
  return `${baseUrl}/remote.php/dav/files/${encodeURIComponent(adminUser)}/${encodedSegments}`
}

async function davRequest(
  method: string,
  path: string,
  body?: BodyInit,
  extraHeaders: Record<string, string> = {},
): Promise<{ res: Response | null; error: string | null }> {
  const cfg = nextcloudAdminConfig()
  if (!cfg) return { res: null, error: "Credenziali admin Nextcloud non configurate" }
  try {
    const res = await fetch(davUrl(path, cfg.baseUrl, cfg.adminUser), {
      method,
      headers: {
        Authorization: basicAuth(cfg.adminUser, cfg.adminPassword),
        ...extraHeaders,
      },
      body,
    })
    return { res, error: null }
  } catch (e) {
    return { res: null, error: e instanceof Error ? e.message : "Errore di rete Nextcloud" }
  }
}

/**
 * Crea la cartella indicata (e le intermedie mancanti) sotto la root DAV
 * admin. Idempotente: se una cartella esiste già (405), non è un errore.
 * Chiamata alla CREAZIONE del record (Lead/Cliente/Installatore), sempre
 * in background via after() — mai in modo bloccante, cosi' se Nextcloud e'
 * giu' la creazione del record non fallisce per questo (decisione 25/07:
 * prima si era pensato "lazy al primo upload", poi rivista in "subito alla
 * creazione" per permettere accesso diretto da PC/telefono senza passare
 * dal CRM).
 */
export async function ensureFolder(fullPath: string): Promise<WebDavResult> {
  const segments = fullPath.split("/").filter(Boolean)
  let current = ""
  for (const seg of segments) {
    current = current ? `${current}/${seg}` : seg
    const { res, error } = await davRequest("MKCOL", current)
    if (error) return { ok: false, status: 0, error }
    if (res && res.status !== 201 && res.status !== 405) {
      return { ok: false, status: res.status, error: `MKCOL fallita (${res.status})` }
    }
  }
  return { ok: true, status: 201 }
}

export async function uploadFile(
  fullPath: string,
  fileBuffer: Buffer,
  contentType?: string,
): Promise<WebDavResult> {
  const folder = fullPath.split("/").slice(0, -1).join("/")
  if (folder) {
    const folderResult = await ensureFolder(folder)
    if (!folderResult.ok) return folderResult
  }
  const { res, error } = await davRequest(
    "PUT",
    fullPath,
    fileBuffer as unknown as BodyInit,
    contentType ? { "Content-Type": contentType } : {},
  )
  if (error) return { ok: false, status: 0, error }
  return { ok: Boolean(res?.ok), status: res?.status ?? 0 }
}

export async function downloadFile(fullPath: string): Promise<{
  ok: boolean
  status: number
  body: ReadableStream<Uint8Array> | null
  contentType: string | null
  contentLength: string | null
  error?: string
}> {
  const { res, error } = await davRequest("GET", fullPath)
  if (error || !res) {
    return { ok: false, status: 0, body: null, contentType: null, contentLength: null, error: error ?? undefined }
  }
  return {
    ok: res.ok,
    status: res.status,
    body: res.body,
    contentType: res.headers.get("content-type"),
    contentLength: res.headers.get("content-length"),
  }
}

export async function deleteFile(fullPath: string): Promise<WebDavResult> {
  const { res, error } = await davRequest("DELETE", fullPath)
  if (error) return { ok: false, status: 0, error }
  // 204 = eliminato, 404 = già assente (idempotente, non è un errore per noi)
  const ok = res?.status === 204 || res?.status === 404
  return { ok, status: res?.status ?? 0 }
}
