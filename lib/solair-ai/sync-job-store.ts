import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { EntitaAI } from "./tipi"

export type SolairAiSyncJobMode = "check" | "sync"
export type SolairAiSyncJobStatus = "queued" | "scanning" | "running" | "completed" | "error"

export type SolairAiSyncJob = {
  id: string
  entita: EntitaAI
  modo: SolairAiSyncJobMode
  sourcePath: string
  stato: SolairAiSyncJobStatus
  fase: string
  scanned: number
  totale: number
  processati: number
  daAggiornare: number
  invariati: number
  cancellati: number
  aggiornati: number
  chunks: number
  errori: number
  warnings: number
  totaleBytes: number
  ultimoPath: string | null
  errore: string | null
  risultato: unknown
  creatoDa: string | null
  createdAt: string
  updatedAt: string
  completatoAt: string | null
}

export type SolairAiSyncJobFileStatus = "queued" | "running" | "done" | "error" | "skipped"

export type SolairAiSyncJobFile = {
  id: string
  jobId: string
  entita: EntitaAI
  sourcePath: string
  path: string
  nome: string
  estensione: string
  contentType: string | null
  fileId: string | null
  fingerprint: string
  dimensione: number | null
  modificatoIl: string | null
  priority: number
  stato: SolairAiSyncJobFileStatus
  chunkCount: number
  errore: string | null
}

export type SolairAiJobProgress = Partial<
  Pick<
    SolairAiSyncJob,
    | "fase"
    | "scanned"
    | "totale"
    | "processati"
    | "daAggiornare"
    | "invariati"
    | "cancellati"
    | "aggiornati"
    | "chunks"
    | "errori"
    | "warnings"
    | "totaleBytes"
    | "ultimoPath"
  >
> & {
  stato?: SolairAiSyncJobStatus
}

type JobRow = {
  id: string
  entita: string
  modo: string
  source_path: string
  stato: string
  fase: string
  scanned: number
  totale: number
  processati: number
  da_aggiornare: number
  invariati: number
  cancellati: number
  aggiornati: number
  chunks: number
  errori: number
  warnings: number
  totale_bytes: number
  ultimo_path: string | null
  errore: string | null
  risultato: unknown
  creato_da: string | null
  created_at: string
  updated_at: string
  completato_at: string | null
}

type JobFileRow = {
  id: string
  job_id: string
  entita: string
  source_path: string
  path: string
  nome: string
  estensione: string
  content_type: string | null
  file_id: string | null
  fingerprint: string
  dimensione: number | null
  modificato_il: string | null
  priority: number
  stato: string
  chunk_count: number
  errore: string | null
}

const JOB_COLUMNS = [
  "id",
  "entita",
  "modo",
  "source_path",
  "stato",
  "fase",
  "scanned",
  "totale",
  "processati",
  "da_aggiornare",
  "invariati",
  "cancellati",
  "aggiornati",
  "chunks",
  "errori",
  "warnings",
  "totale_bytes",
  "ultimo_path",
  "errore",
  "risultato",
  "creato_da",
  "created_at",
  "updated_at",
  "completato_at",
].join(",")

const JOB_FILE_COLUMNS = [
  "id",
  "job_id",
  "entita",
  "source_path",
  "path",
  "nome",
  "estensione",
  "content_type",
  "file_id",
  "fingerprint",
  "dimensione",
  "modificato_il",
  "priority",
  "stato",
  "chunk_count",
  "errore",
].join(",")

export const SOLAIR_AI_JOB_STALLO_MS = 10 * 60_000

function mapJob(row: JobRow): SolairAiSyncJob {
  return {
    id: row.id,
    entita: row.entita as EntitaAI,
    modo: row.modo as SolairAiSyncJobMode,
    sourcePath: row.source_path,
    stato: row.stato as SolairAiSyncJobStatus,
    fase: row.fase,
    scanned: row.scanned,
    totale: row.totale,
    processati: row.processati,
    daAggiornare: row.da_aggiornare,
    invariati: row.invariati,
    cancellati: row.cancellati,
    aggiornati: row.aggiornati,
    chunks: row.chunks,
    errori: row.errori,
    warnings: row.warnings,
    totaleBytes: Number(row.totale_bytes ?? 0),
    ultimoPath: row.ultimo_path,
    errore: row.errore,
    risultato: row.risultato,
    creatoDa: row.creato_da,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completatoAt: row.completato_at,
  }
}

