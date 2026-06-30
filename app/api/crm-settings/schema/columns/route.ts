import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiAction } from "@/lib/permissions/server"
import {
  dbTypeForFieldType,
  isValidColumnName,
  tableForCrmModule,
} from "@/lib/crm-settings/schema-admin"
import type { CampoTipo } from "@/lib/system-settings-data"

type ColumnBody = {
  module?: string
  name?: string
  label?: string
  type?: CampoTipo
  required?: boolean
  visible?: boolean
}

type PhysicalColumnRow = {
  column_name: string
  data_type: string
  is_nullable: string
  ordinal_position: number
}

type CustomFieldRow = {
  id: string
  field_key: string
  label: string
  tipo: CampoTipo
  required: boolean
  visible: boolean
  system: boolean
  table_name: string
  column_name: string
  db_type: string
}

function titleFromColumn(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function fieldTypeFromDbType(value: string): CampoTipo {
  const type = value.toLowerCase()
  if (type.includes("timestamp")) return "datetime"
  if (type === "date") return "date"
  if (type === "boolean") return "boolean"
  if (type.includes("numeric") || type.includes("integer") || type.includes("double")) {
    return "number"
  }
  if (type === "uuid") return "lookup"
  return "text"
}

function schemaErrorMessage(error: { message?: string; code?: string }) {
  const message = error.message ?? "Operazione schema non riuscita"
  const lowerMessage = message.toLowerCase()
  if (
    lowerMessage.includes("column crm_custom_fields.") ||
    lowerMessage.includes("could not find the") ||
    lowerMessage.includes("column") && lowerMessage.includes("does not exist")
  ) {
    return "Schema campi CRM incompleto su Supabase. Esegui la query di creazione crm_custom_fields."
  }
  if (
    error.code === "42883" ||
    lowerMessage.includes("function") ||
    lowerMessage.includes("schema cache")
  ) {
    return "Funzioni schema CRM non presenti su Supabase. Applica supabase/permission-engine-schema.sql."
  }
  return message
}

function isMissingSchemaObject(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ""
  return (
    error?.code === "42P01" ||
    error?.code === "42883" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  )
}

export async function GET(request: Request) {
  const guard = await requireApiAction("crm_settings.system.schema.manage")
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const tableName = tableForCrmModule(searchParams.get("module") ?? "")
  if (!tableName) {
    return NextResponse.json({ error: "Modulo CRM non valido" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: physicalColumns, error: physicalError } = await supabase.rpc(
    "crm_admin_list_columns",
    { p_table_name: tableName },
  )

  if (physicalError) {
    return NextResponse.json({ error: schemaErrorMessage(physicalError) }, { status: 500 })
  }

  const { data: customFields, error: customError } = await supabase
    .from("crm_custom_fields")
    .select("id, field_key, label, tipo, required, visible, system, table_name, column_name, db_type")
    .eq("table_name", tableName)
    .is("deleted_at", null)
    .order("ordinamento", { ascending: true })

  if (customError && !isMissingSchemaObject(customError)) {
    return NextResponse.json({ error: schemaErrorMessage(customError) }, { status: 500 })
  }

  const customByColumn = new Map(
    ((customFields ?? []) as CustomFieldRow[]).map((field) => [field.column_name, field]),
  )
  const columns = ((physicalColumns ?? []) as PhysicalColumnRow[]).map((column) => {
    const custom = customByColumn.get(column.column_name)
    return {
      id: custom?.id ?? column.column_name,
      field_key: custom?.field_key ?? column.column_name,
      label: custom?.label ?? titleFromColumn(column.column_name),
      tipo: custom?.tipo ?? fieldTypeFromDbType(column.data_type),
      required: custom?.required ?? column.is_nullable === "NO",
      visible: custom?.visible ?? true,
      system: custom ? custom.system : true,
      table_name: tableName,
      column_name: column.column_name,
      db_type: custom?.db_type ?? column.data_type,
      ordinal_position: column.ordinal_position,
    }
  })

  return NextResponse.json({ columns })
}

export async function POST(request: Request) {
  const guard = await requireApiAction("crm_settings.system.schema.manage")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as ColumnBody | null
  const moduleName = body?.module ?? ""
  const tableName = tableForCrmModule(moduleName)
  const name = body?.name?.trim() ?? ""
  const label = body?.label?.trim() ?? ""
  const fieldType = body?.type ?? "text"
  const dbType = dbTypeForFieldType(fieldType)

  if (!tableName) {
    return NextResponse.json({ error: "Modulo CRM non valido" }, { status: 400 })
  }
  if (!isValidColumnName(name)) {
    return NextResponse.json({ error: "Nome colonna non valido" }, { status: 400 })
  }
  if (!label) {
    return NextResponse.json({ error: "Etichetta obbligatoria" }, { status: 400 })
  }
  if (!dbType) {
    return NextResponse.json({ error: "Tipo campo non valido" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("crm_admin_add_column", {
    p_table_name: tableName,
    p_column_name: name,
    p_db_type: dbType,
    p_label: label,
    p_field_type: fieldType,
    p_required: Boolean(body?.required),
    p_visible: body?.visible ?? true,
  })

  if (error) {
    return NextResponse.json({ error: schemaErrorMessage(error) }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data })
}

export async function PATCH(request: Request) {
  const guard = await requireApiAction("crm_settings.system.schema.manage")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as
    | (ColumnBody & { column?: string })
    | null
  const tableName = tableForCrmModule(body?.module ?? "")
  const columnName = body?.column?.trim() ?? body?.name?.trim() ?? ""

  if (!tableName || !isValidColumnName(columnName)) {
    return NextResponse.json({ error: "Campo CRM non valido" }, { status: 400 })
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (typeof body?.label === "string" && body.label.trim()) patch.label = body.label.trim()
  if (typeof body?.required === "boolean") patch.required = body.required
  if (typeof body?.visible === "boolean") patch.visible = body.visible

  const supabase = await createClient()
  const { error } = await supabase
    .from("crm_custom_fields")
    .update(patch)
    .eq("table_name", tableName)
    .eq("column_name", columnName)
    .eq("system", false)
    .is("deleted_at", null)

  if (error) {
    return NextResponse.json({ error: schemaErrorMessage(error) }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const guard = await requireApiAction("crm_settings.system.schema.manage")
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const tableName = tableForCrmModule(searchParams.get("module") ?? "")
  const columnName = searchParams.get("column")?.trim() ?? ""

  if (!tableName || !isValidColumnName(columnName)) {
    return NextResponse.json({ error: "Campo CRM non valido" }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("crm_admin_drop_column", {
    p_table_name: tableName,
    p_column_name: columnName,
  })

  if (error) {
    return NextResponse.json({ error: schemaErrorMessage(error) }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
