// Persistenza dello stato dei job di invio di massa (tabella
// email_massa_jobs, migration 20260728).
//
// Tutto passa dal service_role: le scritture avvengono dentro after(), dopo
// che la risposta HTTP e' gia' partita, quindi non c'e' piu' un client
// autenticato affidabile a cui appoggiarsi. La RLS della tabella espone in
// lettura solo i propri job; qui il controllo di proprieta' e' rifatto in
// codice (vedi getEmailMassaJob).

import { createAdminClient } from "@/lib/supabase/admin"
import type { BulkRecordTipo } from "./bulk-targets"

export type EmailMassaStato = "in_corso" | "completato" | "errore"

export type EmailMassaJob = {
  id: string
  recordTipo: BulkRecordTipo
  oggetto: string
  totale: number
  inviate: number
  fallite: number
  stato: EmailMassaStato
  errore: string | null
  creatoDa: string | null
  createdAt: string
  updatedAt: string
}

type JobRow = {
  id: string
  record_tipo: string
  oggetto: string
  totale: number
  inviate: number
  fallite: number
  stato: string
  errore: string | null
  creato_da: string | null
  created_at: string
  updated_at: string
}

const JOB_COLUMNS =
  "id,record_tipo,oggetto,totale,inviate,fallite,stato,errore,creato_da,created_at,updated_at"

function mapJob(row: JobRow): EmailMassaJob {
  return {
    id: row.id,
    recordTipo: row.record_tipo as BulkRecordTipo,
    oggetto: row.oggetto,
    totale: row.totale,
    inviate: row.inviate,
    fallite: row.fallite,
    stato: row.stato as EmailMassaStato,
    errore: row.errore,
    creatoDa: row.creato_da,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Un job "in corso" che non scrive progressi da un pezzo e' quasi sempre un
 * background task terminato con la funzione serverless (kill per timeout, vedi
 * maxDuration in app/api/email-massa/route.ts): senza questo controllo la UI
 * resterebbe a pollare all'infinito una barra ferma.
 */
export const JOB_STALLO_MS = 90_000

export function isEmailMassaJobStallo(job: EmailMassaJob): boolean {
  if (job.stato !== "in_corso") return false
  const last = Date.parse(job.updatedAt || job.createdAt)
  return Number.isFinite(last) && Date.now() - last > JOB_STALLO_MS
}

export async function createEmailMassaJob(params: {
  recordTipo: BulkRecordTipo
  oggetto: string
  totale: number
  creatoDa: string
}): Promise<{ job: EmailMassaJob | null; error: string | null }> {
  const admin = createAdminClient()
  if (!admin) return { job: null, error: "Supabase service role non configurato" }

  const { data, error } = await admin
    .from("email_massa_jobs")
    .insert({
      record_tipo: params.recordTipo,
      oggetto: params.oggetto,
      totale: params.totale,
      creato_da: params.creatoDa,
    })
    .select(JOB_COLUMNS)
    .single()

  if (error || !data) return { job: null, error: error?.message ?? "Creazione job fallita" }
  return { job: mapJob(data as JobRow), error: null }
}

/** Aggiornamento dei contatori durante l'invio (chiamato dal background). */
export async function updateEmailMassaProgress(
  jobId: string,
  progress: { inviate: number; fallite: number },
): Promise<void> {
  const admin = createAdminClient()
  if (!admin) return

  const { error } = await admin
    .from("email_massa_jobs")
    .update({
      inviate: progress.inviate,
      fallite: progress.fallite,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)

  if (error) console.error(`[email-massa] update progresso job ${jobId}:`, error.message)
}

/**
 * Chiusura del job. `inviate`/`fallite` sono opzionali: quando l'invio si
 * interrompe per un errore non recuperabile i contatori vanno lasciati
 * all'ultimo valore scritto (e' il numero minimo garantito di email gia'
 * partite), non azzerati.
 */
export async function finishEmailMassaJob(
  jobId: string,
  result: { inviate?: number; fallite?: number; errore?: string | null },
): Promise<void> {
  const admin = createAdminClient()
  if (!admin) return

  const now = new Date().toISOString()
  const { error } = await admin
    .from("email_massa_jobs")
    .update({
      ...(result.inviate === undefined ? {} : { inviate: result.inviate }),
      ...(result.fallite === undefined ? {} : { fallite: result.fallite }),
      stato: result.errore ? "errore" : "completato",
      errore: result.errore ?? null,
      updated_at: now,
      completato_at: now,
    })
    .eq("id", jobId)

  if (error) console.error(`[email-massa] chiusura job ${jobId}:`, error.message)
}

export async function getEmailMassaJob(jobId: string): Promise<EmailMassaJob | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const { data, error } = await admin
    .from("email_massa_jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .maybeSingle()

  if (error || !data) return null
  return mapJob(data as JobRow)
}
