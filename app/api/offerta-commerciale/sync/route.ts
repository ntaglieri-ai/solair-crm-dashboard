import { NextResponse } from "next/server"
import { requireApiAction } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { downloadFile, ensureFolder, listFolder, type WebDavItem } from "@/lib/nextcloud/admin-webdav"
import { normalizeAccumuli, normalizeFotovoltaico, OFFERTA_COMMERCIALE_ROOT } from "@/lib/offerta-commerciale/store"
import { estraiTestoDaPdf } from "@/lib/listino/pdf-testo"
import { parseListinoCommerciale } from "@/lib/offerta-commerciale/parse-listino"

const DOCUMENT_EXTENSIONS = /\.(pdf|png|jpe?g|webp)$/i
const COVER_EXTENSIONS = /\.(png|jpe?g|webp)$/i

function fingerprint(item: WebDavItem) {
  return item.etag ? `etag:${item.etag}` : `size-mtime:${item.dimensioneKb ?? "?"}-${item.modificato ?? "?"}`
}

function withoutExtension(name: string) {
  return name.replace(/\.[^.]+$/, "").trim()
}

async function walk(path: string, depth = 0): Promise<WebDavItem[]> {
  if (depth > 4) return []
  const listing = await listFolder(path)
  if (!listing.ok) throw new Error(`${path}: ${listing.error ?? `HTTP ${listing.status}`}`)
  const nested = await Promise.all(
    listing.items.filter((item) => item.isFolder).map((item) => walk(item.path, depth + 1)),
  )
  return [...listing.items.filter((item) => !item.isFolder), ...nested.flat()]
}

export async function POST() {
  const guard = await requireApiAction("offerta_commerciale.manage")
  if (guard.response) return guard.response
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Supabase admin non configurato" }, { status: 503 })
  try {
    for (const folder of ["Listini", "Offerte-del-periodo", "Schede-tecniche"]) {
      const ensured = await ensureFolder(`${OFFERTA_COMMERCIALE_ROOT}/${folder}`)
      if (!ensured.ok) throw new Error(`Creazione cartella ${folder}: ${ensured.error ?? `HTTP ${ensured.status}`}`)
    }
    const files = (await walk(OFFERTA_COMMERCIALE_ROOT)).filter((file) => DOCUMENT_EXTENSIONS.test(file.nome))
    const now = new Date().toISOString()
    const documents = files.map((file) => {
      const path = file.path.toLowerCase()
      const tipo = path.includes("offerte-del-periodo")
        ? (COVER_EXTENSIONS.test(file.nome) ? "copertina" : "locandina")
        : path.includes("listin") ? "listino" : "altro"
      return {
        path: file.path,
        nome: file.nome,
        tipo,
        fingerprint: fingerprint(file),
        dimensione_kb: file.dimensioneKb,
        modificato_at: file.modificato,
        sincronizzato_at: now,
      }
    })
    if (documents.length) {
      const { error } = await supabase.from("offerta_commerciale_documenti").upsert(documents, { onConflict: "path" })
      if (error) throw new Error(error.message)
    }

    const listini = files
      .filter((file) => file.path.toLowerCase().includes("listin") && file.nome.toLowerCase().endsWith(".pdf"))
      .sort((a, b) => (b.modificato ?? "").localeCompare(a.modificato ?? ""))
    let drafts = 0
    for (const file of listini) {
      const { data: existing } = await supabase.from("offerta_commerciale_cataloghi").select("id").eq("fonte_path", file.path).maybeSingle()
      if (existing) continue
      const { data: published } = await supabase.from("offerta_commerciale_cataloghi").select("fotovoltaico, accumuli, accessori, sconti, note").eq("stato", "pubblicato").maybeSingle()
      let fotovoltaico = published?.fotovoltaico ?? []
      let accumuli = published?.accumuli ?? []
      let parseNote = "Documento rilevato da Nextcloud. Verificare i prezzi prima della pubblicazione."
      const downloaded = await downloadFile(file.path)
      if (downloaded.ok && downloaded.body && published) {
        const bytes = new Uint8Array(await new Response(downloaded.body).arrayBuffer())
        const testo = await estraiTestoDaPdf(bytes)
        if (testo) {
          const parsed = parseListinoCommerciale(testo, {
            fotovoltaico: normalizeFotovoltaico(published.fotovoltaico),
            accumuli: normalizeAccumuli(published.accumuli),
          })
          fotovoltaico = parsed.fotovoltaico
          accumuli = parsed.accumuli
          parseNote = `Import automatico: ${parsed.parsedBase} prezzi FV e ${parsed.parsedBattery} combinazioni aggiornate. Verificare prima della pubblicazione.`
        }
      }
      const { error } = await supabase.from("offerta_commerciale_cataloghi").insert({
        nome: withoutExtension(file.nome),
        stato: "bozza",
        fonte_path: file.path,
        fonte_fingerprint: fingerprint(file),
        fotovoltaico,
        accumuli,
        accessori: published?.accessori ?? [],
        sconti: published?.sconti ?? [],
        note: `${published?.note ?? ""}\n${parseNote}`.trim(),
        aggiornato_at: now,
      })
      if (error) throw new Error(error.message)
      drafts++
    }

    const offerFiles = files.filter((file) => file.path.toLowerCase().includes("offerte-del-periodo"))
    const covers = new Map(
      offerFiles.filter((file) => COVER_EXTENSIONS.test(file.nome)).map((file) => [withoutExtension(file.nome).toLowerCase(), file.path]),
    )
    const offers = offerFiles.filter((file) => file.nome.toLowerCase().endsWith(".pdf")).map((file, index) => ({
      titolo: withoutExtension(file.nome),
      pdf_path: file.path,
      cover_path: covers.get(withoutExtension(file.nome).toLowerCase()) ?? null,
      ordinamento: index,
      aggiornato_at: now,
    }))
    if (offers.length) {
      const { error } = await supabase.from("offerta_commerciale_offerte").upsert(offers, { onConflict: "pdf_path", ignoreDuplicates: false })
      if (error) throw new Error(error.message)
    }
    return NextResponse.json({ files: documents.length, offerte: offers.length, drafts, root: OFFERTA_COMMERCIALE_ROOT })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sincronizzazione Nextcloud fallita"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
