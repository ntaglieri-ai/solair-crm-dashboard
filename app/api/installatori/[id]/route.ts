import { NextResponse } from "next/server"
import {
  updateInstallatoreRecord,
  deleteInstallatoreRecord,
  type InstallatoreInput,
} from "@/lib/installatori/repository"
import { requireApiRecord } from "@/lib/permissions/server"
import { canAccessOwnedRecord } from "@/lib/permissions/data-scope"
import { INSTALLATORI_PATCH_FIELD_MAP, nonEditablePatchField } from "@/lib/permissions/patch-fields"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("installatori", "edit")
  if (guard.response) return guard.response

  const { id } = await params
  if (!await canAccessOwnedRecord(guard.permissions.snapshot, "installatori", "installatori", "proprietario_id", id)) return NextResponse.json({ error: "Installatore non trovato" }, { status: 404 })
  const patch = (await request.json()) as Partial<InstallatoreInput>
  const deniedField = nonEditablePatchField(guard.permissions, "installatori", patch as Record<string, unknown>, INSTALLATORI_PATCH_FIELD_MAP)
  if (deniedField) return NextResponse.json({ error: `Campo non modificabile: ${deniedField}` }, { status: 403 })
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
  if (!await canAccessOwnedRecord(guard.permissions.snapshot, "installatori", "installatori", "proprietario_id", id)) return NextResponse.json({ error: "Installatore non trovato" }, { status: 404 })
  const removed = await deleteInstallatoreRecord(id)
  if (!removed) {
    return NextResponse.json({ error: "Installatore non trovato" }, { status: 404 })
  }
  return NextResponse.json({ removed: true })
}
