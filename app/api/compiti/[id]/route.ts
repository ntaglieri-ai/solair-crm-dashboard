import { NextResponse } from "next/server"
import type { Compito } from "@/lib/mock-data"
import { updateCompitoRecord, deleteCompitoRecords } from "@/lib/compiti/repository"
import { requireApiRecord } from "@/lib/permissions/server"
import { canAccessOwnedRecord } from "@/lib/permissions/data-scope"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("compiti", "edit")
  if (guard.response) return guard.response

  const { id } = await params
  if (!await canAccessOwnedRecord(guard.permissions.snapshot, "compiti", "compiti", "proprietario_id", id)) return NextResponse.json({ error: "Compito non trovato" }, { status: 404 })
  const patch = (await request.json()) as Partial<Compito>
  const updated = await updateCompitoRecord(id, patch)
  if (!updated) {
    return NextResponse.json({ error: "Compito non trovato" }, { status: 404 })
  }
  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("compiti", "delete")
  if (guard.response) return guard.response

  const { id } = await params
  if (!await canAccessOwnedRecord(guard.permissions.snapshot, "compiti", "compiti", "proprietario_id", id)) return NextResponse.json({ error: "Compito non trovato" }, { status: 404 })
  const removed = await deleteCompitoRecords([id])
  if (removed === 0) {
    return NextResponse.json({ error: "Compito non trovato" }, { status: 404 })
  }
  return NextResponse.json({ removed })
}