function mapJobFile(row: JobFileRow): SolairAiSyncJobFile {
  return {
    id: row.id,
    jobId: row.job_id,
    entita: row.entita as EntitaAI,
    sourcePath: row.source_path,
    path: row.path,
    nome: row.nome,
    estensione: row.estensione,
    contentType: row.content_type,
    fileId: row.file_id,
    fingerprint: row.fingerprint,
    dimensione: row.dimensione,
    modificatoIl: row.modificato_il,
    priority: row.priority,
    stato: row.stato as SolairAiSyncJobFileStatus,
    chunkCount: row.chunk_count,
    errore: row.errore,
  }
}

export function isSolairAiJobStallo(job: SolairAiSyncJob) {
  if (!["queued", "scanning", "running"].includes(job.stato)) return false
  const last = Date.parse(job.updatedAt || job.createdAt)
  return Number.isFinite(last) && Date.now() - last > SOLAIR_AI_JOB_STALLO_MS
}

export async function createSolairAiSyncJob(params: {
  entita: EntitaAI
  modo: SolairAiSyncJobMode
  sourcePath: string
  creatoDa: string | null
}) {
  const admin = createAdminClient()
  if (!admin) return { job: null, error: "Supabase service role non configurato" }

  const { data, error } = await admin
    .from("crm_ai_sync_jobs")
    .insert({
      entita: params.entita,
      modo: params.modo,
      source_path: params.sourcePath,
      creato_da: params.creatoDa,
    })
    .select(JOB_COLUMNS)
    .single()

  if (error || !data) return { job: null, error: error?.message ?? "Creazione job fallita" }
  return { job: mapJob(data as unknown as JobRow), error: null }
}

