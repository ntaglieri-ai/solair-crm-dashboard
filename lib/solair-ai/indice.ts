import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { downloadFile, listFolder } from "@/lib/nextcloud/webdav"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  estraiContenutoDaBuffer,
  extensionOf,
  MAX_FILE_INDEX_BYTES,
  mediaTypeFromName,
  normalizeMediaType,
} from "./estrazione-file"
import { accessoAI, type AccessoAI } from "./nextcloud"
import { ENTITA_AI, ENTITA_LABEL, isEntitaAI } from "./tipi"
import type { EntitaAI } from "./tipi"
import { leggiImpostazioneAI, leggiImpostazioniAI } from "./settings"
import {
  finishSolairAiSyncJob,
  finishSolairAiSyncJobFile,
  getQueuedSolairAiSyncJobFiles,
  getSolairAiSyncJob,
  insertSolairAiSyncJobFiles,
  leggiStatisticheFileJob,
  markSolairAiSyncJobFileRunning,
  resetStaleSolairAiSyncJobFiles,
  updateSolairAiSyncJob,
  type SolairAiJobProgress,
  type SolairAiSyncJobFile,
} from "./sync-job-store"

const MAX_CHUNK_CHARS = 1800
const MIN_TOKEN_LENGTH = 3

type FileIndicizzabile = {
  path: string
  nome: string
  dimensione: number | null
  modificatoIl: string | null
  contentType: string | null
  fileId: string | null
  fingerprint: string
}

type DocumentoIndicizzatoRow = {
  id: string
  entita: string
  path: string
  nome: string
  source_path: string
  fingerprint: string
  stato: string
  testo_chars: number
}

type ChunkRow = {
  id: string
  documento_id: string
  entita: EntitaAI
  path: string
  titolo: string
  contenuto: string
  keywords: string[]
}

type EsitoFileIndicizzato = {
  chunks: number
  stato: "ready" | "empty" | "unsupported" | "error"
  errore: string | null
}

export type SolairAiIndexStats = {
  entita: EntitaAI
  sourcePath: string
  active: boolean
  indexingActive: boolean
  files: number
  ready: number
  errors: number
  unsupported: number
  deleted: number
  chunks: number
  lastSyncAt: string | null
  lastSyncStatus: string | null
  lastSyncError: string | null
  lastSyncFiles: number
  schemaReady: boolean
}

export type SolairAiSyncResult = {
  entita: EntitaAI
  sourcePath: string
  scanned: number
  updated: number
  reused: number
  deleted: number
  chunks: number
  errors: string[]
  warnings: string[]
}

export type SolairAiCheckResult = {
  entita: EntitaAI
  sourcePath: string
  scanned: number
  daAggiornare: number
  invariati: number
  cancellati: number
  totaleBytes: number
  errors: string[]
  warnings: string[]
}

export type SolairAiKnowledgeSnippet = {
  entita: EntitaAI
  path: string
  titolo: string
  contenuto: string
  score: number
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function tokens(value: string) {
  return Array.from(
    new Set(
      normalize(value)
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= MIN_TOKEN_LENGTH),
    ),
  )
}

function fingerprintDi(voce: {
  etag: string | null
  size: number | null
  lastModified: string | null
}) {
  if (voce.etag) return `etag:${voce.etag}`
  return `size-mtime:${voce.size ?? "?"}-${voce.lastModified ?? "?"}`
}

