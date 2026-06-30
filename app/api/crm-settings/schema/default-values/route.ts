import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiAction } from "@/lib/permissions/server"
import {
  isValidColumnName,
  tableForCrmModule,
  valueKeyFromLabel,
} from "@/lib/crm-settings/schema-admin"

type ValueBody = {
  module?: string
  field?: string
  id?: string
  label?: string
  color?: string
  order?: string[]
}

function schemaErrorMessage(error: { message?: string; code?: string }) {
  const message = error.message ?? "Operazione valori non riuscita"
  if (
    error.code === "42P01" ||
    message.toLowerCase().includes("does not exist") ||
    message.toLowerCase().includes("schema cache")
  ) {
    return "Tabella crm_column_values non presente su Supabase. Applica supabase/permission-engine-schema.sql."
  }
  return message
}

export async function GET(request: Request) {
  const guard = await requireApiAction("crm_settings.system.default_values.manage")
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const tableName = tableForCrmModule(searchParams.get("module") ?? "")
  const fieldName = searchParams.get("field")?.trim() ?? ""

  if (!tableName || (fieldName && !isValidColumnName(fieldName))) {
    return NextResponse.json({ error: "Campo CRM non valido" }, { status: 400 })
  }

  const supabase = await createClient()
  let query = supabase
    .from("crm_column_values")
    .select("id, table_name, column_name, value, label, color, sort_order")
    .eq("table_name", tableName)
    .eq("active", true)
    .order("column_name", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true })

  if (fieldName) query = query.eq("column_name", fieldName)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: schemaErrorMessage(error) }, { status: 500 })
  }

  return NextResponse.json({ values: data ?? [] })
}

export async function POST(request: Request) {
  const guard = await requireApiAction("crm_settings.system.default_values.manage")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as ValueBody | null
  const tableName = tableForCrmModule(body?.module ?? "")
  const fieldName = body?.field?.trim() ?? ""
  const label = body?.label?.trim() ?? ""
  const value = valueKeyFromLabel(label)

  if (!tableName || !isValidColumnName(fieldName)) {
    return NextResponse.json({ error: "Campo CRM non valido" }, { status: 400 })
  }
  if (!label || !value) {
    return NextResponse.json({ error: "Etichetta valore obbligatoria" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: lastValue } = await supabase
    .from("crm_column_values")
    .select("sort_order")
    .eq("table_name", tableName)
    .eq("column_name", fieldName)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from("crm_column_values")
    .upsert(
      {
        table_name: tableName,
        column_name: fieldName,
        value,
        label,
        color: body?.color ?? null,
        sort_order: (lastValue?.sort_order ?? -1) + 1,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "table_name,column_name,value" },
    )
    .select("id")
    .single()

  if (error) {
    return NextResponse.json({ error: schemaErrorMessage(error) }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id, value })
}

export async function PATCH(request: Request) {
  const guard = await requireApiAction("crm_settings.system.default_values.manage")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as ValueBody | null
  const tableName = tableForCrmModule(body?.module ?? "")
  const fieldName = body?.field?.trim() ?? ""

  if (!tableName || !isValidColumnName(fieldName) || !body?.order?.length) {
    return NextResponse.json({ error: "Riordino valori non valido" }, { status: 400 })
  }

  const supabase = await createClient()
  const results = await Promise.all(
    body.order.map((id, index) =>
      supabase
        .from("crm_column_values")
        .update({ sort_order: index, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("table_name", tableName)
        .eq("column_name", fieldName),
    ),
  )
  const error = results.find((result) => result.error)?.error

  if (error) {
    return NextResponse.json({ error: schemaErrorMessage(error) }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const guard = await requireApiAction("crm_settings.system.default_values.manage")
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const tableName = tableForCrmModule(searchParams.get("module") ?? "")
  const fieldName = searchParams.get("field")?.trim() ?? ""
  const id = searchParams.get("id")?.trim() ?? ""
  const value = searchParams.get("value")?.trim() ?? ""

  if (!tableName || !isValidColumnName(fieldName) || (!id && !value)) {
    return NextResponse.json({ error: "Valore CRM non valido" }, { status: 400 })
  }

  const supabase = await createClient()
  let query = supabase
    .from("crm_column_values")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("table_name", tableName)
    .eq("column_name", fieldName)

  query = id ? query.eq("id", id) : query.eq("value", value)
  const { error } = await query

  if (error) {
    return NextResponse.json({ error: schemaErrorMessage(error) }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
