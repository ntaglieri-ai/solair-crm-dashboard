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

export async function GET(request: Request) {
  const guard = await requireApiAction("crm_settings.system.schema.manage")
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const tableName = tableForCrmModule(searchParams.get("module") ?? "")
  if (!tableName) {
    return NextResponse.json({ error: "Modulo CRM non valido" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crm_custom_fields")
    .select("id, field_key, label, tipo, required, visible, system, table_name, column_name, db_type")
    .eq("table_name", tableName)
    .is("deleted_at", null)
    .order("ordinamento", { ascending: true })

  if (error) {
    return NextResponse.json({ error: schemaErrorMessage(error) }, { status: 500 })
  }

  return NextResponse.json({ columns: data ?? [] })
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
