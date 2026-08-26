import { NextResponse, after } from "next/server"
import {
  bulkUpdateRecords,
  deleteLeadRecords,
  type BulkField,
} from "@/lib/leads/repository"
import { requireApiRecord } from "@/lib/permissions/server"
import { createClient } from "@/lib/supabase/server"
import {
  buildLeadUpdateActivityText,
  insertLeadUpdateActivity,
} from "@/lib/leads/update-activity-log"
import type { PermissionEngine } from "@/lib/permissions/types"

type BulkPayload =
  | { action: "delete"; ids: string[] }
  | { action: "convert"; ids: string[] }
  | { action: "transfer"; ids: string[]; value: string }
  | { action: "update"; ids: string[]; field: BulkField; value: string }

async function logBulkUpdate(params: {
  ids: string[]
  affected: number
  permissions: PermissionEngine
  field: BulkField
  value: string
}) {
  if (params.affected === 0) return
  const supabase = await createClient()
  const subject = params.permissions.snapshot.subject
  const text = buildLeadUpdateActivityText({
    source: "manuale",
    sourceDetail: subject.nome
      ? `Modifica massiva eseguita da ${subject.nome}`
      : "Modifica massiva dalla lista Lead",
    reason: "modifica_massiva",
    changedFields: [params.field, "Ora ultima attivita'"],
    details: [`Valore impostato: ${params.value}`],
  })

  after(async () => {
    await Promise.all(
      params.ids.map((leadId) =>
        insertLeadUpdateActivity(supabase, {
          leadId,
          userId: subject.userId,
          text,
          logPrefix: "[api/leads/bulk] attivita modifica",
        }),
      ),
    )
  })
}

export async function POST(request: Request) {
  const body = (await request.json()) as BulkPayload
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json(
      { error: "Nessun record selezionato" },
      { status: 400 },
    )
  }
  switch (body.action) {
    case "delete": {
      const guard = await requireApiRecord("lead", "delete")
      if (guard.response) return guard.response
      const affected = await deleteLeadRecords(body.ids)
      return NextResponse.json({ affected })
    }
    case "convert": {
      const guard = await requireApiRecord("lead", "edit")
      if (guard.response) return guard.response
      const affected = await bulkUpdateRecords(body.ids, "Stato Lead", "Convertito")
      await logBulkUpdate({
        ids: body.ids,
        affected,
        permissions: guard.permissions,
        field: "Stato Lead",
        value: "Convertito",
      })
      return NextResponse.json({ affected })
    }
    case "transfer": {
      const guard = await requireApiRecord("lead", "assign")
      if (guard.response) return guard.response
      const affected = await bulkUpdateRecords(body.ids, "Lead Proprietario", body.value)
      await logBulkUpdate({
        ids: body.ids,
        affected,
        permissions: guard.permissions,
        field: "Lead Proprietario",
        value: body.value,
      })
      return NextResponse.json({ affected })
    }
    case "update": {
      const guard = await requireApiRecord("lead", "bulk_update")
      if (guard.response) return guard.response
      const affected = await bulkUpdateRecords(body.ids, body.field, body.value)
      await logBulkUpdate({
        ids: body.ids,
        affected,
        permissions: guard.permissions,
        field: body.field,
        value: body.value,
      })
      return NextResponse.json({ affected })
    }
    default:
      return NextResponse.json({ error: "Azione non valida" }, { status: 400 })
  }
}
