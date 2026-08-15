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

const ZOHO_CSV_TIME_ZONE = "Europe/Rome"

function parseTimestampParts(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?/,
  )
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? "0"),
    minute: Number(match[5] ?? "0"),
    second: Number(match[6] ?? "0"),
    millisecond: Number((match[7] ?? "0").padEnd(3, "0")),
  }
}

function timeZoneOffsetMinutes(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantMs))

  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value)
  const localAsUtcMs = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  )
  return (localAsUtcMs - instantMs) / 60000
}

function localRomeTimestampToUtcIso(value: string): string | null {
  const parts = parseTimestampParts(value)
  if (!parts) return null

  const localAsUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  )
  const firstOffset = timeZoneOffsetMinutes(localAsUtcMs, ZOHO_CSV_TIME_ZONE)
  let utcMs = localAsUtcMs - firstOffset * 60_000
  const secondOffset = timeZoneOffsetMinutes(utcMs, ZOHO_CSV_TIME_ZONE)
  if (secondOffset !== firstOffset) {
    utcMs = localAsUtcMs - secondOffset * 60_000
  }

  const parsed = new Date(utcMs)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
}

export function timestampValue(value: unknown): string | null {
  const normalized = String(value ?? "").trim()
  if (!normalized) return null
  return localRomeTimestampToUtcIso(normalized)
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

export function zohoIdValuesEqual(a: unknown, b: unknown): boolean {
  const aId = normalizeZohoId(a)
  const bId = normalizeZohoId(b)
  return (aId || null) === (bId || null)
}