function chunkText(testo: string) {
  const righe = testo
    .split(/\n{2,}|\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ""

  for (const riga of righe) {
    const next = current ? `${current}\n${riga}` : riga
    if (next.length > MAX_CHUNK_CHARS && current) {
      chunks.push(current)
      current = riga
    } else {
      current = next
    }
  }

  if (current) chunks.push(current)
  return chunks
}

async function scansionaFonte(
  accesso: AccessoAI,
  sourcePath: string,
): Promise<{ file: FileIndicizzabile[]; warnings: string[] }> {
  const visitate = new Set<string>()
  const coda = [sourcePath]
  const file: FileIndicizzabile[] = []
  const warnings: string[] = []

  while (coda.length > 0) {
    const corrente = coda.shift() ?? ""
    if (visitate.has(corrente)) continue
    visitate.add(corrente)

    try {
      const voci = await listFolder(accesso.username, accesso.appPassword, corrente)
      for (const voce of voci) {
        if (voce.isDir) {
          coda.push(voce.path)
        } else {
          file.push({
            path: voce.path,
            nome: voce.name,
            dimensione: voce.size,
            modificatoIl: voce.lastModified,
            contentType: voce.contentType,
            fileId: voce.fileId,
            fingerprint: fingerprintDi(voce),
          })
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "lettura cartella fallita"
      warnings.push(`${corrente}: ${message}`)
    }
  }

  return { file, warnings }
}

async function estraiContenuto(accesso: AccessoAI, file: FileIndicizzabile) {
  if ((file.dimensione ?? 0) > MAX_FILE_INDEX_BYTES) {
    return {
      stato: "unsupported" as const,
      testo: "",
      mediaType: normalizeMediaType(file.contentType) ?? mediaTypeFromName(file.nome),
      errore: "File troppo grande per l'indicizzazione automatica",
    }
  }

  const risposta = await downloadFile(accesso.username, accesso.appPassword, file.path)
  const buffer = new Uint8Array(await risposta.arrayBuffer())
  return estraiContenutoDaBuffer({
    nome: file.nome,
    path: file.path,
    buffer,
    contentType: risposta.headers.get("content-type") ?? file.contentType,
  })
}

function scoreChunk(queryTokens: string[], row: ChunkRow) {
  const haystack = normalize(`${row.titolo} ${row.path} ${row.contenuto.slice(0, 4000)}`)
  return queryTokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0)
}

function prioritaFile(nome: string) {
  const ext = extensionOf(nome)
  if (["txt", "csv", "md", "json", "xml", "yaml", "yml", "eml", "rtf"].includes(ext)) return 10
  if (["docx", "docm", "xlsx", "xlsm", "ods", "odt", "pptx", "pptm", "odp"].includes(ext)) return 20
  if (ext === "pdf") return 30
  if (["zip", "rar", "cbr"].includes(ext)) return 70
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return 80
  return 90
}

function jobFileToIndicizzabile(file: SolairAiSyncJobFile): FileIndicizzabile {
  return {
    path: file.path,
    nome: file.nome,
    dimensione: file.dimensione,
    modificatoIl: file.modificatoIl,
    contentType: file.contentType,
    fileId: file.fileId,
    fingerprint: file.fingerprint,
  }
}

async function indicizzaVoce(params: {
  supabase: SupabaseClient
  accesso: AccessoAI
  entita: EntitaAI
  sourcePath: string
  voce: FileIndicizzabile
  now: string
}): Promise<EsitoFileIndicizzato> {
  try {
    const estratto = await estraiContenuto(params.accesso, params.voce)
    const { data: upserted, error } = await params.supabase
      .from("crm_ai_documenti")
      .upsert(
        {
          entita: params.entita,
          source_path: params.sourcePath,
          path: params.voce.path,
          nome: params.voce.nome,
          estensione: extensionOf(params.voce.nome),
          content_type: estratto.mediaType,
          file_id: params.voce.fileId,
          fingerprint: params.voce.fingerprint,
          dimensione: params.voce.dimensione,
          modificato_il: params.voce.modificatoIl,
          trovato_il: params.now,
          indicizzato_il: params.now,
          stato: estratto.stato,
          testo_estratto: estratto.testo || null,
          testo_chars: estratto.testo.length,
          errore: estratto.errore,
        },
        { onConflict: "entita,path" },
      )
      .select("id")
      .single()

    if (error || !upserted) {
      return {
        chunks: 0,
        stato: "error",
        errore: error?.message ?? "upsert non riuscito",
      }
    }

    await params.supabase.from("crm_ai_document_chunks").delete().eq("documento_id", upserted.id)
    const chunks = chunkText(estratto.testo).map((contenuto, index) => ({
      documento_id: upserted.id,
      entita: params.entita,
      path: params.voce.path,
      chunk_index: index,
      titolo: `${params.voce.nome} #${index + 1}`,
      contenuto,
      keywords: tokens(`${params.entita} ${params.voce.path} ${params.voce.nome} ${contenuto}`).slice(0, 80),
      aggiornato_il: params.now,
    }))

    if (chunks.length > 0) {
      const { error: chunksError } = await params.supabase
        .from("crm_ai_document_chunks")
        .insert(chunks)
      if (chunksError) {
        return { chunks: 0, stato: "error", errore: `chunks ${chunksError.message}` }
      }
    }

    return { chunks: chunks.length, stato: estratto.stato, errore: estratto.errore }
  } catch (error) {
    const message = error instanceof Error ? error.message : "indicizzazione fallita"
    await params.supabase.from("crm_ai_documenti").upsert(
      {
        entita: params.entita,
        source_path: params.sourcePath,
        path: params.voce.path,
        nome: params.voce.nome,
        estensione: extensionOf(params.voce.nome),
        content_type: normalizeMediaType(params.voce.contentType) ?? mediaTypeFromName(params.voce.nome),
        file_id: params.voce.fileId,
        fingerprint: params.voce.fingerprint,
        dimensione: params.voce.dimensione,
        modificato_il: params.voce.modificatoIl,
        trovato_il: params.now,
        indicizzato_il: params.now,
        stato: "error",
        testo_estratto: null,
        testo_chars: 0,
        errore: message,
      },
      { onConflict: "entita,path" },
    )
    return { chunks: 0, stato: "error", errore: message }
  }
}

async function aggiornaSyncSettings(
  supabase: SupabaseClient,
  result: SolairAiSyncResult,
) {
  const ok = result.errors.length === 0
  const { error } = await supabase
    .from("crm_ai_settings")
    .update({
      ultimo_sync_il: new Date().toISOString(),
      ultimo_sync_esito: ok ? "ok" : "error",
      ultimo_sync_errore: ok ? null : result.errors[0],
      ultimo_sync_file: result.scanned,
    })
    .eq("entita", result.entita)

  if (error) {
    result.errors.push(`aggiornamento stato sync: ${error.message}`)
  }
}

export async function sincronizzaIndiceSolairAI(params: {
  entita: EntitaAI
  subject: { userId: string | null; email: string | null }
  force?: boolean
  onProgress?: (progress: SolairAiJobProgress) => Promise<void> | void
}): Promise<SolairAiSyncResult> {
  const impostazione = await leggiImpostazioneAI(params.entita)
  const result: SolairAiSyncResult = {
    entita: params.entita,
    sourcePath: impostazione.nextcloudPath,
    scanned: 0,
    updated: 0,
    reused: 0,
    deleted: 0,
    chunks: 0,
    errors: [],
    warnings: [],
  }

  const supabase = createAdminClient()
  if (!supabase) throw new Error("Supabase admin client non configurato")

  if (!impostazione.attivo || !impostazione.indicizzazioneAttiva || !impostazione.nextcloudPath) {
    result.warnings.push(`${ENTITA_LABEL[params.entita]} non ha una fonte attiva da indicizzare.`)
    await aggiornaSyncSettings(supabase, result)
    return result
  }

  let accesso: AccessoAI
  try {
    accesso = await accessoAI(params.subject)
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "Accesso Nextcloud non riuscito")
    await aggiornaSyncSettings(supabase, result)
    return result
  }

  await params.onProgress?.({ stato: "scanning", fase: "scansione cartelle" })
  const { file, warnings } = await scansionaFonte(accesso, impostazione.nextcloudPath)
  result.warnings.push(...warnings)
  result.scanned = file.length
  const totaleBytes = file.reduce((sum, voce) => sum + (voce.dimensione ?? 0), 0)
  await params.onProgress?.({
    stato: "scanning",
    fase: "confronto indice",
    scanned: file.length,
    warnings: result.warnings.length,
    totaleBytes,
  })

  const paths = file.map((voce) => voce.path)
  const pathSet = new Set(paths)
  const { data: existingRows, error: existingError } = await supabase
    .from("crm_ai_documenti")
    .select("id, entita, path, nome, source_path, fingerprint, stato, testo_chars")
    .eq("entita", params.entita)

  if (existingError) {
    result.errors.push(`lettura indice: ${existingError.message}`)
    await aggiornaSyncSettings(supabase, result)
    return result
  }

  const existing = new Map(
    ((existingRows as DocumentoIndicizzatoRow[] | null) ?? [])
      .filter((row) => row.source_path === impostazione.nextcloudPath)
      .map((row) => [row.path, row]),
  )
  const now = new Date().toISOString()
  const obsoleteIds = ((existingRows as DocumentoIndicizzatoRow[] | null) ?? [])
    .filter(
      (row) =>
        row.stato !== "deleted" &&
        (row.source_path !== impostazione.nextcloudPath || !pathSet.has(row.path)),
    )
    .map((row) => row.id)
  const deveAggiornare = (voce: FileIndicizzabile) => {
    const indexed = existing.get(voce.path)
    return (
      params.force ||
      indexed?.fingerprint !== voce.fingerprint ||
      indexed.stato === "deleted" ||
      indexed.stato === "error"
    )
  }
  const daAggiornare = file.filter(deveAggiornare).length
  const invariati = file.length - daAggiornare
  let processati = 0

  await params.onProgress?.({
    stato: "running",
    fase: daAggiornare > 0 ? "lettura file" : "nessun file da rileggere",
    scanned: file.length,
    totale: daAggiornare,
    processati,
    daAggiornare,
    invariati,
    cancellati: obsoleteIds.length,
    warnings: result.warnings.length,
    totaleBytes,
  })

  if (obsoleteIds.length > 0) {
    const { error } = await supabase
      .from("crm_ai_documenti")
      .update({ stato: "deleted", trovato_il: now, errore: null })
      .in("id", obsoleteIds)
    if (error) result.errors.push(`marcatura cancellati: ${error.message}`)
    else {
      await supabase.from("crm_ai_document_chunks").delete().in("documento_id", obsoleteIds)
      result.deleted = obsoleteIds.length
    }
  }

  for (const voce of file) {
    const indexed = existing.get(voce.path)
    const invariato =
      !params.force && indexed?.fingerprint === voce.fingerprint && indexed.stato !== "deleted" &&
      indexed.stato !== "error"

    if (invariato) {
      result.reused++
      continue
    }

    const esito = await indicizzaVoce({
      supabase,
      accesso,
      entita: params.entita,
      sourcePath: impostazione.nextcloudPath,
      voce,
      now,
    })
    if (esito.stato === "error") {
      result.errors.push(`${voce.path}: ${esito.errore ?? "indicizzazione fallita"}`)
    } else {
      result.updated++
    }
    result.chunks += esito.chunks
    processati++
    await params.onProgress?.({
      stato: "running",
      fase: "lettura file",
      scanned: file.length,
      totale: daAggiornare,
      processati,
      daAggiornare,
      invariati,
      cancellati: result.deleted,
      aggiornati: result.updated,
      chunks: result.chunks,
      errori: result.errors.length,
      warnings: result.warnings.length,
      ultimoPath: voce.path,
      totaleBytes,
    })
  }

  await aggiornaSyncSettings(supabase, result)
  await params.onProgress?.({
    stato: result.errors.length > 0 ? "error" : "completed",
    fase: "completed",
    scanned: result.scanned,
    totale: daAggiornare,
    processati,
    daAggiornare,
    invariati: result.reused,
    cancellati: result.deleted,
    aggiornati: result.updated,
    chunks: result.chunks,
    errori: result.errors.length,
    warnings: result.warnings.length,
    totaleBytes,
  })
  return result
}

export async function controllaIndiceSolairAI(params: {
  entita: EntitaAI
  subject: { userId: string | null; email: string | null }
  force?: boolean
  onProgress?: (progress: SolairAiJobProgress) => Promise<void> | void
}): Promise<SolairAiCheckResult> {
  const impostazione = await leggiImpostazioneAI(params.entita)
  const result: SolairAiCheckResult = {
    entita: params.entita,
    sourcePath: impostazione.nextcloudPath,
    scanned: 0,
    daAggiornare: 0,
    invariati: 0,
    cancellati: 0,
    totaleBytes: 0,
    errors: [],
    warnings: [],
  }

  const supabase = createAdminClient()
  if (!supabase) throw new Error("Supabase admin client non configurato")

  if (!impostazione.attivo || !impostazione.indicizzazioneAttiva || !impostazione.nextcloudPath) {
    result.warnings.push(`${ENTITA_LABEL[params.entita]} non ha una fonte attiva da controllare.`)
    await params.onProgress?.({
      stato: "completed",
      fase: "completed",
      warnings: result.warnings.length,
    })
    return result
  }

  let accesso: AccessoAI
  try {
    accesso = await accessoAI(params.subject)
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "Accesso Nextcloud non riuscito")
    await params.onProgress?.({ stato: "error", fase: "error", errori: result.errors.length })
    return result
  }

  await params.onProgress?.({ stato: "scanning", fase: "scansione cartelle" })
  const { file, warnings } = await scansionaFonte(accesso, impostazione.nextcloudPath)
  result.warnings.push(...warnings)
  result.scanned = file.length
  result.totaleBytes = file.reduce((sum, voce) => sum + (voce.dimensione ?? 0), 0)

  await params.onProgress?.({
    stato: "scanning",
    fase: "confronto indice",
    scanned: result.scanned,
    totaleBytes: result.totaleBytes,
    warnings: result.warnings.length,
  })

  const { data: existingRows, error: existingError } = await supabase
    .from("crm_ai_documenti")
    .select("id, entita, path, nome, source_path, fingerprint, stato, testo_chars")
    .eq("entita", params.entita)

  if (existingError) {
    result.errors.push(`lettura indice: ${existingError.message}`)
    await params.onProgress?.({ stato: "error", fase: "error", errori: result.errors.length })
    return result
  }

  const pathSet = new Set(file.map((voce) => voce.path))
  const existing = new Map(
    ((existingRows as DocumentoIndicizzatoRow[] | null) ?? [])
      .filter((row) => row.source_path === impostazione.nextcloudPath)
      .map((row) => [row.path, row]),
  )
  result.cancellati = ((existingRows as DocumentoIndicizzatoRow[] | null) ?? []).filter(
    (row) =>
      row.stato !== "deleted" &&
      (row.source_path !== impostazione.nextcloudPath || !pathSet.has(row.path)),
  ).length
  result.daAggiornare = file.filter((voce) => {
    const indexed = existing.get(voce.path)
    return (
      params.force ||
      indexed?.fingerprint !== voce.fingerprint ||
      indexed.stato === "deleted" ||
      indexed.stato === "error"
    )
  }).length
  result.invariati = file.length - result.daAggiornare

  await params.onProgress?.({
    stato: "completed",
    fase: "completed",
    scanned: result.scanned,
    totale: result.daAggiornare,
    processati: result.daAggiornare,
    daAggiornare: result.daAggiornare,
    invariati: result.invariati,
    cancellati: result.cancellati,
    errori: result.errors.length,
    warnings: result.warnings.length,
    totaleBytes: result.totaleBytes,
  })
  return result
}

