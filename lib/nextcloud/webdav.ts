// Accesso WebDAV a Nextcloud con la app-password dell'utente (basic auth).
// Parser XML tollerante via regex: evitiamo dipendenze extra e Nextcloud
// restituisce PROPFIND stabile (namespace d:/oc:).

import { basicAuth, nextcloudBaseUrl } from "./config"
import { normalizeNcPath } from "./path-permissions"

export type NcEntry = {
  path: string // relativo alla root files utente, senza slash iniziale
  name: string
  isDir: boolean
  size: number | null
  contentType: string | null
  lastModified: string | null // ISO
  favorite: boolean // oc:favorite=1 (stella nativa Nextcloud)
  fileId: string | null // oc:fileid, per i deep link diretti al file (/f/{id})
}

function davRoot(username: string): string {
  return `${nextcloudBaseUrl()}/remote.php/dav/files/${encodeURIComponent(username)}`
}

const PROPFIND_BODY = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:prop>
    <d:displayname/>
    <d:getlastmodified/>
    <d:getcontentlength/>
    <d:getcontenttype/>
    <d:resourcetype/>
    <oc:favorite/>
    <oc:fileid/>
  </d:prop>
</d:propfind>`

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<[a-z0-9]*:?${name}[^>]*>([\\s\\S]*?)<\\/[a-z0-9]*:?${name}>`, "i"))
  return m ? m[1].trim() : null
}

/**
 * Estrae il path relativo alla root files a partire dall'href PROPFIND
 * (es. /remote.php/dav/files/<user>/Cartella/file.pdf -> Cartella/file.pdf).
 */
function relPathFromHref(href: string, username: string): string {
  let decoded = href
  try {
    decoded = decodeURIComponent(href)
  } catch {
    /* href gia' decodificato */
  }
  // Nextcloud puo' canonicalizzare la capitalizzazione dello userid nell'href
  // (es. richiesta come "admin", restituito come "Admin"): match case-insensitive.
  const marker = `/remote.php/dav/files/${username}`
  const idx = decoded.toLowerCase().indexOf(marker.toLowerCase())
  const rest = idx >= 0 ? decoded.slice(idx + marker.length) : decoded
  return normalizeNcPath(rest.replace(/\/+$/, ""))
}

function parsePropfind(xml: string, username: string): NcEntry[] {
  const responses = xml.match(/<[a-z0-9]*:?response[\s>][\s\S]*?<\/[a-z0-9]*:?response>/gi) ?? []
  const entries: NcEntry[] = []

  for (const block of responses) {
    const href = tag(block, "href")
    if (!href) continue
    const path = relPathFromHref(href, username)
    if (path === "") continue // la root stessa (Depth:1 la include)

    const isDir = /<[a-z0-9]*:?collection\s*\/?>/i.test(block)
    const sizeRaw = tag(block, "getcontentlength")
    const lastMod = tag(block, "getlastmodified")

    entries.push({
      path,
      name: path.split("/").pop() ?? path,
      isDir,
      size: sizeRaw != null && sizeRaw !== "" ? Number(sizeRaw) : null,
      contentType: tag(block, "getcontenttype"),
      lastModified: lastMod ? new Date(lastMod).toISOString() : null,
      favorite: tag(block, "favorite") === "1",
      fileId: tag(block, "fileid"),
    })
  }

  return entries
}

/**
 * Elenca il contenuto immediato (Depth:1) di una cartella. `path` relativo
 * alla root files utente ("" = root). Lancia su errore auth/rete.
 */
export async function listFolder(
  username: string,
  appPassword: string,
  path = "",
): Promise<NcEntry[]> {
  const res = await fetch(davUrl(username, path), {
    method: "PROPFIND",
    headers: {
      Authorization: basicAuth(username, appPassword),
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8",
    },
    body: PROPFIND_BODY,
  })

  if (res.status === 404) return []
  if (res.status === 401 || res.status === 403) {
    throw new Error("Autenticazione Nextcloud non valida (app-password scaduta?)")
  }
  if (res.status !== 207) {
    throw new Error(`PROPFIND fallito (HTTP ${res.status})`)
  }

  return parsePropfind(await res.text(), username)
}

function davUrl(username: string, path: string): string {
  const clean = normalizeNcPath(path)
  return clean
    ? `${davRoot(username)}/${clean.split("/").map(encodeURIComponent).join("/")}`
    : davRoot(username)
}

/**
 * Marca (o smarca) una cartella/file come preferito nativo Nextcloud
 * (oc:favorite), la stessa stella dell'interfaccia web. Via PROPPATCH.
 */
