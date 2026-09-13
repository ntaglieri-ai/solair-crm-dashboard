import { LEAD_COLUMNS } from "@/lib/mock-data"
import { LIST_BASE_FIELDS } from "@/lib/leads/api-types"
import { LEAD_RECORD_FIELDS } from "@/lib/leads/field-map"

const LEAD_APP_FIELD_TO_COLUMN = new Map<string, string>(
  LEAD_RECORD_FIELDS.map((field) => [field.appField, field.column]),
)

type LeadListColumnOptions = {
  includeRating?: boolean
}

const TECHNICAL_COLUMNS = [
  "id",
  "created_at",
  "updated_at",
  // Telefono, Mobile/Fisso ed e-mail servono sempre, anche quando le colonne omonime non
  // sono visibili: le icone di contatto rapido stanno nella cella del nome e
  // si disegnano comunque. Mobile/Fisso nei dati Zoho e' un secondo numero:
  // se Telefono e' vuoto deve poter fare da fallback.
  "telefono",
  "mobile_fisso",
  "email",
]

const FIELD_EXTRA_COLUMNS: Record<string, string[]> = {
  "Ora creazione": ["created_at"],
  "Ora ultima attività": ["ora_ultima_attivita"],
  "Badge dell'attività": [],
  "Badge di nota": [],
  Tag: [],
}

const FIELD_DEPENDENCY_COLUMNS: Record<string, string[]> = {
  "Installatore - Incaricato sopralluogo": [
    "zoho_installatore_sopralluogo_id",
    "zoho_installatore_sopralluogo_nome",
  ],
}

export const LEAD_RELATION_FIELDS = new Set<string>([
  "Badge dell'attività",
  "Badge di nota",
  "Tag",
])

export function leadFieldColumns(field: string, options: LeadListColumnOptions = {}): string[] {
  const includeRating = options.includeRating ?? true
  const columns = new Set<string>()
  const directColumn = LEAD_APP_FIELD_TO_COLUMN.get(field)
  if (directColumn && (includeRating || directColumn !== "rating")) columns.add(directColumn)
  for (const column of FIELD_EXTRA_COLUMNS[field] ?? []) columns.add(column)
  for (const column of FIELD_DEPENDENCY_COLUMNS[field] ?? []) columns.add(column)
  return [...columns]
}

function requestedListFields(fields: readonly string[]) {
  if (fields.includes("*")) {
    return LEAD_COLUMNS.map((column) => column.id)
  }
  return [...new Set([...LIST_BASE_FIELDS, ...fields])]
}

export function leadListColumnsForFields(
  fields: readonly string[],
  sortBy?: string | null,
  options: LeadListColumnOptions = {},
) {
  const includeRating = options.includeRating ?? true
  if (fields.includes("*")) {
    return [
      ...new Set([
        ...TECHNICAL_COLUMNS,
        ...LEAD_RECORD_FIELDS
          .map((field) => field.column)
          .filter((column) => includeRating || column !== "rating"),
        "zoho_installatore_sopralluogo_id",
        "zoho_installatore_sopralluogo_nome",
        "ora_ultima_attivita",
      ]),
    ].join(",")
  }

  const columns = new Set<string>(TECHNICAL_COLUMNS)
  for (const field of requestedListFields(fields)) {
    for (const column of leadFieldColumns(field, options)) columns.add(column)
  }
  if (sortBy) {
    for (const column of leadFieldColumns(sortBy, options)) columns.add(column)
  }
  return [...columns].join(",")
}

export function leadListNeedsInstallatoreSopralluogo(fields: readonly string[]) {
  return fields.includes("*") || requestedListFields(fields).includes("Installatore - Incaricato sopralluogo")
}

export function leadListNeedsNoteBadge(fields: readonly string[]) {
  return fields.includes("*") || requestedListFields(fields).includes("Badge di nota")
}

export function leadListNeedsActivityBadge(fields: readonly string[]) {
  return fields.includes("*") || requestedListFields(fields).includes("Badge dell'attività")
}

export function leadListNeedsTags(fields: readonly string[]) {
  return fields.includes("*") || requestedListFields(fields).includes("Tag")
}
