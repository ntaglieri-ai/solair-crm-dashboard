import { NextResponse } from "next/server"
import {
  updateScadenzaRecord,
  deleteScadenzaRecord,
  type ScadenzaInput,
} from "@/lib/scadenze/repository"
import { requireApiRecord } from "@/lib/permissions/server"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("scadenze", "edit")
  if (guard.response) return guard.response

  const { id } = await params
  const patch = (await request.json()) as Partial<ScadenzaInput>
  const updated = await updateScadenzaRecord(id, patch)
  if (!updated) {
    return NextResponse.json({ error: "Scadenza non trovata" }, { status: 404 })
  }
  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("scadenze", "delete")
  if (guard.response) return guard.response

  const { id } = await params
  const removed = await deleteScadenzaRecord(id)
  if (!removed) {
    return NextResponse.json({ error: "Scadenza non trovata" }, { status: 404 })
  }
  return NextResponse.json({ removed: true })
}
