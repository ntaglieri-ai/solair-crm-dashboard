import { NextResponse } from "next/server"
import {
  updateInstallatoreRecord,
  deleteInstallatoreRecord,
  type InstallatoreInput,
} from "@/lib/installatori/repository"
import { requireApiRecord } from "@/lib/permissions/server"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("installatori", "edit")
  if (guard.response) return guard.response

  const { id } = await params
  const patch = (await request.json()) as Partial<InstallatoreInput>
  const updated = await updateInstallatoreRecord(id, patch)
  if (!updated) {
    return NextResponse.json({ error: "Installatore non trovato" }, { status: 404 })
  }
  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("installatori", "delete")
  if (guard.response) return guard.response

  const { id } = await params
  const removed = await deleteInstallatoreRecord(id)
  if (!removed) {
    return NextResponse.json({ error: "Installatore non trovato" }, { status: 404 })
  }
  return NextResponse.json({ removed: true })
}
