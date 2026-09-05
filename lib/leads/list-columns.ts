import { LEAD_COLUMNS } from "@/lib/mock-data"
import { LIST_BASE_FIELDS } from "@/lib/leads/api-types"
import { LEAD_RECORD_FIELDS } from "@/lib/leads/field-map"

const LEAD_APP_FIELD_TO_COLUMN = new Map<string, string>(
  LEAD_RECORD_FIELDS.map((field) => [field.appField, field.column]),
)

const TECHNICAL_COLUMNS = [
  "id",
  "created_at",
  "updated_at",
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

export function leadFieldColumns(field: string): string[] {
  const columns = new Set<string>()
  const directColumn = LEAD_APP_FIELD_TO_COLUMN.get(field)
  if (directColumn) columns.add(directColumn)
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
) {
  if (fields.includes("*")) {
    return [
      ...new Set([
        ...TECHNICAL_COLUMNS,
        ...LEAD_RECORD_FIELDS.map((field) => field.column),
        "zoho_installatore_sopralluogo_id",
        "zoho_installatore_sopralluogo_nome",
        "ora_ultima_attivita",
      ]),
    ].join(",")
  }

  const columns = new Set<string>(TECHNICAL_COLUMNS)
  for (const field of requestedListFields(fields)) {
    for (const column of leadFieldColumns(field)) columns.add(column)
  }
  if (sortBy) {
    for (const column of leadFieldColumns(sortBy)) columns.add(column)
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
