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

  // Zoho CSV timestamps and CRM timestamps are treated as Italian local wall-clock values.
  // Do not apply timezone offsets here: keep the displayed hour stable.
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

function wallClockKey(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  )
  if (!match) return null
  return [
    match[1],
    match[2],
    match[3],
    match[4] ?? "00",
    match[5] ?? "00",
    match[6] ?? "00",
  ].join("-")
}

function romeWallClockKey(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized)) return null
  const parsed = new Date(normalized.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"))
  if (Number.isNaN(parsed.valueOf())) return null
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(parsed)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00"
  return [
    part("year"),
    part("month"),
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  ].join("-")
}

function timestampsEqual(crmValue: unknown, zohoValue: unknown): boolean {
  const crmTimestamp = comparableTimestamp(crmValue)
  const zohoTimestamp = comparableTimestamp(zohoValue)
  if (crmTimestamp !== null && zohoTimestamp !== null && crmTimestamp === zohoTimestamp) {
    return true
  }

  const zohoWallClock = wallClockKey(zohoValue)
  if (!zohoWallClock) return false

  // The CRM domain treats Zoho timestamps as Italian local wall-clock values.
  // Some historical CRM fields are serialized as timestamptz instants, so compare
  // both the stored clock and the Italy-displayed clock to the CSV clock.
  return wallClockKey(crmValue) === zohoWallClock || romeWallClockKey(crmValue) === zohoWallClock
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  if (timestampsEqual(a, b)) return true
  return comparableValue(a) === comparableValue(b)
}

export function zohoIdValuesEqual(a: unknown, b: unknown): boolean {
  const aId = normalizeZohoId(a)
  const bId = normalizeZohoId(b)
  return (aId || null) === (bId || null)
}
