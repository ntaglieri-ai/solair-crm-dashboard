import { CLIENTI_RECORD_FIELDS } from "@/lib/clienti/zoho-fields"
import { LEAD_RECORD_FIELDS } from "@/lib/leads/field-map"
import type { FieldModuleKey } from "@/lib/permissions/field-catalog"
import type { PermissionEngine } from "@/lib/permissions/types"

type PatchFieldMap = Record<string, string>

export const LEAD_PATCH_FIELD_MAP: PatchFieldMap = Object.fromEntries(
  LEAD_RECORD_FIELDS.map((field) => [field.appField, field.column]),
)

export const CLIENTI_PATCH_FIELD_MAP: PatchFieldMap = Object.fromEntries(
  CLIENTI_RECORD_FIELDS.map((field) => [field.appField, field.column]),
)

export const COMPITI_PATCH_FIELD_MAP: PatchFieldMap = {
  Oggetto: "oggetto",
  Stato: "stato",
  Priorità: "priorita",
  "Data di scadenza": "scadenza",
  "Proprietario del compito": "proprietario_nome",
  "Proprietario del compito.id": "proprietario_id",
  Sede: "sede",
  Descrizione: "descrizione",
  "Nome contatto": "nome_contatto",
  "Nome contatto.id": "nome_contatto_zoho_id",
  Ripeti: "ripeti",
  Promemoria: "promemoria",
  Tag: "tag",
  Locked: "locked",
  "Correlato a": "correlato_id",
}

export const INSTALLATORI_PATCH_FIELD_MAP: PatchFieldMap = {
  nome: "nome",
  email: "email",
  email_secondaria: "email_secondaria",
  telefono: "telefono",
  tag: "tag",
  attivo: "attivo",
  canale_preferito: "canale_preferito",
  proprietario_id: "proprietario_id",
  note: "note",
}

export const SCADENZE_PATCH_FIELD_MAP: PatchFieldMap = {
  nome: "nome",
  data_scadenza: "data_scadenza",
  proprietario_id: "proprietario_id",
  descrizione: "descrizione",
  connesso_a_id: "connesso_a_id",
  connesso_a_tipo: "connesso_a_tipo",
  tag: "tag",
}

export function nonEditablePatchField(
  permissions: PermissionEngine,
  module: FieldModuleKey,
  patch: Record<string, unknown>,
  fields: PatchFieldMap,
) {
  for (const key of Object.keys(patch)) {
    const field = fields[key]
    if (field && !permissions.canField(module, field, "edit")) return key
  }
  return null
}
