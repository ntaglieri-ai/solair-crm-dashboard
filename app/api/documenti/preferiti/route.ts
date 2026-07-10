import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiPage } from "@/lib/permissions/server"
import { loadCurrentPermissionSnapshot } from "@/lib/permissions/load-permissions"
import { canAccessNcPath, normalizeNcPath } from "@/lib/nextcloud/path-permissions"

// Cartelle preferite per-utente. La visibilita' path-based e' enforced
// server-side: un utente non puo' salvare (ne' quindi vedere) un preferito
// verso un path a cui il suo ruolo non ha accesso.

export async function GET() {
  const guard = await requireApiPage("documenti")
  if (guard.response) return guard.response

  const snapshot = await loadCurrentPermissionSnapshot()
  const utenteId = snapshot.subject.userId
  if (!utenteId) return NextResponse.json({ preferiti: [] })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cartelle_preferite")
    .select("id, label, path")
    .eq("utente_id", utenteId)
    .order("label")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const preferiti = (data ?? []).filter((f) =>
    canAccessNcPath(f.path as string, snapshot.subject.ruoloCode),
  )
  return NextResponse.json({ preferiti })
}

export async function POST(request: Request) {
  const guard = await requireApiPage("documenti")
  if (guard.response) return guard.response

  const snapshot = await loadCurrentPermissionSnapshot()
  const utenteId = snapshot.subject.userId
  if (!utenteId) return NextResponse.json({ error: "Utente non risolto" }, { status: 400 })

  const body = (await request.json().catch(() => null)) as {
    path?: string
    label?: string
  } | null
  const path = normalizeNcPath(body?.path?.trim() ?? "")
  const label = body?.label?.trim() || path.split("/").pop() || path
  if (!path) return NextResponse.json({ error: "Path mancante" }, { status: 400 })

  // Non permettere di salvare preferiti verso path non consentiti al ruolo.
  if (!canAccessNcPath(path, snapshot.subject.ruoloCode)) {
    return NextResponse.json({ error: "Accesso al percorso non consentito" }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cartelle_preferite")
    .upsert({ utente_id: utenteId, path, label }, { onConflict: "utente_id,path" })
    .select("id, label, path")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ preferito: data }, { status: 201 })
}

export async function DELETE(request: Request) {
  const guard = await requireApiPage("documenti")
  if (guard.response) return guard.response

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id mancante" }, { status: 400 })

  const supabase = await createClient()
  // RLS garantisce che si possano eliminare solo i propri preferiti.
  const { error } = await supabase.from("cartelle_preferite").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
