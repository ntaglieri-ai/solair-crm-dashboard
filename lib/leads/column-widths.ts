import type { LeadColumnId } from "@/lib/mock-data"

export const LEAD_DATE_TIME_COLUMNS = new Set<LeadColumnId>([
  "Data Click",
  "Ora creazione",
  "Ora ultima attività",
  "Data/Ora",
])

export const LEAD_DATE_TIME_COLUMN_WIDTH = 178
export const LEAD_COMPACT_ICON_COLUMN_WIDTH = 56
export const LEAD_DEFAULT_MAX_COLUMN_WIDTH = 640

const LEAD_COLUMN_MIN_WIDTHS: Partial<Record<LeadColumnId, number>> = {
  "Badge dell'attività": LEAD_COMPACT_ICON_COLUMN_WIDTH,
  "Badge di nota": LEAD_COMPACT_ICON_COLUMN_WIDTH,
  Tag: 180,
  "Nome Lead": 190,
  "Lead Proprietario": 170,
  Città: 128,
  Provincia: 124,
  "Stato Lead": 152,
  "campaign name": 190,
  Telefono: 150,
  "Origine Lead": 154,
  "E-mail": 210,
  Valutazione: 136,
  "Mobile/Fisso": 140,
  "Creato da": 156,
  "Codice postale": 150,
  Paese: 120,
  Descrizione: 220,
  "Tempo di conversione Lead": 230,
  "Modalità iscrizione annullata": 250,
  "Ora iscrizione annullata": 210,
  "Account convertito": 170,
  "Contatto convertito": 170,
  "Residente in Sicilia": 170,
  "Social Lead ID": 160,
  "Data sopralluogo": 178,
  "Installatore - Incaricato sopralluogo": 280,
  "Connesso a": 136,
  "Modello pannello": 170,
  Sede: 120,
}

const LEAD_COLUMN_MAX_WIDTHS: Partial<Record<LeadColumnId, number>> = {
  Tag: 460,
  "Nome Lead": 520,
  "Lead Proprietario": 360,
  "campaign name": 460,
  "E-mail": 420,
  Descrizione: 620,
  "Installatore - Incaricato sopralluogo": 440,
}

function leadColumnGrowWeight(column: LeadColumnId) {
  if (column === "Badge dell'attività" || column === "Badge di nota") return 0
  if (column === "Valutazione" || column === "kWp" || column === "kWh") return 0.45
  if (
    column === "Nome Lead" ||
    column === "E-mail" ||
    column === "campaign name" ||
    column === "Descrizione"
  ) {
    return 1.45
  }
  if (isLeadDateTimeColumn(column)) return 0.7
  return 1
}

export function isLeadDateTimeColumn(column: LeadColumnId) {
  return LEAD_DATE_TIME_COLUMNS.has(column)
}

export function minimumLeadColumnWidth(column: LeadColumnId) {
  return (
    LEAD_COLUMN_MIN_WIDTHS[column] ??
    (isLeadDateTimeColumn(column) ? LEAD_DATE_TIME_COLUMN_WIDTH : 116)
  )
}

export function clampLeadColumnWidth(
  column: LeadColumnId,
  width: number,
  max = LEAD_DEFAULT_MAX_COLUMN_WIDTH,
) {
  return Math.min(
    LEAD_COLUMN_MAX_WIDTHS[column] ?? max,
    Math.max(minimumLeadColumnWidth(column), width),
  )
}

export function normalizeLeadColumnWidths(
  raw: unknown,
  validColumnIds: ReadonlySet<string>,
) {
  const widths: Partial<Record<LeadColumnId, number>> = {}
  if (!raw || typeof raw !== "object") return widths

  for (const [id, width] of Object.entries(raw)) {
    if (!validColumnIds.has(id) || typeof width !== "number" || !Number.isFinite(width)) {
      continue
    }
    widths[id as LeadColumnId] = clampLeadColumnWidth(id as LeadColumnId, width)
  }

  return widths
}

export function fitLeadColumnWidthsToViewport({
  columns,
  preferredWidths,
  viewportWidth,
  fixedWidth,
}: {
  columns: LeadColumnId[]
  preferredWidths: Record<LeadColumnId, number>
  viewportWidth: number
  fixedWidth: number
}) {
  const preferredDataWidth = columns.reduce(
    (total, column) => total + preferredWidths[column],
    0,
  )
  const extraWidth = Math.max(0, viewportWidth - fixedWidth) - preferredDataWidth
  if (extraWidth <= 0 || columns.length === 0) return preferredWidths

  const growWeights = columns.map((id) => ({
    id,
    weight: leadColumnGrowWeight(id),
  }))
  const totalWeight = growWeights.reduce((total, item) => total + item.weight, 0)
  if (totalWeight <= 0) return preferredWidths

  let assigned = 0
  const widths = { ...preferredWidths }
  growWeights.forEach((item, index) => {
    const isLast = index === growWeights.length - 1
    const addition = isLast
      ? extraWidth - assigned
      : Math.floor((extraWidth * item.weight) / totalWeight)
    assigned += addition
    widths[item.id] += addition
  })

  return widths
}
