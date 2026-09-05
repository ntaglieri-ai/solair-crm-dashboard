import { NextResponse } from "next/server"
import {
  updateScadenzaRecord,
  deleteScadenzaRecord,
  type ScadenzaInput,
} from "@/lib/scadenze/repository"
import { requireApiRecord } from "@/lib/permissions/server"
import { canAccessOwnedRecord } from "@/lib/permissions/data-scope"
import { SCADENZE_PATCH_FIELD_MAP, nonEditablePatchField } from "@/lib/permissions/patch-fields"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("scadenze", "edit")
  if (guard.response) return guard.response

  const { id } = await params
  if (!await canAccessOwnedRecord(guard.permissions.snapshot, "scadenze", "scadenze", "proprietario_id", id)) return NextResponse.json({ error: "Scadenza non trovata" }, { status: 404 })
  const patch = (await request.json()) as Partial<ScadenzaInput>
  const deniedField = nonEditablePatchField(guard.permissions, "scadenze", patch as Record<string, unknown>, SCADENZE_PATCH_FIELD_MAP)
  if (deniedField) return NextResponse.json({ error: `Campo non modificabile: ${deniedField}` }, { status: 403 })
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
  if (!await canAccessOwnedRecord(guard.permissions.snapshot, "scadenze", "scadenze", "proprietario_id", id)) return NextResponse.json({ error: "Scadenza non trovata" }, { status: 404 })
  const removed = await deleteScadenzaRecord(id)
  if (!removed) {
    return NextResponse.json({ error: "Scadenza non trovata" }, { status: 404 })
  }
  return NextResponse.json({ removed: true })
}
