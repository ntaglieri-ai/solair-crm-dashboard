import { NextResponse } from "next/server"
import { getFullLeadById } from "@/lib/leads/repository"
import { requireApiRecord } from "@/lib/permissions/server"
import { contaDocumentiObbligatori } from "@/lib/allegati/documenti-obbligatori"

// Stato del gate dei tre documenti obbligatori per un lead (spec FASE 1.3).
// Serve alla UI per sapere se sbloccare "Converti a cliente" senza doversi
// ricalcolare il path Nextcloud lato client. Il controllo vero resta comunque
// in POST /api/leads/[id]/converti: questo endpoint e' solo informativo.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("lead", "view")
  if (guard.response) return guard.response

  const { id } = await params

  try {
    const lead = await getFullLeadById(id)
    if (!lead) {
      return NextResponse.json({ error: "Lead non trovato" }, { status: 404 })
    }

    const documenti = await contaDocumentiObbligatori(lead.id, lead["Nome Lead"] ?? "")
    if (!documenti.ok) {
      return NextResponse.json({ error: documenti.error }, { status: 502 })
    }

    // folderPath torna al client cosi' puo' passarlo a
    // /api/auth/nextcloud/open per il pulsante "Apri in Nextcloud".
    return NextResponse.json(
      {
        count: documenti.count,
        richiesti: documenti.richiesti,
        completo: documenti.completo,
        folderPath: documenti.folderPath,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error(`[documenti-obbligatori] lettura lead ${id} fallita:`, error)
    return NextResponse.json(
      { error: "Errore nella verifica dei documenti obbligatori" },
      { status: 500 },
    )
  }
}
