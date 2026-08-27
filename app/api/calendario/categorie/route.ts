import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentPermissions, requireApiPage } from "@/lib/permissions/server"
import { getCategorie } from "@/lib/calendario/repository"
import {
  CALENDARIO_CATEGORIE_KEY,
  isColoreValido,
  puoGestireCategorie,
  slugCategoria,
  type CategoriaCalendario,
} from "@/lib/calendario/types"

/**
 * Lettura aperta a chiunque abbia la pagina Calendario: senza le
 * categorie il calendario non e' disegnabile. La route generica
 * /api/crm-settings/system/[key] non va bene qui, perche' richiede
 * l'azione di gestione anche in GET.
 */
export async function GET() {
  const guard = await requireApiPage("calendario")
  if (guard.response) return guard.response
  return NextResponse.json({ categorie: await getCategorie() })
}

export async function PUT(request: Request) {
  const permissions = await getCurrentPermissions()
  if (!puoGestireCategorie(permissions.snapshot.subject.ruoloCode)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as {
    categorie?: unknown
  } | null
  if (!Array.isArray(body?.categorie)) {
    return NextResponse.json({ error: "Payload non valido" }, { status: 400 })
  }

  const viste = new Set<string>()
  const categorie: CategoriaCalendario[] = []
  for (const raw of body.categorie) {
    if (!raw || typeof raw !== "object") continue
    const voce = raw as Record<string, unknown>
    const nome = typeof voce.nome === "string" ? voce.nome.trim() : ""
    if (!nome) continue
    // L'id arriva dal client per le categorie esistenti (e' il valore
    // gia' scritto in eventi_calendario.categoria_id: rigenerarlo
    // orfanerebbe gli eventi). Per le nuove si deriva dal nome.
    const id = typeof voce.id === "string" && voce.id.trim() ? voce.id.trim() : slugCategoria(nome)
    if (viste.has(id)) continue
    viste.add(id)
    if (!isColoreValido(voce.colore)) {
      return NextResponse.json(
        { error: `Colore non valido per la categoria "${nome}"` },
        { status: 400 },
      )
    }
    categorie.push({ id, nome, colore: voce.colore.toLowerCase() })
  }

  if (categorie.length === 0) {
    return NextResponse.json(
      { error: "Serve almeno una categoria." },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.from("crm_settings").upsert(
    {
      chiave: CALENDARIO_CATEGORIE_KEY,
      valore: categorie,
      descrizione:
        "Categorie del modulo Calendario: nome e colore di default. Gestibile da SUPERADMIN/ADMIN.",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chiave" },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ categorie })
}
