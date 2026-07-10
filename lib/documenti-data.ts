// ============================================================================
// Documenti — tipi e helper (client-safe) per la pagina storage Nextcloud.
// I dati reali arrivano dal server (WebDAV + tabella cartelle_preferite) via
// lib/nextcloud/documenti.ts; qui restano solo tipi e utility di formattazione.
// ============================================================================

export interface CartellaPreferita {
  id: string
  label: string
  path: string // relativo alla root files utente, senza slash iniziale
}

export interface DocumentoRecente {
  name: string
  path: string
  size: number | null
  modified: string | null // ISO
}

export interface DocumentiData {
  connected: boolean
  message: string | null
  favorites: CartellaPreferita[]
  recent: DocumentoRecente[]
}

/** URL della route server che apre Nextcloud autenticato via app-password. */
export function openNextcloudUrl(path?: string): string {
  const base = "/api/auth/nextcloud/open"
  return path ? `${base}?path=${encodeURIComponent(path)}` : base
}

/** Formatta una dimensione in byte in stringa leggibile. */
export function formatSize(bytes: number | null): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`
}

/** Estensione file in minuscolo (senza punto), o "" se assente. */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ""
}

/**
 * Data relativa in italiano (es. "oggi", "ieri", "2 giorni fa", "3 settimane
 * fa") calcolata rispetto ad "adesso". Ritorna "—" se la data e' assente.
 */
export function relativeDateIt(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—"
  const date = new Date(iso)
  const msPerDay = 1000 * 60 * 60 * 24

  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(date)) / msPerDay)

  if (diffDays <= 0) return "oggi"
  if (diffDays === 1) return "ieri"
  if (diffDays < 7) return `${diffDays} giorni fa`
  if (diffDays < 14) return "1 settimana fa"
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} settimane fa`
  if (diffDays < 60) return "1 mese fa"
  return `${Math.floor(diffDays / 30)} mesi fa`
}
