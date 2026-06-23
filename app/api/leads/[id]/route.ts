import { NextResponse } from "next/server"
import type { Lead } from "@/lib/mock-data"
import { updateLeadRecord, deleteLeadRecords } from "@/lib/leads/repository"

// PATCH /api/leads/:id — aggiornamento parziale (es. stato, proprietario, tag).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const patch = (await request.json()) as Partial<Lead>
  const updated = updateLeadRecord(id, patch)
  if (!updated) {
    return NextResponse.json({ error: "Lead non trovato" }, { status: 404 })
  }
  return NextResponse.json(updated)
}

// DELETE /api/leads/:id — eliminazione singola.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const removed = deleteLeadRecords([id])
  if (removed === 0) {
    return NextResponse.json({ error: "Lead non trovato" }, { status: 404 })
  }
  return NextResponse.json({ removed })
}
