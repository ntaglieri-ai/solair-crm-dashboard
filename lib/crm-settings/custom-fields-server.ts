import type { createClient } from "@/lib/supabase/server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import type { FieldModuleKey } from "@/lib/permissions/field-catalog"
import type { CustomFieldValue } from "@/lib/mock-data"
import { customOptions, type CustomFieldMetadata } from "./custom-fields"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Legge i campi custom visibili di un modulo (crm_custom_fields, colonna
 * reale aggiunta via ALTER TABLE da CRM Settings → Attributi) e i loro valori
 * per UN record. Nasce dalla scheda Cliente ed e' stata generalizzata quando
 * la stessa cosa e' servita sul Lead: crm_custom_fields ha gia' `table_name`,
 * quindi non c'e' nulla di specifico per modulo se non la tabella e la chiave
 * dei permessi di campo.
 *
 * Sempre a prova di errore: se la tabella metadata non esiste ancora o la
 * query fallisce ritorna array vuoto, invece di far fallire l'intera pagina
 * di dettaglio per un pezzo accessorio.
 */
export async function loadRecordCustomFieldValues(
  supabase: SupabaseClient,
  table: string,
  permissionModule: FieldModuleKey,
  recordId: string,
): Promise<CustomFieldValue[]> {
  const { data: fields, error: fieldsError } = await supabase
    .from("crm_custom_fields")
    .select("field_key, label, tipo, column_name, required, options")
    .eq("table_name", table)
    .eq("visible", true)
    .is("deleted_at", null)
    .order("ordinamento", { ascending: true })

  if (fieldsError || !fields || fields.length === 0) return []

  const permissions = await getCurrentPermissions()
  const visibleFields = fields.filter(
    (f) =>
      /^[a-z][a-z0-9_]*$/.test(f.column_name) &&
      permissions.canField(permissionModule, f.column_name, "view"),
  )
  if (!visibleFields.length) return []

  const columns = visibleFields.map((f) => f.column_name as string)
  const { data: row, error: valuesError } = await supabase
    .from(table)
    .select(columns.join(","))
    .eq("id", recordId)
    .maybeSingle()

  if (valuesError || !row) return []

  return visibleFields.map((f) => ({
    key: f.field_key as string,
    label: f.label as string,
    tipo: f.tipo as string,
    column: f.column_name as string,
    required: Boolean(f.required),
    options: customOptions(f.options),
    value: (row as unknown as Record<string, unknown>)[f.column_name as string] ?? null,
  }))
}

/**
 * Metadata dei soli campi custom modificabili di un modulo, nella forma
 * attesa da buildCustomPatch. `system: false` esclude le colonne native
 * censite in crm_custom_fields, che si modificano dal loro campo dedicato.
 */
export async function loadEditableCustomFieldMetadata(
  supabase: SupabaseClient,
  table: string,
): Promise<CustomFieldMetadata[] | null> {
  const { data, error } = await supabase
    .from("crm_custom_fields")
    .select("field_key,column_name,label,tipo,required,options")
    .eq("table_name", table)
    .eq("visible", true)
    .eq("system", false)
    .is("deleted_at", null)
  if (error) return null
  return (data ?? []) as CustomFieldMetadata[]
}
