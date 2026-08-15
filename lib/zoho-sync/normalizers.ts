export function normalizeZohoId(value: unknown): string {
  return String(value ?? "").replace(/^zcrm_/, "").trim()
}

export function nullableText(value: unknown): string | null {
  const normalized = String(value ?? "").trim()
  return normalized || null
}

export function booleanValue(value: unknown): boolean | null {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return null
  if (["true", "vero", "yes", "si", "sì", "1"].includes(normalized)) return true
  if (["false", "falso", "no", "0"].includes(normalized)) return false
  return null
}

export function numberValue(value: unknown): number | null {
  const normalized = String(value ?? "").trim().replace(",", ".")
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function timestampValue(value: unknown): string | null {
  const normalized = String(value ?? "").trim()
  if (!normalized) return null
  const withOffsetColon = normalized.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
  const isoLike = withOffsetColon.includes("T")
    ? withOffsetColon
    : withOffsetColon.replace(" ", "T")
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(isoLike)
  const parsed = new Date(hasTimezone ? isoLike : `${isoLike}Z`)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
}

export function comparableValue(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null || value === "") return null
  if (typeof value === "boolean" || typeof value === "number") return value
  return String(value).trim()
}

function comparableTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  if (!normalized || !normalized.includes("T")) return null
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.valueOf()
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  const aTimestamp = comparableTimestamp(a)
  const bTimestamp = comparableTimestamp(b)
  if (aTimestamp !== null && bTimestamp !== null) return aTimestamp === bTimestamp
  return comparableValue(a) === comparableValue(b)
}
