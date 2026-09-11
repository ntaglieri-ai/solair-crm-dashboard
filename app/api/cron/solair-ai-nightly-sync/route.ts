import { NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { processaBatchJobSolairAI, preparaCodaSincronizzazioneSolairAI } from "@/lib/solair-ai/indice"
import { createSolairAiSyncJob, getActiveSolairAiSyncJobs } from "@/lib/solair-ai/sync-job-store"
import { isEntitaAI } from "@/lib/solair-ai/tipi"
import type { EntitaAI } from "@/lib/solair-ai/tipi"

export const runtime = "nodejs"
export const maxDuration = 120

type SettingRow = {
  entita: string
  nextcloud_path: string
  attivo: boolean
  indicizzazione_attiva: boolean
  aggiornato_da: string | null
}

type UserRow = {
  id: string
  email: string
}

async function defaultSyncUser() {
  const supabase = createAdminClient()
  if (!supabase) return null
  const { data } = await supabase
    .from("utenti")
    .select("id, email")
    .eq("attivo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as UserRow | null) ?? null
}

async function userById(userId: string | null, fallback: UserRow | null) {
  if (!userId) return fallback
  const supabase = createAdminClient()
  if (!supabase) return fallback
  const { data } = await supabase
    .from("utenti")
    .select("id, email")
    .eq("id", userId)
    .maybeSingle()
  return (data as UserRow | null) ?? fallback
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const started = Date.now()
  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase admin client non configurato" }, { status: 503 })
  }

  const { data, error } = await supabase
    .from("crm_ai_settings")
    .select("entita, nextcloud_path, attivo, indicizzazione_attiva, aggiornato_da")
    .eq("attivo", true)
    .eq("indicizzazione_attiva", true)
    .neq("nextcloud_path", "")

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const fallback = await defaultSyncUser()
  const aperti = await getActiveSolairAiSyncJobs()
  const jobs: Array<{ entita: EntitaAI; jobId: string; queued: number; error: string | null }> = []
  for (const setting of (data ?? []) as SettingRow[]) {
    if (!isEntitaAI(setting.entita)) continue
    if (Date.now() - started > 95_000) break
    const esistente = aperti.find((job) => job.entita === setting.entita && job.modo === "sync")
    if (esistente) {
      jobs.push({ entita: setting.entita, jobId: esistente.id, queued: esistente.daAggiornare, error: null })
      continue
    }

    const utente = await userById(setting.aggiornato_da, fallback)
    if (!utente) {
      jobs.push({ entita: setting.entita, jobId: "", queued: 0, error: "Nessun utente sync disponibile" })
      continue
    }

    const { job, error: jobError } = await createSolairAiSyncJob({
      entita: setting.entita,
      modo: "sync",
      sourcePath: setting.nextcloud_path,
      creatoDa: utente.id,
    })
    if (jobError || !job) {
      jobs.push({ entita: setting.entita, jobId: "", queued: 0, error: jobError ?? "Creazione job fallita" })
      continue
    }

    const prepared = await preparaCodaSincronizzazioneSolairAI({
      jobId: job.id,
      entita: setting.entita,
      subject: { userId: utente.id, email: utente.email },
    })
    if (prepared.daAggiornare > 0 && prepared.errors.length === 0) {
      await processaBatchJobSolairAI({ jobId: job.id, maxFiles: 8, maxMs: 35_000 })
    }

    jobs.push({
      entita: setting.entita,
      jobId: job.id,
      queued: prepared.daAggiornare,
      error: prepared.errors[0] ?? null,
    })
  }

  return NextResponse.json({
    ok: jobs.every((job) => !job.error),
    latencyMs: Date.now() - started,
    jobs,
  })
}
