import { NextResponse } from "next/server"
import {
  bulkUpdateRecords,
  deleteLeadRecords,
  type BulkField,
} from "@/lib/leads/repository"
import { requireApiRecord } from "@/lib/permissions/server"

type BulkPayload =
  | { action: "delete"; ids: string[] }
  | { action: "convert"; ids: string[] }
  | { action: "transfer"; ids: string[]; value: string }
  | { action: "update"; ids: string[]; field: BulkField; value: string }

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
      return NextResponse.json({ affected })
    }
    case "transfer": {
      const guard = await requireApiRecord("lead", "assign")
      if (guard.response) return guard.response
      const affected = await bulkUpdateRecords(body.ids, "Lead Proprietario", body.value)
      return NextResponse.json({ affected })
    }
    case "update": {
      const guard = await requireApiRecord("lead", "bulk_update")
      if (guard.response) return guard.response
      const affected = await bulkUpdateRecords(body.ids, body.field, body.value)
      return NextResponse.json({ affected })
    }
    default:
      return NextResponse.json({ error: "Azione non valida" }, { status: 400 })
  }
}
