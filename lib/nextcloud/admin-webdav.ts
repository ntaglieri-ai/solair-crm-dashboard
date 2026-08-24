// WebDAV lato ADMIN per gli allegati record (Lead/Cliente/Installatori).
// Diverso da lib/nextcloud/webdav.ts, che usa l'app-password PERSONALE
// dell'utente loggato (modulo Documenti esistente) — qui serve invece
// l'auth admin condivisa, stesso principio già usato in provisioning.ts,
// perché la Team Folder "Solair" è condivisa tra tutti, non nello spazio
// personale di un singolo utente.

import { nextcloudAdminConfig, basicAuth } from "./config"

export type WebDavResult = { ok: boolean; status: number; error?: string }

export type WebDavItem = {
  nome: string
  isFolder: boolean
  dimensioneKb: number | null
  /**
   * Dimensione in byte, non arrotondata. `dimensioneKb` va bene per mostrarla
   * a schermo, ma il fingerprint del sync commerciale e' costruito sui byte:
   * arrotondare al KB farebbe risultare "cambiato" un file identico visto da
   * un accesso diverso.
   */
  byte: number | null
  modificato: string | null // ISO
  path: string // path completo DAV admin (stessa forma di fullPath in input)
  // ETag Nextcloud, virgolette rimosse. Cambia ad ogni modifica del contenuto:
  // e' il modo piu' affidabile per capire se un file e' cambiato, piu' preciso
  // di dimensione+data (`dimensioneKb` e' arrotondato al KB). Usato da
  // /api/public/listino per la cache del testo estratto. Null se il server non
  // lo restituisce.
  etag: string | null
}

export type WebDavListResult = {
  ok: boolean
  status: number
  items: WebDavItem[]
  error?: string
}

function davUrl(path: string, baseUrl: string, adminUser: string): string {
  const encodedSegments = path
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/")
  return `${baseUrl}/remote.php/dav/files/${encodeURIComponent(adminUser)}/${encodedSegments}`
}

/**
 * undici riduce QUALSIASI problema di rete a un generico "fetch failed": il
 * motivo vero (ECONNRESET, ETIMEDOUT, EAI_AGAIN, certificato...) sta nella
 * catena `cause`. Senza srotolarla i log non dicono nulla di utile — cosa
 * costata un'indagine a mano sul backfill dei documenti obbligatori.
 */
