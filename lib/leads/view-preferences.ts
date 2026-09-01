// Preferenze di vista della tabella Lead (colonne visibili e loro ordine,
// larghezze, densità).
//
// Vivevano solo in localStorage, che il server non può leggere: la pagina
// veniva quindi disegnata con le colonne di default e saltava alla
// configurazione dell'utente solo a idratazione finita. Misurato su una vista
// personalizzata: CLS 0.44, un salto visibile a ~450ms.
//
// Ora viaggiano anche in un cookie, così il Server Component disegna subito
// la configurazione giusta. Il cookie è limitato a Path=/leads per non
// appesantire ogni richiesta di asset, e porta con sé l'id del proprietario:
// se il browser è condiviso e a loggarsi è un altro utente, le preferenze
// vengono ignorate invece di essere applicate a chi non gli appartengono.
import type { LeadColumnId } from "@/lib/mock-data"
import { normalizeLeadColumnWidths } from "@/lib/leads/column-widths"

export type LeadDensity = "comoda" | "normale" | "densa"

export type LeadViewPreferences = {
  version: 3
  owner: string
  visibleCols: LeadColumnId[]
  columnWidths: Partial<Record<LeadColumnId, number>>
  density: LeadDensity
}

export const LEADS_VIEW_COOKIE = "solair_leads_view"
export const LEADS_VIEW_COOKIE_PATH = "/leads"

function isDensity(value: unknown): value is LeadDensity {
  return value === "comoda" || value === "normale" || value === "densa"
}

/**
 * Legge il cookie e ne restituisce il contenuto solo se è valido e appartiene
 * a `owner`. Qualsiasi anomalia (JSON rotto, versione vecchia, proprietario
 * diverso) restituisce null: il chiamante ricade sui default, che è sempre uno
 * stato valido.
 */
export function parseLeadViewPreferences(
  raw: string | undefined,
  owner: string,
  validColumnIds: ReadonlySet<string>,
): Omit<LeadViewPreferences, "version" | "owner"> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<LeadViewPreferences>
    if (parsed.version !== 3) return null
    if (parsed.owner !== owner) return null

    const visibleCols = (parsed.visibleCols ?? []).filter((id) =>
      validColumnIds.has(id),
    )
    if (!visibleCols.length) return null

    return {
      visibleCols,
      columnWidths: normalizeLeadColumnWidths(
        parsed.columnWidths,
        validColumnIds,
      ),
      density: isDensity(parsed.density) ? parsed.density : "normale",
    }
  } catch {
    return null
  }
}

export function serializeLeadViewPreferences(prefs: LeadViewPreferences): string {
  return encodeURIComponent(JSON.stringify(prefs))
}
