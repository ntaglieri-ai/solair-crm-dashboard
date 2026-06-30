import type {
  CampoTipo,
  ModuloAttributi,
  ModuloValori,
} from "@/lib/system-settings-data"

export const CRM_FIELD_TARGETS = [
  {
    module: "Lead",
    pageKey: "lead",
    href: "/leads",
    tableName: "leads",
    description: "Schede lead, form lead e colonne operative lead.",
  },
  {
    module: "Clienti",
    pageKey: "clienti",
    href: "/clienti",
    tableName: "clienti",
    description: "Anagrafiche clienti, dettaglio cliente e liste clienti.",
  },
  {
    module: "Compiti",
    pageKey: "compiti",
    href: "/compiti",
    tableName: "compiti",
    description: "Task, priorita', scadenze operative e assegnazioni.",
  },
  {
    module: "Scadenze",
    pageKey: "scadenze",
    href: "/scadenze",
    tableName: "scadenze",
    description: "Scadenze CRM e campi data/processo collegati.",
  },
  {
    module: "Installatori",
    pageKey: "installatori",
    href: "/installatori",
    tableName: "installatori",
    description: "Anagrafiche installatori e dati operativi rete.",
  },
] as const

export const CRM_MODULE_TABLES = Object.fromEntries(
  CRM_FIELD_TARGETS.map((target) => [target.module, target.tableName]),
) as Record<ModuloAttributi | ModuloValori, string>

export type CrmFieldTarget = (typeof CRM_FIELD_TARGETS)[number]

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