export async function setFavorite(
  username: string,
  appPassword: string,
  path: string,
  favorite: boolean,
): Promise<void> {
  const body = `<?xml version="1.0"?>
<d:propertyupdate xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:set><d:prop><oc:favorite>${favorite ? 1 : 0}</oc:favorite></d:prop></d:set>
</d:propertyupdate>`

  const res = await fetch(davUrl(username, path), {
    method: "PROPPATCH",
    headers: {
      Authorization: basicAuth(username, appPassword),
      "Content-Type": "application/xml; charset=utf-8",
    },
    body,
  })

  if (res.status === 401 || res.status === 403) {
    throw new Error("Autenticazione Nextcloud non valida (app-password scaduta?)")
  }
  // PROPPATCH riuscito risponde 207 Multi-Status; alcuni backend rispondono 200.
  if (res.status !== 207 && res.status !== 200) {
    throw new Error(`PROPPATCH oc:favorite fallito (HTTP ${res.status})`)
  }
}

/**
 * Elenca tutti gli elementi marcati come preferiti nativi Nextcloud
 * (oc:favorite=1) sotto la root files utente, via REPORT oc:filter-files.
 * Include sia file che cartelle: il chiamante filtra per isDir se serve.
 */
export async function listFavorites(
  username: string,
  appPassword: string,
): Promise<NcEntry[]> {
  const body = `<?xml version="1.0"?>
<oc:filter-files xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:prop>
    <d:displayname/>
    <d:getlastmodified/>
    <d:getcontentlength/>
    <d:getcontenttype/>
    <d:resourcetype/>
    <oc:favorite/>
  </d:prop>
  <oc:filter-rules><oc:favorite>1</oc:favorite></oc:filter-rules>
</oc:filter-files>`

  const res = await fetch(davRoot(username), {
    method: "REPORT",
    headers: {
      Authorization: basicAuth(username, appPassword),
      "Content-Type": "application/xml; charset=utf-8",
    },
    body,
  })

  if (res.status === 404) return []
  if (res.status === 401 || res.status === 403) {
    throw new Error("Autenticazione Nextcloud non valida (app-password scaduta?)")
  }
  if (res.status !== 207) {
    throw new Error(`REPORT favoriti fallito (HTTP ${res.status})`)
  }

  return parsePropfind(await res.text(), username)
}

/**
 * File modificati di recente. Nextcloud non espone un "recent" senza l'app
 * Activity; usiamo un SEARCH DAV (REPORT) ordinato per data e limitato, con
 * fallback al listing della root ordinato per lastModified.
 */
export async function recentFiles(
  username: string,
  appPassword: string,
  limit = 10,
): Promise<NcEntry[]> {
  const searchBody = `<?xml version="1.0" encoding="UTF-8"?>
<d:searchrequest xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:basicsearch>
    <d:select><d:prop>
      <d:displayname/><d:getlastmodified/><d:getcontentlength/><d:getcontenttype/><d:resourcetype/><oc:fileid/>
    </d:prop></d:select>
    <d:from><d:scope>
      <d:href>/files/${username}</d:href><d:depth>infinity</d:depth>
    </d:scope></d:from>
    <d:where><d:not><d:is-collection/></d:not></d:where>
    <d:orderby><d:order>
      <d:prop><d:getlastmodified/></d:prop><d:descending/>
    </d:order></d:orderby>
    <d:limit><d:nresults>${limit}</d:nresults></d:limit>
  </d:basicsearch>
</d:searchrequest>`

  try {
    const res = await fetch(`${nextcloudBaseUrl()}/remote.php/dav/`, {
      method: "SEARCH",
      headers: {
        Authorization: basicAuth(username, appPassword),
        "Content-Type": "application/xml; charset=utf-8",
      },
      body: searchBody,
    })
    if (res.status === 207) {
      const entries = parsePropfind(await res.text(), username)
        .filter((e) => !e.isDir)
        .sort((a, b) => (b.lastModified ?? "").localeCompare(a.lastModified ?? ""))
      if (entries.length > 0) return entries.slice(0, limit)
    }
  } catch (e) {
    console.warn("[nextcloud] SEARCH recent fallito, fallback a listing root:", e)
  }

  // Fallback: listing della root ordinato per data modifica.
  const root = await listFolder(username, appPassword, "")
  return root
    .filter((e) => !e.isDir)
    .sort((a, b) => (b.lastModified ?? "").localeCompare(a.lastModified ?? ""))
    .slice(0, limit)
}
