import { NextResponse } from "next/server"

import { normalizeNcPath } from "@/lib/nextcloud/path-permissions"
import { listFolder } from "@/lib/nextcloud/webdav"
import { requireApiAction } from "@/lib/permissions/server"
import { accessoAI } from "@/lib/solair-ai/nextcloud"

export const dynamic = "force-dynamic"

/**
 * Albero Nextcloud per il selettore di cartella della configurazione SolairAI.
 *
 * Apre Nextcloud con lo STESSO account che usa SolairAI quando legge davvero i
 * documenti (accessoAI -> commercialNextcloudUser), non con l'account admin:
 * cosi' l'elenco mostrato qui e' esattamente l'insieme di cartelle che poi
 * l'assistente riuscira' ad aprire. Sfogliare con l'admin farebbe scegliere
 * cartelle che a runtime risultano vuote.
 *
 * Un livello per chiamata, come gli altri browser cartelle del CRM.
 */
export async function GET(request: Request) {
  // Stessa chiave della PUT di configurazione e di solair_ai_can_configure():
  // sfogliare serve solo a chi puo' salvare il percorso.
  const guard = await requireApiAction("crm_settings.system.schema.manage")
  if (guard.response) return guard.response

  const path = normalizeNcPath(new URL(request.url).searchParams.get("path") ?? "").replace(
    /\/+$/,
    "",
  )
  if (path.split("/").some((segmento) => segmento === "." || segmento === "..")) {
    return NextResponse.json({ error: "Percorso non valido" }, { status: 400 })
  }

  try {
    const accesso = await accessoAI(guard.permissions.snapshot.subject)
    const voci = await listFolder(accesso.username, accesso.appPassword, path)
    const cartelle = voci
      .filter((voce) => voce.isDir)
      .map((voce) => ({ nome: voce.name, path: voce.path }))
      .sort((a, b) => a.nome.localeCompare(b.nome))

    return NextResponse.json(
      { path, cartelle },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    )
  } catch (errore) {
    const messaggio =
      errore instanceof Error ? errore.message : "Lettura cartella non riuscita."
    console.error("[crm-settings/solair-ai/browse]", messaggio)
    return NextResponse.json({ error: messaggio }, { status: 502 })
  }
}
