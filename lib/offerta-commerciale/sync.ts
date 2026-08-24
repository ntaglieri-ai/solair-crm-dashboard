import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { estraiTestoDaPdf } from "@/lib/listino/pdf-testo"
import {
  downloadAdminFile,
  ensureFolder as ensureFolderAdmin,
  listFolder as listFolderAdmin,
} from "@/lib/nextcloud/admin-webdav"
import {
  downloadFile as downloadFileUtente,
  ensureFolder as ensureFolderUtente,
  listFolder as listFolderUtente,
} from "@/lib/nextcloud/webdav"
import { parseListinoCommerciale } from "@/lib/offerta-commerciale/parse-listino"
import { OFFERTA_COMMERCIALE_ROOT } from "@/lib/offerta-commerciale/store"

/**
 * Sincronizzazione del catalogo commerciale da Nextcloud.
 *
 * Stava dentro l'handler di /api/offerta-commerciale/sync. E' uscita di li'
 * perche' serve a due chiamanti con credenziali diverse: la route usa
 * l'app-password personale di chi ha premuto il pulsante, il server MCP le
 * credenziali admin — una sessione browser li' non esiste. Le credenziali
 * entrano quindi da un parametro, e la logica resta una sola.
 *
 * Verificato il 24/08/2026 che le due viste coincidono: i percorsi registrati
 * da un sync fatto con le credenziali personali rispondono identici anche
 * all'account admin.
 */

/** Voce di cartella, nella forma minima che serve al sync. */
export type VoceNextcloud = {
  path: string
  name: string
  isDir: boolean
  /** Byte, non KB: il fingerprint ci si appoggia. */
  size: number | null
  lastModified: string | null
}

/** Il poco di Nextcloud che al sync serve, senza sapere di chi sono le chiavi. */
export type AccessoNextcloud = {
  ensureFolder(path: string): Promise<void>
  listFolder(path: string): Promise<VoceNextcloud[]>
  downloadFile(path: string): Promise<Uint8Array>
}

export function accessoNextcloudUtente(username: string, appPassword: string): AccessoNextcloud {
  return {
    ensureFolder: (path) => ensureFolderUtente(username, appPassword, path),
    listFolder: async (path) =>
      (await listFolderUtente(username, appPassword, path)).map((voce) => ({
        path: voce.path,
        name: voce.name,
        isDir: voce.isDir,
        size: voce.size,
        lastModified: voce.lastModified,
      })),
    downloadFile: async (path) =>
      new Uint8Array(await (await downloadFileUtente(username, appPassword, path)).arrayBuffer()),
  }
}

export function accessoNextcloudAdmin(): AccessoNextcloud {
  return {
    ensureFolder: async (path) => {
      const esito = await ensureFolderAdmin(path)
      if (!esito.ok) throw new Error(esito.error ?? `Creazione cartella fallita (HTTP ${esito.status})`)
    },
    listFolder: async (path) => {
      const esito = await listFolderAdmin(path)
      if (!esito.ok) throw new Error(esito.error ?? `Lettura cartella fallita (HTTP ${esito.status})`)
      return esito.items.map((voce) => ({
        path: voce.path,
        name: voce.nome,
        isDir: voce.isFolder,
        size: voce.byte,
        lastModified: voce.modificato,
      }))
    },
    downloadFile: async (path) =>
      new Uint8Array(await (await downloadAdminFile(path)).arrayBuffer()),
  }
}

export type EsitoSync = {
  files: number
  offerte: number
  published: number
  bozze: number
  root: string
}

const DOCUMENT_EXTENSIONS = /\.(pdf|png|jpe?g|webp)$/i
const COVER_EXTENSIONS = /\.(png|jpe?g|webp)$/i

function fingerprint(item: VoceNextcloud) {
  return `size-mtime:${item.size ?? "?"}-${item.lastModified ?? "?"}`
}

function withoutExtension(name: string) {
  return name.replace(/\.[^.]+$/, "").trim()
}

async function walk(accesso: AccessoNextcloud, path: string, depth = 0): Promise<VoceNextcloud[]> {
  if (depth > 4) return []
  const listing = await accesso.listFolder(path)
  const nested = await Promise.all(
    listing.filter((item) => item.isDir).map((item) => walk(accesso, item.path, depth + 1)),
  )
  return [...listing.filter((item) => !item.isDir), ...nested.flat()]
}

function uniqueFilesByPath(files: VoceNextcloud[]) {
  // Alcune installazioni Nextcloud includono lo stesso file sia nella
  // risposta della cartella sia in quella ricorsiva. PostgreSQL non consente
  // che un singolo UPSERT aggiorni due volte la stessa chiave `path`.
  return [...new Map(files.map((file) => [file.path, file])).values()]
}

/**
 * @param pubblicaListini se true (comportamento storico della route) ogni
 * listino nuovo viene pubblicato subito, sostituendo quello attivo. Il server
 * MCP passa false: una sincronizzazione non deve poter cambiare da sola i
 * prezzi che il configuratore mostra ai visitatori. Le bozze restano pronte e
 * si pubblicano con un'azione esplicita.
 */
