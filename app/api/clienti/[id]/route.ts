import { NextResponse, after } from "next/server"
import type { ClienteRecord } from "@/lib/mock-data"
import { updateClienteRecord, deleteClienteRecords } from "@/lib/clienti/repository"
import { requireApiRecord } from "@/lib/permissions/server"
import { canAccessOwnedRecord } from "@/lib/permissions/data-scope"
import { attoreDaPermessi, logAudit } from "@/lib/audit/log"
import { campiModificati, descriviModifica, diffCampi, etichettaRecord } from "@/lib/audit/describe"
import { CLIENTI_PATCH_FIELD_MAP, nonEditablePatchField } from "@/lib/permissions/patch-fields"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("clienti", "edit")
  if (guard.response) return guard.response

  const { id } = await params
  if (!await canAccessOwnedRecord(guard.permissions.snapshot, "clienti", "clienti", "clienti_proprietario_id", id)) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 })
  const patch = (await request.json()) as Partial<ClienteRecord>
  const deniedField = nonEditablePatchField(guard.permissions, "clienti", patch as Record<string, unknown>, CLIENTI_PATCH_FIELD_MAP)
  if (deniedField) return NextResponse.json({ error: `Campo non modificabile: ${deniedField}` }, { status: 403 })
  let saveError: string | null = null
  const updated = await updateClienteRecord(id, patch, (message) => {
    saveError = message
  })
  if (!updated) {
    // Due cause diverse dietro lo stesso "updated === null": distinguerle
    // qui, non solo internamente, e' il punto — prima erano entrambe un
    // 404 "Cliente non trovato" anche quando il cliente esisteva benissimo
    // e l'unico problema era un valore che Postgres rifiutava (es. una
    // data in formato non valido dal vecchio campo testo libero).
    if (saveError) {
      return NextResponse.json({ error: `Salvataggio non riuscito: ${saveError}` }, { status: 400 })
    }
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 })
  }

  const campi = campiModificati(null, patch as Record<string, unknown>)
  after(() =>
    logAudit({
      tipo_evento: "modifica_record",
      attore: attoreDaPermessi(guard.permissions),
      modulo: "cliente",
      record_id: id,
      descrizione: descriviModifica(
        "Cliente",
        etichettaRecord(updated as unknown as Record<string, unknown>, ["Nome Clienti"]),
        campi,
      ),
      dati_dopo: diffCampi(patch as Record<string, unknown>, campi),
      request,
    }),
  )

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("clienti", "delete")
  if (guard.response) return guard.response

  const { id } = await params
  if (!await canAccessOwnedRecord(guard.permissions.snapshot, "clienti", "clienti", "clienti_proprietario_id", id)) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 })
  const removed = await deleteClienteRecords([id])
  if (removed === 0) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 })
  }

  after(() =>
    logAudit({
      tipo_evento: "eliminazione",
      attore: attoreDaPermessi(guard.permissions),
      modulo: "cliente",
      record_id: id,
      descrizione: `Cliente ${id} eliminato`,
      request,
    }),
  )

  return NextResponse.json({ removed })
}
