import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiPage } from "@/lib/permissions/server"
import { loadCurrentPermissionSnapshot } from "@/lib/permissions/load-permissions"
import { canAccessNcPath, loadNcPathRules, normalizeNcPath } from "@/lib/nextcloud/path-permissions"
import { getNextcloudAppPassword, getNextcloudUsername } from "@/lib/nextcloud/credentials"
import { nextcloudUsernameFromEmail } from "@/lib/nextcloud/config"
import { setFavorite } from "@/lib/nextcloud/webdav"

// Cartelle preferite per-utente. La visibilita' path-based e' enforced
// server-side: un utente non puo' salvare (ne' quindi vedere) un preferito
// verso un path a cui il suo ruolo non ha accesso.
//
// Ogni preferito e' anche sincronizzato con la stella nativa Nextcloud
// (oc:favorite): aggiungere/rimuovere qui riflette lo stato su Nextcloud, e i
// preferiti creati direttamente in Nextcloud vengono re-importati al load
// (vedi lib/nextcloud/documenti.ts).

/**
 * Riflette lo stato di preferito sulla stella nativa Nextcloud (oc:favorite).
 * Best-effort: la riga cartelle_preferite resta la source of truth, quindi un
 * errore WebDAV viene loggato ma non fa fallire l'operazione CRM.
 */
async function syncNcFavorite(
  utenteId: string,
  email: string,
  path: string,
  favorite: boolean,
): Promise<void> {
  const appPassword = await getNextcloudAppPassword(utenteId)
  if (!appPassword) return
  const username = (await getNextcloudUsername(utenteId)) ?? nextcloudUsernameFromEmail(email)
  try {
    await setFavorite(username, appPassword, path, favorite)
  } catch (e) {
    console.error("[nextcloud] sync oc:favorite fallito:", e)
  }
}

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

  const pathRules = await loadNcPathRules()
  const preferiti = (data ?? []).filter((f) =>
    canAccessNcPath(f.path as string, snapshot.subject.ruoloCode, pathRules),
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
  const pathRules = await loadNcPathRules()
  if (!canAccessNcPath(path, snapshot.subject.ruoloCode, pathRules)) {
    return NextResponse.json({ error: "Accesso al percorso non consentito" }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cartelle_preferite")
    .upsert({ utente_id: utenteId, path, label }, { onConflict: "utente_id,path" })
    .select("id, label, path")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Marca anche la stella nativa Nextcloud, cosi' il preferito CRM e quello NC
  // restano allineati.
  if (snapshot.subject.email) {
    await syncNcFavorite(utenteId, snapshot.subject.email, path, true)
  }

  return NextResponse.json({ preferito: data }, { status: 201 })
}

export async function DELETE(request: Request) {
  const guard = await requireApiPage("documenti")
  if (guard.response) return guard.response

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id mancante" }, { status: 400 })

  const snapshot = await loadCurrentPermissionSnapshot()
  const utenteId = snapshot.subject.userId

  const supabase = await createClient()
  // Serve il path PRIMA della delete per poter smarcare la stella NC.
  const { data: row } = await supabase
    .from("cartelle_preferite")
    .select("path")
    .eq("id", id)
    .maybeSingle()

  // RLS garantisce che si possano eliminare solo i propri preferiti.
  const { error } = await supabase.from("cartelle_preferite").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Smarca anche la stella nativa Nextcloud (oc:favorite=0).
  if (row?.path && utenteId && snapshot.subject.email) {
    await syncNcFavorite(utenteId, snapshot.subject.email, row.path as string, false)
  }

  return NextResponse.json({ ok: true })
}