export async function sincronizzaOffertaCommerciale(
  supabase: SupabaseClient,
  accesso: AccessoNextcloud,
  { pubblicaListini = true }: { pubblicaListini?: boolean } = {},
): Promise<EsitoSync> {
  for (const folder of ["Listini", "Offerte-del-periodo", "Schede-tecniche"]) {
    await accesso.ensureFolder(`${OFFERTA_COMMERCIALE_ROOT}/${folder}`)
  }

  const files = uniqueFilesByPath(
    (await walk(accesso, OFFERTA_COMMERCIALE_ROOT)).filter((file) => DOCUMENT_EXTENSIONS.test(file.name)),
  )
  const now = new Date().toISOString()

  const documents = files.map((file) => {
    const path = file.path.toLowerCase()
    const tipo = path.includes("offerte-del-periodo")
      ? COVER_EXTENSIONS.test(file.name)
        ? "copertina"
        : "locandina"
      : path.includes("listin")
        ? "listino"
        : "altro"
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
    const { error } = await supabase
      .from("offerta_commerciale_documenti")
      .upsert(documents, { onConflict: "path" })
    if (error) throw new Error(error.message)
  }

  const listini = files
    .filter((file) => file.path.toLowerCase().includes("listin") && file.name.toLowerCase().endsWith(".pdf"))
    // Se Nextcloud contiene piu file nuovi, si pubblicano in ordine
    // cronologico: al termine resta attivo quello piu recente.
    .sort((a, b) => (a.lastModified ?? "").localeCompare(b.lastModified ?? ""))

  let publishedCount = 0
  let bozzeCount = 0
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

    const bytes = await accesso.downloadFile(file.path)
    const testo = await estraiTestoDaPdf(bytes)
    if (!testo) throw new Error(`Listino non elaborato: ${file.name} non contiene testo estraibile`)
    const parsed = parseListinoCommerciale(testo)
    const importNote = `Importazione automatica completata: ${parsed.parsedBase} prezzi FV e ${parsed.parsedBattery} prezzi espliciti elaborati.`

    const { data: currentPublished, error: currentError } = await supabase
      .from("offerta_commerciale_cataloghi")
      .select("codici_sconto, specifiche_prodotto")
      .eq("stato", "pubblicato")
      .order("aggiornato_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (currentError) throw new Error(currentError.message)

    const catalogValues = {
      nome: withoutExtension(file.name),
      stato: "bozza",
      fonte_path: file.path,
      fonte_fingerprint: sourceFingerprint,
      fotovoltaico: parsed.fotovoltaico,
      accumuli: parsed.accumuli,
      accessori: parsed.accessori,
      sconti: parsed.sconti,
      // Codici sconto e specifiche prodotto non stanno nel PDF: si ereditano
      // dal listino attivo, altrimenti ogni importazione li azzererebbe.
      codici_sconto: currentPublished?.codici_sconto ?? [],
      specifiche_prodotto: currentPublished?.specifiche_prodotto ?? {},
      note: `${parsed.note}\n${importNote}`.trim(),
      aggiornato_at: now,
    }
    const catalogQuery = existing
      ? supabase.from("offerta_commerciale_cataloghi").update(catalogValues).eq("id", existing.id)
      : supabase.from("offerta_commerciale_cataloghi").insert(catalogValues)
    const { data: inserted, error } = await catalogQuery.select("id").single()
    if (error) throw new Error(error.message)

    if (!pubblicaListini) {
      bozzeCount++
      continue
    }
    const { error: publishError } = await supabase.rpc("pubblica_catalogo_offerta_commerciale", {
      p_id: (inserted as { id: string }).id,
    })
    if (publishError) throw new Error(`Listino elaborato ma non pubblicato: ${publishError.message}`)
    publishedCount++
  }

  const offerFiles = files.filter((file) => file.path.toLowerCase().includes("offerte-del-periodo"))
  const covers = new Map(
    offerFiles
      .filter((file) => COVER_EXTENSIONS.test(file.name))
      .map((file) => [withoutExtension(file.name).toLowerCase(), file.path]),
  )
  const offers = await Promise.all(
    offerFiles
      .filter((file) => file.name.toLowerCase().endsWith(".pdf"))
      .map(async (file, index) => {
        const sourceFingerprint = fingerprint(file)
        let extractedText: string | null = null
        try {
          extractedText = await estraiTestoDaPdf(await accesso.downloadFile(file.path))
        } catch (error) {
          console.warn(`[offerta-commerciale/sync] testo non estratto da ${file.path}`, error)
        }
        return {
          titolo: withoutExtension(file.name),
          tipo: "locandina",
          pdf_path: file.path,
          cover_path: covers.get(withoutExtension(file.name).toLowerCase()) ?? null,
          ...(extractedText
            ? { testo_estratto: extractedText, testo_fingerprint: sourceFingerprint, testo_estratto_at: now }
            : {}),
          ordinamento: index,
          aggiornato_at: now,
        }
      }),
  )
  if (offers.length) {
    const { error } = await supabase
      .from("offerta_commerciale_offerte")
      .upsert(offers, { onConflict: "pdf_path", ignoreDuplicates: false })
    if (error) throw new Error(error.message)
  }

  return {
    files: documents.length,
    offerte: offers.length,
    published: publishedCount,
    bozze: bozzeCount,
    root: OFFERTA_COMMERCIALE_ROOT,
  }
}