function describeFetchError(e: unknown): string {
  if (!(e instanceof Error)) return "Errore di rete Nextcloud"
  const parti: string[] = [e.message]
  let cause: unknown = e.cause
  for (let depth = 0; cause instanceof Error && depth < 3; depth++) {
    const code = (cause as { code?: string }).code
    parti.push(`${cause.message}${code ? ` (${code})` : ""}`)
    // AggregateError (es. Happy Eyeballs: piu' tentativi falliti insieme).
    const sub = (cause as { errors?: unknown }).errors
    if (Array.isArray(sub)) {
      parti.push(
        sub
          .filter((s): s is Error => s instanceof Error)
          .map((s) => `${s.message}${(s as { code?: string }).code ? ` (${(s as { code?: string }).code})` : ""}`)
          .join("; "),
      )
    }
    cause = cause.cause
  }
  return parti.filter(Boolean).join(" — ")
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
    return { res: null, error: describeFetchError(e) }
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

export async function downloadAdminFile(fullPath: string): Promise<Response> {
  const { res, error } = await davRequest("GET", fullPath)
  if (error) throw new Error(error)
  if (!res) throw new Error("Credenziali admin Nextcloud non configurate")
  if (res.status === 404) throw new Error("File Nextcloud non trovato")
  if (res.status === 401 || res.status === 403) throw new Error("File Nextcloud non accessibile")
  if (!res.ok) throw new Error(`Download Nextcloud fallito (HTTP ${res.status})`)
  return res
}

const PROPFIND_BODY = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <d:getetag/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`

// Parser regex tollerante, stesso approccio gia' usato in webdav.ts (utente):
// Nextcloud restituisce PROPFIND stabile e cosi' evitiamo una dipendenza XML.
function tag(block: string, name: string): string | null {
  const m = block.match(
    new RegExp(`<[a-z0-9]*:?${name}[^>]*>([\\s\\S]*?)<\\/[a-z0-9]*:?${name}>`, "i"),
  )
  return m ? m[1].trim() : null
}

/**
 * Path relativo alla root DAV admin a partire dall'href PROPFIND
 * (es. /remote.php/dav/files/admin/Solair/x.pdf -> Solair/x.pdf).
 */
function relPathFromHref(href: string, adminUser: string): string {
  let decoded = href
  try {
    decoded = decodeURIComponent(href)
  } catch {
    /* href gia' decodificato */
  }
  // Nextcloud puo' canonicalizzare la capitalizzazione dello userid nell'href.
  const marker = `/remote.php/dav/files/${adminUser}`
  const idx = decoded.toLowerCase().indexOf(marker.toLowerCase())
  const rest = idx >= 0 ? decoded.slice(idx + marker.length) : decoded
  return rest.replace(/^\/+/, "").replace(/\/{2,}/g, "/").replace(/\/+$/, "")
}

/**
 * Elenca il contenuto immediato (Depth:1) della cartella indicata. Fonte di
 * verita' unica per la sezione "Documenti" degli allegati record: nessun dato
 * duplicato su DB, si legge sempre cosa c'e' davvero su Nextcloud.
 *
 * 404 = cartella non ancora creata (es. provisioning in background non ancora
 * completato): NON e' un errore per l'utente, si mostra semplicemente vuoto.
 */
export async function listFolder(fullPath: string): Promise<WebDavListResult> {
  const cfg = nextcloudAdminConfig()
  if (!cfg) {
    return { ok: false, status: 0, items: [], error: "Credenziali admin Nextcloud non configurate" }
  }

  const { res, error } = await davRequest("PROPFIND", fullPath, PROPFIND_BODY, {
    Depth: "1",
    "Content-Type": "application/xml; charset=utf-8",
  })
  if (error || !res) {
    return { ok: false, status: 0, items: [], error: error ?? "Errore di rete Nextcloud" }
  }
  if (res.status === 404) return { ok: true, status: 404, items: [] }
  if (res.status !== 207) {
    return { ok: false, status: res.status, items: [], error: `PROPFIND fallita (${res.status})` }
  }

  const xml = await res.text()
  const basePath = relPathFromHref(`/${fullPath}`, cfg.adminUser)
  const blocks = xml.match(/<[a-z0-9]*:?response[\s>][\s\S]*?<\/[a-z0-9]*:?response>/gi) ?? []
  const items: WebDavItem[] = []

  for (const block of blocks) {
    const href = tag(block, "href")
    if (!href) continue
    const path = relPathFromHref(href, cfg.adminUser)
    // La entry della cartella richiesta stessa (Depth:1 la include sempre).
    if (path === "" || path === basePath) continue

    const sizeRaw = tag(block, "getcontentlength")
    const lastMod = tag(block, "getlastmodified")
    const size = sizeRaw != null && sizeRaw !== "" ? Number(sizeRaw) : null
    // Nextcloud restituisce l'ETag tra virgolette, a volte HTML-escaped
    // (&quot;): si normalizza qui perche' finisce in un confronto stringa.
    const etagRaw = tag(block, "getetag")
    const etag = etagRaw ? etagRaw.replace(/&quot;/g, "").replace(/"/g, "").trim() : null

    items.push({
      nome: path.split("/").pop() ?? path,
      isFolder: /<[a-z0-9]*:?collection\s*\/?>/i.test(block),
      dimensioneKb: size != null && Number.isFinite(size) ? Math.round(size / 1024) : null,
      byte: size != null && Number.isFinite(size) ? size : null,
      modificato: lastMod ? new Date(lastMod).toISOString() : null,
      path,
      etag: etag && etag.length > 0 ? etag : null,
    })
  }

  // Cartelle prima, poi file, entrambi in ordine alfabetico.
  items.sort((a, b) =>
    a.isFolder === b.isFolder ? a.nome.localeCompare(b.nome, "it") : a.isFolder ? -1 : 1,
  )

  return { ok: true, status: res.status, items }
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

/**
 * Sposta o rinomina: in WebDAV sono la stessa operazione, MOVE con la
 * destinazione in header. La destinazione va passata come URL assoluto, non
 * come path relativo — Nextcloud rifiuta la forma relativa con un 400.
 *
 * Overwrite: F di proposito. Un MOVE che sovrascrive cancellerebbe il file di
 * destinazione senza dirlo a nessuno: meglio un 412 e un errore leggibile.
 */
export async function moveFile(fromPath: string, toPath: string): Promise<WebDavResult> {
  const cfg = nextcloudAdminConfig()
  if (!cfg) return { ok: false, status: 0, error: "Credenziali admin Nextcloud non configurate" }

  const cartella = toPath.split("/").slice(0, -1).join("/")
  if (cartella) {
    const esito = await ensureFolder(cartella)
    if (!esito.ok) return esito
  }

  const { res, error } = await davRequest("MOVE", fromPath, undefined, {
    Destination: davUrl(toPath, cfg.baseUrl, cfg.adminUser),
    Overwrite: "F",
  })
  if (error) return { ok: false, status: 0, error }
  if (res?.status === 412) {
    return { ok: false, status: 412, error: "Destinazione gia' esistente" }
  }
  if (res?.status === 404) {
    return { ok: false, status: 404, error: "Origine non trovata" }
  }
  // 201 = creato nella nuova posizione, 204 = destinazione sovrascritta.
  const ok = res?.status === 201 || res?.status === 204
  return { ok, status: res?.status ?? 0, ...(ok ? {} : { error: `MOVE fallita (${res?.status})` }) }
}

export async function deleteFile(fullPath: string): Promise<WebDavResult> {
  const { res, error } = await davRequest("DELETE", fullPath)
  if (error) return { ok: false, status: 0, error }
  // 204 = eliminato, 404 = già assente (idempotente, non è un errore per noi)
  const ok = res?.status === 204 || res?.status === 404
  return { ok, status: res?.status ?? 0 }
}
