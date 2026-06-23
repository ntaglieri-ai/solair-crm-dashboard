import { NextResponse } from "next/server"
import {
  bulkUpdateRecords,
  deleteLeadRecords,
  type BulkField,
} from "@/lib/leads/repository"

type BulkPayload =
  | { action: "delete"; ids: string[] }
  | { action: "convert"; ids: string[] }
  | { action: "transfer"; ids: string[]; value: string }
  | { action: "update"; ids: string[]; field: BulkField; value: string }

// POST /api/leads/bulk — operazioni di massa (elimina, converti, trasferisci,
// aggiorna campo). Esegue tutto server-side in una sola richiesta.
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
      const affected = deleteLeadRecords(body.ids)
      return NextResponse.json({ affected })
    }
    case "convert": {
      const affected = bulkUpdateRecords(body.ids, "Stato Lead", "Convertito")
      return NextResponse.json({ affected })
    }
    case "transfer": {
      const affected = bulkUpdateRecords(
        body.ids,
        "Lead Proprietario",
        body.value,
      )
      return NextResponse.json({ affected })
    }
    case "update": {
      const affected = bulkUpdateRecords(body.ids, body.field, body.value)
      return NextResponse.json({ affected })
    }
    default:
      return NextResponse.json({ error: "Azione non valida" }, { status: 400 })
  }
}
