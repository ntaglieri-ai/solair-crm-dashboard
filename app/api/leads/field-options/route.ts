import { NextResponse } from "next/server"
import {
  optionsFromColumnValues,
  type CrmColumnValueRow,
} from "@/lib/crm-settings/column-values"
import {
  cleanLeadOptionValue,
  isLeadOptionColumn,
  LEAD_FIELD_OPTION_FALLBACKS,
  LEAD_OPTION_COLUMNS,
  mergeLeadOptions,
  type LeadOptionColumn,
} from "@/lib/leads/field-options"
import { applyOwnerScope, resolveOwnerScope } from "@/lib/permissions/data-scope"
import { requireApiRecord } from "@/lib/permissions/server"
import { createClient } from "@/lib/supabase/server"

type ValueCount = {
  value: string
  count: number
}

function requestedFields(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get("fields") ?? searchParams.get("field") ?? ""
  const fields = raw
    .split(",")
    .map((field) => field.trim())
    .filter(isLeadOptionColumn)
  return fields.length ? [...new Set(fields)] : [...LEAD_OPTION_COLUMNS]
}

export async function GET(request: Request) {
  const guard = await requireApiRecord("lead", "view")
  if (guard.response) return guard.response

  const fields = requestedFields(request)
  const supabase = await createClient()
  const scope = await resolveOwnerScope(guard.permissions.snapshot, "lead")

  const configuredResult = await supabase
    .from("crm_column_values")
    .select("id, table_name, column_name, value, label, color, sort_order")
    .eq("table_name", "leads")
    .in("column_name", fields)
    .eq("active", true)
    .order("column_name", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true })

  const configuredRows = configuredResult.error
    ? []
    : ((configuredResult.data ?? []) as CrmColumnValueRow[])

  const entries = await Promise.all(
    fields.map(async (field): Promise<[LeadOptionColumn, ValueCount[]]> => {
      const result = await applyOwnerScope(
        supabase
          .from("leads")
          .select(field)
          .not(field, "is", null)
          .limit(field === "campaign_name" ? 5000 : 2000),
        "lead_proprietario_id",
        scope,
      )
      if (result.error) {
        console.warn(`[api/leads/field-options] ${field}:`, result.error.message)
        return [field, []]
      }
      const counts = new Map<string, number>()
      for (const row of result.data ?? []) {
        const value = cleanLeadOptionValue(field, (row as Record<string, unknown>)[field])
        if (!value) continue
        counts.set(value, (counts.get(value) ?? 0) + 1)
      }
      return [
        field,
        [...counts.entries()]
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "it")),
      ]
    }),
  )

  const options = Object.fromEntries(
    entries.map(([field, counts]) => {
      const configured = optionsFromColumnValues(
        configuredRows,
        field,
        LEAD_FIELD_OPTION_FALLBACKS[field],
        { includeFallback: false },
      )
      return [field, mergeLeadOptions(field, configured, counts.map((item) => item.value))]
    }),
  )

  return NextResponse.json(
    { options },
    { headers: { "Cache-Control": "private, max-age=300" } },
  )
}
