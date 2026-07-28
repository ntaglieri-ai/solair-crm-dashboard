import { NextResponse } from "next/server"
import { requireApiAction } from "@/lib/permissions/server"
import { deleteBachecaMessaggio } from "@/lib/bacheca/repository"
import { BACHECA_MANAGE_ACTION } from "@/lib/bacheca/types"

/**
 * Elimina un annuncio qualunque, indipendentemente da chi l'ha creato: la
 * bacheca e' aziendale, non personale, quindi non si filtra su creato_da.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiAction(BACHECA_MANAGE_ACTION)
  if (guard.response) return guard.response

  const { id } = await params
  if (!id) return NextResponse.json({ error: "Id mancante" }, { status: 400 })

  try {
    await deleteBachecaMessaggio(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore imprevisto"
    console.error("[bacheca] eliminazione annuncio fallita:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
