import { NextResponse } from "next/server"
import type { ClienteRecord } from "@/lib/mock-data"
import { updateClienteRecord, deleteClienteRecords } from "@/lib/clienti/repository"
import { requireApiRecord } from "@/lib/permissions/server"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("clienti", "edit")
  if (guard.response) return guard.response

  const { id } = await params
  const patch = (await request.json()) as Partial<ClienteRecord>
  const updated = await updateClienteRecord(id, patch)
  if (!updated) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 })
  }
  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("clienti", "delete")
  if (guard.response) return guard.response

  const { id } = await params
  const removed = await deleteClienteRecords([id])
  if (removed === 0) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 })
  }
  return NextResponse.json({ removed })
}