export async function preparaCodaSincronizzazioneSolairAI(params: {
  jobId: string
  entita: EntitaAI
  subject: { userId: string | null; email: string | null }
  force?: boolean
}): Promise<SolairAiCheckResult> {
  const impostazione = await leggiImpostazioneAI(params.entita)
  const result: SolairAiCheckResult = {
    entita: params.entita,
    sourcePath: impostazione.nextcloudPath,
    scanned: 0,
    daAggiornare: 0,
    invariati: 0,
    cancellati: 0,
    totaleBytes: 0,
    errors: [],
    warnings: [],
  }

  const supabase = createAdminClient()
  if (!supabase) throw new Error("Supabase admin client non configurato")

  await updateSolairAiSyncJob(params.jobId, { stato: "scanning", fase: "scansione cartelle" })

  if (!impostazione.attivo || !impostazione.indicizzazioneAttiva || !impostazione.nextcloudPath) {
    result.warnings.push(`${ENTITA_LABEL[params.entita]} non ha una fonte attiva da sincronizzare.`)
    await updateSolairAiSyncJob(params.jobId, {
      stato: "completed",
      fase: "completed",
      warnings: result.warnings.length,
    })
    return result
  }

  let accesso: AccessoAI
  try {
    accesso = await accessoAI(params.subject)
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "Accesso Nextcloud non riuscito")
    await updateSolairAiSyncJob(params.jobId, {
      stato: "error",
      fase: "error",
      errori: result.errors.length,
    })
    return result
  }

  const { file, warnings } = await scansionaFonte(accesso, impostazione.nextcloudPath)
  result.warnings.push(...warnings)
  result.scanned = file.length
  result.totaleBytes = file.reduce((sum, voce) => sum + (voce.dimensione ?? 0), 0)
  await updateSolairAiSyncJob(params.jobId, {
    stato: "scanning",
    fase: "confronto indice",
    scanned: result.scanned,
    totaleBytes: result.totaleBytes,
    warnings: result.warnings.length,
  })

  const { data: existingRows, error: existingError } = await supabase
    .from("crm_ai_documenti")
    .select("id, entita, path, nome, source_path, fingerprint, stato, testo_chars")
    .eq("entita", params.entita)

  if (existingError) {
    result.errors.push(`lettura indice: ${existingError.message}`)
    await updateSolairAiSyncJob(params.jobId, {
      stato: "error",
      fase: "error",
      errori: result.errors.length,
    })
    return result
  }

  const pathSet = new Set(file.map((voce) => voce.path))
  const existing = new Map(
    ((existingRows as DocumentoIndicizzatoRow[] | null) ?? [])
      .filter((row) => row.source_path === impostazione.nextcloudPath)
      .map((row) => [row.path, row]),
  )
  const obsoleteIds = ((existingRows as DocumentoIndicizzatoRow[] | null) ?? [])
    .filter(
      (row) =>
        row.stato !== "deleted" &&
        (row.source_path !== impostazione.nextcloudPath || !pathSet.has(row.path)),
    )
    .map((row) => row.id)
  result.cancellati = obsoleteIds.length

  if (obsoleteIds.length > 0) {
    const { error } = await supabase
      .from("crm_ai_documenti")
      .update({ stato: "deleted", trovato_il: new Date().toISOString(), errore: null })
      .in("id", obsoleteIds)
    if (error) result.errors.push(`marcatura cancellati: ${error.message}`)
    else await supabase.from("crm_ai_document_chunks").delete().in("documento_id", obsoleteIds)
  }

  const daLeggere = file.filter((voce) => {
    const indexed = existing.get(voce.path)
    return (
      params.force ||
      indexed?.fingerprint !== voce.fingerprint ||
      indexed.stato === "deleted" ||
      indexed.stato === "error"
    )
  })
  result.daAggiornare = daLeggere.length
  result.invariati = file.length - daLeggere.length

  const inserimento = await insertSolairAiSyncJobFiles({
    jobId: params.jobId,
    files: daLeggere.map((voce) => ({
      entita: params.entita,
      sourcePath: impostazione.nextcloudPath,
      path: voce.path,
      nome: voce.nome,
      estensione: extensionOf(voce.nome),
      contentType: voce.contentType,
      fileId: voce.fileId,
      fingerprint: voce.fingerprint,
      dimensione: voce.dimensione,
      modificatoIl: voce.modificatoIl,
      priority: prioritaFile(voce.nome),
    })),
  })
  if (inserimento.error) result.errors.push(`coda file: ${inserimento.error}`)

  await updateSolairAiSyncJob(params.jobId, {
    stato: result.errors.length > 0 ? "error" : daLeggere.length > 0 ? "running" : "completed",
    fase: daLeggere.length > 0 ? "lettura file" : "completed",
    scanned: result.scanned,
    totale: result.daAggiornare,
    processati: 0,
    daAggiornare: result.daAggiornare,
    invariati: result.invariati,
    cancellati: result.cancellati,
    errori: result.errors.length,
    warnings: result.warnings.length,
    totaleBytes: result.totaleBytes,
  })

  return result
}