export async function updateSolairAiSyncJob(jobId: string, progress: SolairAiJobProgress) {
  const admin = createAdminClient()
  if (!admin) return

  const { error } = await admin
    .from("crm_ai_sync_jobs")
    .update({
      ...(progress.stato === undefined ? {} : { stato: progress.stato }),
      ...(progress.fase === undefined ? {} : { fase: progress.fase }),
      ...(progress.scanned === undefined ? {} : { scanned: progress.scanned }),
      ...(progress.totale === undefined ? {} : { totale: progress.totale }),
      ...(progress.processati === undefined ? {} : { processati: progress.processati }),
      ...(progress.daAggiornare === undefined ? {} : { da_aggiornare: progress.daAggiornare }),
      ...(progress.invariati === undefined ? {} : { invariati: progress.invariati }),
      ...(progress.cancellati === undefined ? {} : { cancellati: progress.cancellati }),
      ...(progress.aggiornati === undefined ? {} : { aggiornati: progress.aggiornati }),
      ...(progress.chunks === undefined ? {} : { chunks: progress.chunks }),
      ...(progress.errori === undefined ? {} : { errori: progress.errori }),
      ...(progress.warnings === undefined ? {} : { warnings: progress.warnings }),
      ...(progress.totaleBytes === undefined ? {} : { totale_bytes: progress.totaleBytes }),
      ...(progress.ultimoPath === undefined ? {} : { ultimo_path: progress.ultimoPath }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)

  if (error) console.error(`[solair-ai-sync] update job ${jobId}:`, error.message)
}

export async function finishSolairAiSyncJob(
  jobId: string,
  result: { errore?: string | null; risultato?: unknown; progress?: SolairAiJobProgress },
) {
  const admin = createAdminClient()
  if (!admin) return

  const now = new Date().toISOString()
  const progress = result.progress ?? {}
  const { error } = await admin
    .from("crm_ai_sync_jobs")
    .update({
      ...(progress.fase === undefined ? {} : { fase: progress.fase }),
      ...(progress.scanned === undefined ? {} : { scanned: progress.scanned }),
      ...(progress.totale === undefined ? {} : { totale: progress.totale }),
      ...(progress.processati === undefined ? {} : { processati: progress.processati }),
      ...(progress.daAggiornare === undefined ? {} : { da_aggiornare: progress.daAggiornare }),
      ...(progress.invariati === undefined ? {} : { invariati: progress.invariati }),
      ...(progress.cancellati === undefined ? {} : { cancellati: progress.cancellati }),
      ...(progress.aggiornati === undefined ? {} : { aggiornati: progress.aggiornati }),
      ...(progress.chunks === undefined ? {} : { chunks: progress.chunks }),
      ...(progress.errori === undefined ? {} : { errori: progress.errori }),
      ...(progress.warnings === undefined ? {} : { warnings: progress.warnings }),
      ...(progress.totaleBytes === undefined ? {} : { totale_bytes: progress.totaleBytes }),
      ...(progress.ultimoPath === undefined ? {} : { ultimo_path: progress.ultimoPath }),
      stato: result.errore ? "error" : "completed",
      fase: result.errore ? "error" : (progress.fase ?? "completed"),
      errore: result.errore ?? null,
      risultato: result.risultato ?? null,
      updated_at: now,
      completato_at: now,
    })
    .eq("id", jobId)

  if (error) console.error(`[solair-ai-sync] chiusura job ${jobId}:`, error.message)
}

export async function getSolairAiSyncJob(jobId: string) {
  const admin = createAdminClient()
  if (!admin) return null

  const { data, error } = await admin
    .from("crm_ai_sync_jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .maybeSingle()

  if (error || !data) return null
  return mapJob(data as unknown as JobRow)
}

export async function insertSolairAiSyncJobFiles(params: {
  jobId: string
  files: Array<{
    entita: EntitaAI
    sourcePath: string
    path: string
    nome: string
    estensione: string
    contentType: string | null
    fileId: string | null
    fingerprint: string
    dimensione: number | null
    modificatoIl: string | null
    priority: number
  }>
}) {
  const admin = createAdminClient()
  if (!admin) return { inserted: 0, error: "Supabase service role non configurato" }
  if (params.files.length === 0) return { inserted: 0, error: null }

  const { data, error } = await admin
    .from("crm_ai_sync_job_files")
    .insert(
      params.files.map((file) => ({
        job_id: params.jobId,
        entita: file.entita,
        source_path: file.sourcePath,
        path: file.path,
        nome: file.nome,
        estensione: file.estensione,
        content_type: file.contentType,
        file_id: file.fileId,
        fingerprint: file.fingerprint,
        dimensione: file.dimensione,
        modificato_il: file.modificatoIl,
        priority: file.priority,
      })),
    )
    .select("id")

  if (error) return { inserted: 0, error: error.message }
  return { inserted: data?.length ?? 0, error: null }
}

export async function getQueuedSolairAiSyncJobFiles(jobId: string, limit: number) {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from("crm_ai_sync_job_files")
    .select(JOB_FILE_COLUMNS)
    .eq("job_id", jobId)
    .eq("stato", "queued")
    .order("priority", { ascending: true })
    .order("path", { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return (data as unknown as JobFileRow[]).map(mapJobFile)
}

/**
 * Somma dei chunk prodotti da un job. Paginata perche' PostgREST non somma e
 * si ferma a 1.000 righe per pagina. Si chiama una volta sola, a job finito:
 * durante la corsa il numero che conta e' quello dei file.
 */
export async function sommaChunkJob(jobId: string): Promise<number> {
  const admin = createAdminClient()
  if (!admin) return 0

  const pagina = 1000
  let totale = 0
  for (let da = 0; ; da += pagina) {
    const { data, error } = await admin
      .from("crm_ai_sync_job_files")
      .select("chunk_count")
      .eq("job_id", jobId)
      .range(da, da + pagina - 1)

    if (error || !data) break
    for (const riga of data as { chunk_count: number | null }[]) totale += riga.chunk_count ?? 0
    if (data.length < pagina) break
  }
  return totale
}

/**
 * Rimette in coda i file presi in carico ma non lavorati (tempo del giro
 * scaduto). Senza, resterebbero `running` fino allo scadere dello stallo e il
 * giro successivo non li toccherebbe.
 */
export async function rilasciaSolairAiSyncJobFiles(fileIds: string[]) {
  const admin = createAdminClient()
  if (!admin || fileIds.length === 0) return

  const { error } = await admin
    .from("crm_ai_sync_job_files")
    .update({ stato: "queued", updated_at: new Date().toISOString() })
    .in("id", fileIds)
    .eq("stato", "running")

  if (error) console.error("[solair-ai-sync] rilascio file:", error.message)
}

export async function markSolairAiSyncJobFileRunning(fileId: string) {
  const admin = createAdminClient()
  if (!admin) return

  const { error } = await admin
    .from("crm_ai_sync_job_files")
    .update({ stato: "running", updated_at: new Date().toISOString() })
    .eq("id", fileId)

  if (error) console.error(`[solair-ai-sync] start file ${fileId}:`, error.message)
}

export async function finishSolairAiSyncJobFile(
  fileId: string,
  result: { stato: Exclude<SolairAiSyncJobFileStatus, "queued" | "running">; chunkCount?: number; errore?: string | null },
) {
  const admin = createAdminClient()
  if (!admin) return

  const now = new Date().toISOString()
  const { error } = await admin
    .from("crm_ai_sync_job_files")
    .update({
      stato: result.stato,
      chunk_count: result.chunkCount ?? 0,
      errore: result.errore ?? null,
      updated_at: now,
      processed_at: now,
    })
    .eq("id", fileId)

  if (error) console.error(`[solair-ai-sync] finish file ${fileId}:`, error.message)
}

const STATI_FILE: SolairAiSyncJobFileStatus[] = ["queued", "running", "done", "error", "skipped"]

/**
 * Quanti file per stato, contati dal database.
 *
 * Prima si scaricavano le righe e si contavano a mano: con una coda da 25.000
 * file PostgREST ne restituiva 1.000 (il suo tetto) e il conteggio usciva da
 * quel campione — "8 processati" dopo un'ora e mezza, mentre a database ne
 * risultavano 192. Un `count` esatto per stato non ha campione e non scarica
 * niente.
 *
 * `chunks` non sta qui: PostgREST non somma. Lo tiene il chiamante, che
 * conosce i chunk prodotti nel proprio giro e li aggiunge al totale del job.
 */
export async function leggiStatisticheFileJob(jobId: string) {
  const vuote = { queued: 0, running: 0, done: 0, error: 0, skipped: 0, errors: 0 }
  const admin = createAdminClient()
  if (!admin) return vuote

  const conteggi = await Promise.all(
    STATI_FILE.map(async (stato) => {
      const { count, error } = await admin
        .from("crm_ai_sync_job_files")
        .select("*", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("stato", stato)
      if (error) {
        console.error(`[solair-ai-sync] conteggio ${stato} job ${jobId}:`, error.message)
        return 0
      }
      return count ?? 0
    }),
  )

  const stats = { ...vuote }
  STATI_FILE.forEach((stato, indice) => {
    stats[stato] = conteggi[indice]
  })
  stats.errors = stats.error
  return stats
}

/**
 * Prende in carico fino a `limit` file passandoli da `queued` a `running`
 * in una sola UPDATE.
 *
 * Il filtro `stato = queued` dentro la UPDATE e' quello che rende il claim
 * sicuro: due giri di cron sovrapposti, o due worker dello stesso giro, non
 * possono portarsi via la stessa riga — la seconda UPDATE non la trova piu'
 * in `queued` e il file torna indietro solo a chi l'ha vinto. Il vecchio
 * "leggi una riga, poi marcala" non lo garantiva, e in parallelo avrebbe
 * fatto lavorare due volte gli stessi file.
 */
export async function claimSolairAiSyncJobFiles(jobId: string, limit: number) {
  const admin = createAdminClient()
  if (!admin || limit <= 0) return []

  const { data: candidati, error: erroreLettura } = await admin
    .from("crm_ai_sync_job_files")
    .select("id")
    .eq("job_id", jobId)
    .eq("stato", "queued")
    .order("priority", { ascending: true })
    .order("path", { ascending: true })
    .limit(limit)

  if (erroreLettura || !candidati || candidati.length === 0) return []

  const { data, error } = await admin
    .from("crm_ai_sync_job_files")
    .update({ stato: "running", updated_at: new Date().toISOString() })
    .in(
      "id",
      (candidati as { id: string }[]).map((riga) => riga.id),
    )
    .eq("stato", "queued")
    .select(JOB_FILE_COLUMNS)

  if (error || !data) {
    if (error) console.error(`[solair-ai-sync] claim job ${jobId}:`, error.message)
    return []
  }
  return (data as unknown as JobFileRow[]).map(mapJobFile)
}

export async function getOpenSolairAiSyncJobs(limit = 3) {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from("crm_ai_sync_jobs")
    .select(JOB_COLUMNS)
    .eq("modo", "sync")
    .in("stato", ["queued", "scanning", "running"])
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return (data as unknown as JobRow[]).map(mapJob)
}

export async function resetStaleSolairAiSyncJobFiles(jobId: string, olderThanMs = SOLAIR_AI_JOB_STALLO_MS) {
  const admin = createAdminClient()
  if (!admin) return

  const threshold = new Date(Date.now() - olderThanMs).toISOString()
  const { error } = await admin
    .from("crm_ai_sync_job_files")
    .update({
      stato: "queued",
      errore: "Ripreso dopo interruzione del worker",
      updated_at: new Date().toISOString(),
    })
    .eq("job_id", jobId)
    .eq("stato", "running")
    .lt("updated_at", threshold)

  if (error) console.error(`[solair-ai-sync] reset file running job ${jobId}:`, error.message)
}

export async function getActiveSolairAiSyncJobs() {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from("crm_ai_sync_jobs")
    .select(JOB_COLUMNS)
    .in("stato", ["queued", "scanning", "running"])
    .order("created_at", { ascending: false })
    .limit(12)

  if (error || !data) return []
  return (data as unknown as JobRow[]).map(mapJob)
}
