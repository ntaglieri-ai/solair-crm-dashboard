import type {
  CampoTipo,
  ModuloAttributi,
  ModuloValori,
} from "@/lib/system-settings-data"

export const CRM_MODULE_TABLES: Record<ModuloAttributi | ModuloValori, string> = {
  Lead: "leads",
  Clienti: "clienti",
  Compiti: "compiti",
  Scadenze: "scadenze",
  Installatori: "installatori",
}

export const CRM_FIELD_DB_TYPES: Record<CampoTipo, string> = {
  text: "text",
  textarea: "text",
  email: "text",
  phone: "text",
  number: "numeric",
  currency: "numeric",
  date: "date",
  datetime: "timestamptz",
  boolean: "boolean",
  select: "text",
  multiselect: "text[]",
  lookup: "uuid",
}

export function tableForCrmModule(moduleName: string) {
  return CRM_MODULE_TABLES[moduleName as ModuloAttributi | ModuloValori] ?? null
}

export function dbTypeForFieldType(fieldType: CampoTipo) {
  return CRM_FIELD_DB_TYPES[fieldType]
}

export function isValidColumnName(value: string) {
  return /^[a-z][a-z0-9_]*$/.test(value)
}

export function valueKeyFromLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80)
}