async function subjectDaJobCreatore(userId: string | null) {
  if (!userId) throw new Error("Job senza utente creatore")
  const supabase = createAdminClient()
  if (!supabase) throw new Error("Supabase admin client non configurato")

  const { data, error } = await supabase
    .from("utenti")
    .select("email")
    .eq("id", userId)
    .maybeSingle()

  if (error || !data || typeof data.email !== "string") {
    throw new Error(error?.message ?? "Utente creatore job non trovato")
  }

  return { userId, email: data.email }
}

export async function processaBatchJobSolairAI(params: {
  jobId: string
  maxFiles?: number
  maxMs?: number
}) {
  const started = Date.now()
  const maxFiles = params.maxFiles ?? 8
  const maxMs = params.maxMs ?? 45_000
  const supabase = createAdminClient()
  if (!supabase) throw new Error("Supabase admin client non configurato")

  const job = await getSolairAiSyncJob(params.jobId)
  if (!job) throw new Error("Job SolairAI non trovato")
  if (job.stato === "completed" || job.stato === "error") {
    return { jobId: job.id, processed: 0, done: true, error: job.errore }
  }

  const accesso = await accessoAI(await subjectDaJobCreatore(job.creatoDa))
  await updateSolairAiSyncJob(job.id, { stato: "running", fase: "lettura file" })
  await resetStaleSolairAiSyncJobFiles(job.id)

  let processed = 0
  let lastError: string | null = null
  while (processed < maxFiles && Date.now() - started < maxMs) {
    const [file] = await getQueuedSolairAiSyncJobFiles(job.id, 1)
    if (!file) break

    await markSolairAiSyncJobFileRunning(file.id)
    const esito = await indicizzaVoce({
      supabase,
      accesso,
      entita: file.entita,
      sourcePath: file.sourcePath,
      voce: jobFileToIndicizzabile(file),
      now: new Date().toISOString(),
    })
    await finishSolairAiSyncJobFile(file.id, {
      stato: esito.stato === "error" ? "error" : "done",
      chunkCount: esito.chunks,
      errore: esito.errore,
    })
    if (esito.stato === "error") lastError = esito.errore ?? "indicizzazione fallita"
    processed++

    const stats = await leggiStatisticheFileJob(job.id)
    await updateSolairAiSyncJob(job.id, {
      stato: "running",
      fase: "lettura file",
      processati: stats.done + stats.error + stats.skipped,
      aggiornati: stats.done,
      chunks: stats.chunks,
      errori: stats.error,
      ultimoPath: file.path,
    })
  }

  const stats = await leggiStatisticheFileJob(job.id)
  const done = stats.queued === 0 && stats.running === 0
  if (done) {
    await finishSolairAiSyncJob(job.id, {
      errore: stats.error > 0 ? `${stats.error} file non indicizzati` : null,
      progress: {
        fase: "completed",
        processati: stats.done + stats.error + stats.skipped,
        aggiornati: stats.done,
        chunks: stats.chunks,
        errori: stats.error,
      },
    })
    await aggiornaSyncSettings(supabase, {
      entita: job.entita,
      sourcePath: job.sourcePath,
      scanned: job.scanned,
      updated: stats.done,
      reused: job.invariati,
      deleted: job.cancellati,
      chunks: stats.chunks,
      errors: stats.error > 0 ? [`${stats.error} file non indicizzati`] : [],
      warnings: [],
    })
  }

  return { jobId: job.id, processed, done, error: lastError }
}

