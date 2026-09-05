import type { ClienteColumnId } from "@/lib/mock-data"

type ClienteDensity = "comoda" | "normale" | "densa"

export type ClienteViewPreferences = {
  version: 2
  owner: string
  visibleCols: ClienteColumnId[]
  columnWidths: Partial<Record<ClienteColumnId, number>>
  density: ClienteDensity
}

export const CLIENTI_VIEW_COOKIE = "solair_clienti_view"
export const CLIENTI_VIEW_COOKIE_PATH = "/clienti"

function isDensity(value: unknown): value is ClienteDensity {
  return value === "comoda" || value === "normale" || value === "densa"
}

function normalizeClienteColumnWidths(
  raw: unknown,
  validColumnIds: ReadonlySet<string>,
) {
  const widths: Partial<Record<ClienteColumnId, number>> = {}
  if (!raw || typeof raw !== "object") return widths

  for (const [id, width] of Object.entries(raw)) {
    if (!validColumnIds.has(id) || typeof width !== "number" || !Number.isFinite(width)) {
      continue
    }
    widths[id as ClienteColumnId] = Math.min(480, Math.max(72, width))
  }

  return widths
}

export function parseClienteViewPreferences(
  raw: string | undefined,
  owner: string,
  validColumnIds: ReadonlySet<string>,
): Omit<ClienteViewPreferences, "version" | "owner"> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ClienteViewPreferences>
    if (parsed.version !== 2) return null
    if (parsed.owner !== owner) return null

    const visibleCols = (parsed.visibleCols ?? []).filter((id) =>
      validColumnIds.has(id),
    )
    if (!visibleCols.length) return null

    return {
      visibleCols,
      columnWidths: normalizeClienteColumnWidths(
        parsed.columnWidths,
        validColumnIds,
      ),
      density: isDensity(parsed.density) ? parsed.density : "normale",
    }
  } catch {
    return null
  }
}

export function serializeClienteViewPreferences(
  prefs: ClienteViewPreferences,
): string {
  return encodeURIComponent(JSON.stringify(prefs))
}
