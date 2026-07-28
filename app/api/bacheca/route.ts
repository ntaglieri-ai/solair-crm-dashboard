import { NextResponse } from "next/server"
import { getCurrentPermissions, requireApiAction } from "@/lib/permissions/server"
import { createBachecaMessaggio, listBachecaMessaggi } from "@/lib/bacheca/repository"
import { BACHECA_MANAGE_ACTION, isBachecaLivello } from "@/lib/bacheca/types"

const MAX_TITOLO = 120
const MAX_TESTO = 1000

/** Elenco annunci: visibile a chiunque sia autenticato (RLS: select true). */
export async function GET() {
  const permissions = await getCurrentPermissions()
  if (!permissions.snapshot.subject.userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 })
  }

  try {
    const items = await listBachecaMessaggi()
    return NextResponse.json({ items })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore imprevisto"
    console.error("[bacheca] lettura annunci fallita:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Creazione annuncio: Director+ via chiave permessi_ui (le policy RLS ripetono
 *  lo stesso controllo lato DB, questo serve a rispondere 403 invece di 500). */
export async function POST(request: Request) {
  const guard = await requireApiAction(BACHECA_MANAGE_ACTION)
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as {
    titolo?: unknown
    testo?: unknown
    livello?: unknown
    pin?: unknown
  } | null

  const titolo = typeof body?.titolo === "string" ? body.titolo.trim() : ""
  const testo = typeof body?.testo === "string" ? body.testo.trim() : ""
  const livello = body?.livello ?? "info"
  const pin = body?.pin === true

  if (!titolo || !testo) {
    return NextResponse.json({ error: "Titolo e testo sono obbligatori" }, { status: 400 })
  }
  if (titolo.length > MAX_TITOLO || testo.length > MAX_TESTO) {
    return NextResponse.json({ error: "Titolo o testo troppo lunghi" }, { status: 400 })
  }
  if (!isBachecaLivello(livello)) {
    return NextResponse.json({ error: "Livello non valido" }, { status: 400 })
  }

  try {
    const item = await createBachecaMessaggio({
      titolo,
      testo,
      livello,
      pin,
      creatoDa: guard.permissions.snapshot.subject.userId,
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore imprevisto"
    console.error("[bacheca] creazione annuncio fallita:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
