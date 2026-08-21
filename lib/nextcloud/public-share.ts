import { basicAuth, nextcloudBaseUrl } from "./config"
import { normalizeNcPath } from "./path-permissions"

type OcsMeta = {
  status: string
  statuscode: number
  message: string
}

type OcsShare = {
  id?: string | number
  path?: string
  share_type?: number | string
  permissions?: number | string
  url?: string
}

const SHARE_TYPE_PUBLIC_LINK = 3
const READ_PERMISSION = 1

function isOcsOk(meta: OcsMeta) {
  return meta.status === "ok" || meta.statuscode === 100 || meta.statuscode === 200
}

async function parseOcs(response: Response): Promise<{ meta: OcsMeta; data: unknown }> {
  const text = await response.text()
  try {
    const json = JSON.parse(text) as { ocs?: { meta?: OcsMeta; data?: unknown } }
    return {
      meta: json.ocs?.meta ?? {
        status: response.ok ? "ok" : "failure",
        statuscode: response.status,
        message: text.slice(0, 200),
      },
      data: json.ocs?.data ?? null,
    }
  } catch {
    return {
      meta: {
        status: response.ok ? "ok" : "failure",
        statuscode: response.status,
        message: text.slice(0, 200) || response.statusText,
      },
      data: null,
    }
  }
}

async function shareRequest(
  username: string,
  appPassword: string,
  query: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers)
  headers.set("Authorization", basicAuth(username, appPassword))
  headers.set("OCS-APIRequest", "true")
  headers.set("Accept", "application/json")
  const base = `${nextcloudBaseUrl()}/ocs/v2.php/apps/files_sharing/api/v1/shares`
  const separator = query.includes("?") ? "&" : "?"
  return parseOcs(await fetch(`${base}${query}${separator}format=json`, { ...init, headers }))
}

function publicShareUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const value = (data as OcsShare).url
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export async function ensurePublicFileShare(
  username: string,
  appPassword: string,
  path: string,
): Promise<string> {
  const cleanPath = normalizeNcPath(path)
  if (!cleanPath) throw new Error("Path Nextcloud non valido")

  const existing = await shareRequest(username, appPassword, `?path=${encodeURIComponent(cleanPath)}`)
  if (isOcsOk(existing.meta)) {
    const shares = Array.isArray(existing.data) ? (existing.data as OcsShare[]) : []
    const found = shares.find(
      (share) =>
        Number(share.share_type) === SHARE_TYPE_PUBLIC_LINK &&
        typeof share.url === "string" &&
        share.url.trim(),
    )
    if (found?.url) return found.url.trim()
  } else if (existing.meta.statuscode === 404) {
    throw new Error(`File Nextcloud non trovato: ${cleanPath}`)
  }

  const created = await shareRequest(username, appPassword, "", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      path: cleanPath,
      shareType: String(SHARE_TYPE_PUBLIC_LINK),
      permissions: String(READ_PERMISSION),
    }),
  })

  if (isOcsOk(created.meta)) {
    const url = publicShareUrl(created.data)
    if (url) return url
  }

  if (/already shared|gia.{0,3} condivis/i.test(created.meta.message)) {
    const retry = await shareRequest(username, appPassword, `?path=${encodeURIComponent(cleanPath)}`)
    if (isOcsOk(retry.meta)) {
      const shares = Array.isArray(retry.data) ? (retry.data as OcsShare[]) : []
      const found = shares.find((share) => Number(share.share_type) === SHARE_TYPE_PUBLIC_LINK)
      if (found?.url) return found.url.trim()
    }
  }

  throw new Error(`Condivisione pubblica Nextcloud fallita (OCS ${created.meta.statuscode}: ${created.meta.message})`)
}
