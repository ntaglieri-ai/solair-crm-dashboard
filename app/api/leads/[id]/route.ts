import { NextResponse, after } from "next/server"
import type { Lead } from "@/lib/mock-data"
import { updateLeadRecord, deleteLeadRecords } from "@/lib/leads/repository"
import { requireApiRecord } from "@/lib/permissions/server"
import { canAccessOwnedRecord } from "@/lib/permissions/data-scope"
import { createClient } from "@/lib/supabase/server"
import { attoreDaPermessi, logAudit } from "@/lib/audit/log"
import { campiModificati, descriviModifica, diffCampi, etichettaRecord } from "@/lib/audit/describe"
import { LEAD_PATCH_FIELD_MAP, nonEditablePatchField } from "@/lib/permissions/patch-fields"
import {
  buildLeadUpdateActivityText,
  insertLeadUpdateActivity,
} from "@/lib/leads/update-activity-log"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("lead", "edit")
  if (guard.response) return guard.response

  const { id } = await params
  if (!await canAccessOwnedRecord(guard.permissions.snapshot, "lead", "leads", "lead_proprietario_id", id)) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 })
  const patch = (await request.json()) as Partial<Lead>
  const deniedField = nonEditablePatchField(guard.permissions, "lead", patch as Record<string, unknown>, LEAD_PATCH_FIELD_MAP)
  if (deniedField) return NextResponse.json({ error: `Campo non modificabile: ${deniedField}` }, { status: 403 })
  const updated = await updateLeadRecord(id, patch)
  if (!updated) {
    return NextResponse.json({ error: "Lead non trovato" }, { status: 404 })
  }

  // Non si rilegge il lead prima di scrivere: sarebbe una query in piu' su un
  // percorso caldo (ogni cambio di stato dalla kanban passa di qui). La patch
  // e' gia' il delta inviato dal client, quindi basta a dire cosa e' cambiato.
  const campi = campiModificati(null, patch as Record<string, unknown>)
  const attore = attoreDaPermessi(guard.permissions)
  const supabase = await createClient()
  after(async () => {
    await logAudit({
      tipo_evento: "modifica_record",
      attore,
      modulo: "lead",
      record_id: id,
      descrizione: descriviModifica(
        "Lead",
        etichettaRecord(updated as unknown as Record<string, unknown>, ["Nome Lead"]),
        campi,
      ),
      dati_dopo: diffCampi(patch as Record<string, unknown>, campi),
      request,
    })
    await insertLeadUpdateActivity(supabase, {
      leadId: id,
      userId: attore.id,
      text: buildLeadUpdateActivityText({
        source: "manuale",
        sourceDetail: attore.nome
          ? `Modifica manuale eseguita da ${attore.nome}`
          : "Modifica manuale dal CRM",
        reason: "modifica_campi",
        changedFields: [...campi, "Ora ultima attivita'"],
      }),
      logPrefix: "[api/leads] attivita modifica",
    })
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("lead", "delete")
  if (guard.response) return guard.response

  const { id } = await params
  if (!await canAccessOwnedRecord(guard.permissions.snapshot, "lead", "leads", "lead_proprietario_id", id)) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 })
  const removed = await deleteLeadRecords([id])
  if (removed === 0) {
    return NextResponse.json({ error: "Lead non trovato" }, { status: 404 })
  }

  after(() =>
    logAudit({
      tipo_evento: "eliminazione",
      attore: attoreDaPermessi(guard.permissions),
      modulo: "lead",
      record_id: id,
      descrizione: `Lead ${id} eliminato`,
      request,
    }),
  )

  return NextResponse.json({ removed })
}
