import { NextResponse } from "next/server"
import { requireApiAction } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { downloadFile, ensureFolder, listFolder, type NcEntry } from "@/lib/nextcloud/webdav"
import { OFFERTA_COMMERCIALE_ROOT } from "@/lib/offerta-commerciale/store"
import { estraiTestoDaPdf } from "@/lib/listino/pdf-testo"
import { parseListinoCommerciale } from "@/lib/offerta-commerciale/parse-listino"
import { commercialNextcloudUser } from "@/lib/offerta-commerciale/nextcloud-user"

const DOCUMENT_EXTENSIONS = /\.(pdf|png|jpe?g|webp)$/i
const COVER_EXTENSIONS = /\.(png|jpe?g|webp)$/i

function fingerprint(item: NcEntry) {
  return `size-mtime:${item.size ?? "?"}-${item.lastModified ?? "?"}`
}

function withoutExtension(name: string) {
  return name.replace(/\.[^.]+$/, "").trim()
}

async function walk(username: string, appPassword: string, path: string, depth = 0): Promise<NcEntry[]> {
  if (depth > 4) return []
  const listing = await listFolder(username, appPassword, path)
  const nested = await Promise.all(
    listing.filter((item) => item.isDir).map((item) => walk(username, appPassword, item.path, depth + 1)),
  )
  return [...listing.filter((item) => !item.isDir), ...nested.flat()]
}

function uniqueFilesByPath(files: NcEntry[]) {
  // Alcune installazioni Nextcloud includono lo stesso file sia nella
  // risposta della cartella sia in quella ricorsiva. PostgreSQL non consente
  // che un singolo UPSERT aggiorni due volte la stessa chiave `path`.
  return [...new Map(files.map((file) => [file.path, file])).values()]
}

export async function POST() {
  const guard = await requireApiAction("offerta_commerciale.manage")
  if (guard.response) return guard.response
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Supabase admin non configurato" }, { status: 503 })
  try {
    const nextcloud = await commercialNextcloudUser(guard.permissions.snapshot.subject)
    for (const folder of ["Listini", "Offerte-del-periodo", "Schede-tecniche"]) {
      await ensureFolder(nextcloud.username, nextcloud.appPassword, `${OFFERTA_COMMERCIALE_ROOT}/${folder}`)
    }
    const files = uniqueFilesByPath(
      (await walk(nextcloud.username, nextcloud.appPassword, OFFERTA_COMMERCIALE_ROOT))
        .filter((file) => DOCUMENT_EXTENSIONS.test(file.name)),
    )
    const now = new Date().toISOString()
    const documents = files.map((file) => {
      const path = file.path.toLowerCase()
      const tipo = path.includes("offerte-del-periodo")
        ? (COVER_EXTENSIONS.test(file.name) ? "copertina" : "locandina")
        : path.includes("listin") ? "listino" : "altro"
      return {
        path: file.path,
        nome: file.name,
        tipo,
        fingerprint: fingerprint(file),
        dimensione_kb: file.size == null ? null : Math.round(file.size / 1024),
        modificato_at: file.lastModified,
        sincronizzato_at: now,
      }
    })
    if (documents.length) {
      const { error } = await supabase.from("offerta_commerciale_documenti").upsert(documents, { onConflict: "path" })
      if (error) throw new Error(error.message)
    }

    const listini = files
      .filter((file) => file.path.toLowerCase().includes("listin") && file.name.toLowerCase().endsWith(".pdf"))
      // Se Nextcloud contiene piu file nuovi, si pubblicano in ordine
      // cronologico: al termine resta attivo quello piu recente.
      .sort((a, b) => (a.lastModified ?? "").localeCompare(b.lastModified ?? ""))
    let publishedCount = 0
    for (const file of listini) {
      const sourceFingerprint = fingerprint(file)
      const { data: existing } = await supabase
        .from("offerta_commerciale_cataloghi")
        .select("id, stato")
        .eq("fonte_path", file.path)
        .eq("fonte_fingerprint", sourceFingerprint)
        .order("aggiornato_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (existing && existing.stato !== "bozza") continue
      const downloaded = await downloadFile(nextcloud.username, nextcloud.appPassword, file.path)
      const bytes = new Uint8Array(await downloaded.arrayBuffer())
      const testo = await estraiTestoDaPdf(bytes)
      if (!testo) throw new Error(`Listino non pubblicato: ${file.name} non contiene testo estraibile`)
      const parsed = parseListinoCommerciale(testo)
      const importNote = `Importazione automatica completata: ${parsed.parsedBase} prezzi FV e ${parsed.parsedBattery} prezzi espliciti elaborati.`
      const catalogValues = {
        nome: withoutExtension(file.name),
        stato: "bozza",
        fonte_path: file.path,
        fonte_fingerprint: sourceFingerprint,
        fotovoltaico: parsed.fotovoltaico,
        accumuli: parsed.accumuli,
        accessori: parsed.accessori,
        sconti: parsed.sconti,
        note: `${parsed.note}\n${importNote}`.trim(),
        aggiornato_at: now,
      }
      const catalogQuery = existing
        ? supabase.from("offerta_commerciale_cataloghi").update(catalogValues).eq("id", existing.id)
        : supabase.from("offerta_commerciale_cataloghi").insert(catalogValues)
      const { data: inserted, error } = await catalogQuery.select("id").single()
      if (error) throw new Error(error.message)
      const { error: publishError } = await supabase.rpc("pubblica_catalogo_offerta_commerciale", { p_id: inserted.id })
      if (publishError) throw new Error(`Listino elaborato ma non pubblicato: ${publishError.message}`)
      publishedCount++
    }

    const offerFiles = files.filter((file) => file.path.toLowerCase().includes("offerte-del-periodo"))
    const covers = new Map(
      offerFiles.filter((file) => COVER_EXTENSIONS.test(file.name)).map((file) => [withoutExtension(file.name).toLowerCase(), file.path]),
    )
    const offers = offerFiles.filter((file) => file.name.toLowerCase().endsWith(".pdf")).map((file, index) => ({
      titolo: withoutExtension(file.name),
      pdf_path: file.path,
      cover_path: covers.get(withoutExtension(file.name).toLowerCase()) ?? null,
      ordinamento: index,
      aggiornato_at: now,
    }))
    if (offers.length) {
      const { error } = await supabase.from("offerta_commerciale_offerte").upsert(offers, { onConflict: "pdf_path", ignoreDuplicates: false })
      if (error) throw new Error(error.message)
    }
    return NextResponse.json({ files: documents.length, offerte: offers.length, published: publishedCount, root: OFFERTA_COMMERCIALE_ROOT })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sincronizzazione Nextcloud fallita"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
