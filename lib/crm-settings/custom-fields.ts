import type { CustomFieldValue } from "@/lib/mock-data"

export const CUSTOM_FIELD_PREFIX = "custom:"

export type CustomFieldMetadata = {
  field_key: string
  column_name: string
  label: string
  tipo: string
  required: boolean
  options: unknown
}

export function customOptions(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Metadata comes from the server, never from the request's label/type/column. */
export function validateCustomValue(field: Pick<CustomFieldValue, "label" | "tipo" | "required" | "options">, value: unknown): unknown {
  const fail = () => { throw new Error(`Valore non valido per ${field.label}`) }
  const empty = value === null || (typeof value === "string" && value.trim() === "") || (field.tipo === "multiselect" && Array.isArray(value) && value.length === 0)
  if (empty) {
    if (field.required) throw new Error(`${field.label}: campo obbligatorio`)
    return null
  }
  const options = field.options ?? []
  switch (field.tipo) {
    case "number":
    case "currency":
      if (typeof value !== "number" || !Number.isFinite(value)) return fail()
      return value
    case "boolean":
      if (typeof value !== "boolean") return fail()
      return value
    case "multiselect":
      if (!Array.isArray(value) || !value.every((v) => typeof v === "string" && (!options.length || options.includes(v)))) return fail()
      return [...new Set(value)]
    case "date":
      if (typeof value !== "string" || !validDate(value)) return fail()
      return value
    case "datetime":
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) || !validDate(value.slice(0, 10)) || !Number.isFinite(Date.parse(value))) return fail()
      return new Date(value).toISOString()
    case "lookup":
      if (typeof value !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) return fail()
      return value
    case "select":
      if (typeof value !== "string" || (options.length && !options.includes(value))) return fail()
      return value
    case "email":
      if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return fail()
      return value
    case "text":
    case "textarea":
    case "phone":
      if (typeof value !== "string") return fail()
      return value
    default:
      return fail()
  }
}

export function buildCustomPatch(
  patch: Record<string, unknown>,
  fields: CustomFieldMetadata[],
  canEdit: (column: string) => boolean,
): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (!key.startsWith(CUSTOM_FIELD_PREFIX)) continue
    const field = fields.find((item) => item.field_key === key.slice(CUSTOM_FIELD_PREFIX.length))
    if (!field || !/^[a-z][a-z0-9_]*$/.test(field.column_name) || !canEdit(field.column_name)) {
      throw new Error("Campo personalizzato non disponibile o non modificabile")
    }
    row[field.column_name] = validateCustomValue({ ...field, options: customOptions(field.options) }, value)
  }
  return row
}