export async function sincronizzaFontiSolairAI(params: {
  entita?: EntitaAI
  subject: { userId: string | null; email: string | null }
  force?: boolean
}) {
  const entita = params.entita ? [params.entita] : ENTITA_AI
  const risultati: SolairAiSyncResult[] = []
  for (const voce of entita) {
    risultati.push(
      await sincronizzaIndiceSolairAI({
        entita: voce,
        subject: params.subject,
        force: params.force,
      }),
    )
  }
  return risultati
}

export async function leggiStatoIndiceSolairAI(): Promise<SolairAiIndexStats[]> {
  const impostazioni = await leggiImpostazioniAI()
  const supabase = createAdminClient()

  if (!supabase) {
    return impostazioni.map((impostazione) => ({
      entita: impostazione.entita,
      sourcePath: impostazione.nextcloudPath,
      active: impostazione.attivo,
      indexingActive: impostazione.indicizzazioneAttiva,
      files: 0,
      ready: 0,
      errors: 0,
      unsupported: 0,
      deleted: 0,
      chunks: 0,
      lastSyncAt: impostazione.ultimoSyncIl,
      lastSyncStatus: impostazione.ultimoSyncEsito,
      lastSyncError: impostazione.ultimoSyncErrore,
      lastSyncFiles: impostazione.ultimoSyncFile,
      schemaReady: false,
    }))
  }

  const [documenti, chunks] = await Promise.all([
    supabase.from("crm_ai_documenti").select("entita, stato"),
    supabase.from("crm_ai_document_chunks").select("entita"),
  ])

  if (documenti.error || chunks.error) {
    return impostazioni.map((impostazione) => ({
      entita: impostazione.entita,
      sourcePath: impostazione.nextcloudPath,
      active: impostazione.attivo,
      indexingActive: impostazione.indicizzazioneAttiva,
      files: 0,
      ready: 0,
      errors: 0,
      unsupported: 0,
      deleted: 0,
      chunks: 0,
      lastSyncAt: impostazione.ultimoSyncIl,
      lastSyncStatus: impostazione.ultimoSyncEsito,
      lastSyncError: documenti.error?.message ?? chunks.error?.message ?? null,
      lastSyncFiles: impostazione.ultimoSyncFile,
      schemaReady: false,
    }))
  }

  const docs = (documenti.data ?? []) as { entita: string; stato: string }[]
  const chunkRows = (chunks.data ?? []) as { entita: string }[]

  return impostazioni.map((impostazione) => {
    const perEntita = docs.filter((row) => row.entita === impostazione.entita)
    return {
      entita: impostazione.entita,
      sourcePath: impostazione.nextcloudPath,
      active: impostazione.attivo,
      indexingActive: impostazione.indicizzazioneAttiva,
      files: perEntita.filter((row) => row.stato !== "deleted").length,
      ready: perEntita.filter((row) => row.stato === "ready").length,
      errors: perEntita.filter((row) => row.stato === "error").length,
      unsupported: perEntita.filter((row) => row.stato === "unsupported").length,
      deleted: perEntita.filter((row) => row.stato === "deleted").length,
      chunks: chunkRows.filter((row) => row.entita === impostazione.entita).length,
      lastSyncAt: impostazione.ultimoSyncIl,
      lastSyncStatus: impostazione.ultimoSyncEsito,
      lastSyncError: impostazione.ultimoSyncErrore,
      lastSyncFiles: impostazione.ultimoSyncFile,
      schemaReady: true,
    }
  })
}

export async function cercaIndiceSolairAI(
  query: string,
  options: { entita?: EntitaAI | null; limit?: number } = {},
): Promise<SolairAiKnowledgeSnippet[]> {
  const queryTokens = tokens(query).slice(0, 16)
  if (queryTokens.length === 0) return []

  const supabase = await createClient()
  let request = supabase
    .from("crm_ai_document_chunks")
    .select("id, documento_id, entita, path, titolo, contenuto, keywords")
    .overlaps("keywords", queryTokens)
    .limit(80)

  if (options.entita && isEntitaAI(options.entita)) {
    request = request.eq("entita", options.entita)
  }

  const { data, error } = await request
  if (error) return []

  const dedupe = new Map<string, SolairAiKnowledgeSnippet>()
  for (const row of ((data ?? []) as ChunkRow[])) {
    const score = scoreChunk(queryTokens, row)
    if (score <= 0) continue
    const key = `${row.path}:${row.contenuto}`
    const snippet = {
      entita: row.entita,
      path: row.path,
      titolo: row.titolo,
      contenuto: row.contenuto,
      score,
    }
    const current = dedupe.get(key)
    if (!current || snippet.score > current.score) dedupe.set(key, snippet)
  }

  return [...dedupe.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 8)
}
