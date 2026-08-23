// Lettura dell'audit log.
//
// Client: createClient() con la sessione dell'utente, non service_role. La
// policy `audit_log_select` concede la SELECT a chiunque abbia una sessione
// (`auth.uid() IS NOT NULL`), quindi RLS non ha bisogno di essere aggirata; chi
// puo' arrivare alla pagina e' gia' filtrato dal permesso
// `crm_settings.account.audit`.
//
// Gli errori vengono restituiti, non inghiottiti: una SELECT fallita deve
// arrivare in pagina come errore e non come "nessun evento", che e' la stessa
// distinzione gia' applicata alla lista lead.

import { createClient } from "@/lib/supabase/server"
import {
  AUDIT_PAGE_SIZE,
  AUDIT_PERIODI,
  isAuditEventType,
  type AuditEventRow,
  type AuditEventType,
  type AuditEventsResult,
  type AuditFiltri,
  type AuditPeriodo,
  type AuditStats,
  type AuditUtenteOption,
} from "./constants"

const TIMEZONE = "Europe/Rome"

/**
 * Mezzanotte di oggi a Roma, come istante UTC.
 *
 * Non si usa l'ora del server: su Vercel gira in UTC, e fra le 00:00 e le 02:00
 * italiane il giorno UTC e' ancora quello prima. Con `new Date()` grezzo gli
 * accessi delle prime ore del mattino finirebbero nel conteggio di ieri.
 */
function startOfDayRome(daysBack = 0): Date {
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now)

  const at = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const [y, m, d, hh, mm, ss] = [
    at("year"),
    at("month"),
    at("day"),
    at("hour") % 24,
    at("minute"),
    at("second"),
  ]

  // Scarto fra l'ora letta a Roma e l'istante reale = offset del fuso adesso
  // (gestisce da solo ora legale e solare). Il confronto e' al secondo perche'
  // le parti formattate non portano i millisecondi.
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm, ss)
  const offset = wallAsUtc - Math.floor(now.getTime() / 1000) * 1000
  const midnightWall = Date.UTC(y, m - 1, d - daysBack)
  return new Date(midnightWall - offset)
}

/** Estremo inferiore del periodo, o null per "tutto lo storico". */
function periodoFrom(periodo: AuditPeriodo): Date | null {
  const found = AUDIT_PERIODI.find((p) => p.id === periodo)
  if (!found || found.giorni === null) return null
  return startOfDayRome(found.giorni - 1)
}

/**
 * `%` e `_` sono metacaratteri di LIKE: senza escape una ricerca per "50%"
 * corrisponderebbe a qualsiasi cosa inizi con 50. Le virgole vanno tolte perche'
 * separano i termini nella sintassi dei filtri PostgREST.
 */
function sanitizeSearch(raw: string): string {
  return raw.trim().replace(/[%_\\]/g, (ch) => `\\${ch}`).replace(/[,()]/g, " ")
}

/**
 * Le 4 metriche di testa, tutte sulla giornata odierna. Sono COUNT senza
 * payload (`head: true`), quindi Postgres non trasferisce righe: quattro
 * conteggi sull'indice idx_audit_log_created.
 */
export async function loadAuditStats(): Promise<{ stats: AuditStats; error: string | null }> {
  const supabase = await createClient()
  const oggi = startOfDayRome().toISOString()

  const conta = async (tipo: AuditEventType) => {
    const { count, error } = await supabase
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("tipo_evento", tipo)
      .gte("created_at", oggi)
    return { count: count ?? 0, error }
  }

  const [accessi, modifiche, falliti, admin] = await Promise.all([
    conta("accesso"),
    conta("modifica_record"),
    conta("login_fallito"),
    conta("operazione_admin"),
  ])

  const error =
    accessi.error ?? modifiche.error ?? falliti.error ?? admin.error ?? null

  return {
    stats: {
      accessiOggi: accessi.count,
      modificheRecord: modifiche.count,
      loginFalliti: falliti.count,
      operazioniAdmin: admin.count,
    },
    error: error?.message ?? null,
  }
}

type RawRow = Omit<AuditEventRow, "utente_nome" | "tipo_evento" | "esito"> & {
  utente_nome: string | null
  tipo_evento: string
  esito: string | null
  utenti: { nome: string | null } | { nome: string | null }[] | null
}

/** Nome corrente dell'utente se esiste ancora, altrimenti l'istantanea salvata. */
function resolveNome(row: RawRow): string | null {
  const joined = Array.isArray(row.utenti) ? row.utenti[0] : row.utenti
  return joined?.nome ?? row.utente_nome ?? null
}

/** Pagina di eventi con i filtri applicati lato database. */
export async function loadAuditEvents(filtri: AuditFiltri): Promise<AuditEventsResult> {
  const supabase = await createClient()
  const page = Math.max(1, Math.floor(filtri.page) || 1)

  let query = supabase
    .from("audit_log")
    .select(
      "id, created_at, utente_id, utente_nome, tipo_evento, modulo, record_id, descrizione, ip_address, esito, dati_prima, dati_dopo, utenti(nome)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })

  const from = periodoFrom(filtri.periodo)
  if (from) query = query.gte("created_at", from.toISOString())
  if (filtri.tipo !== "all") query = query.eq("tipo_evento", filtri.tipo)
  if (filtri.utenteId !== "all") query = query.eq("utente_id", filtri.utenteId)

  const search = sanitizeSearch(filtri.search)
  if (search) query = query.ilike("descrizione", `%${search}%`)

  const offset = (page - 1) * AUDIT_PAGE_SIZE
  const { data, count, error } = await query.range(offset, offset + AUDIT_PAGE_SIZE - 1)

  if (error) {
    return { rows: [], total: 0, page, totalPages: 1, error: error.message }
  }

  const total = count ?? 0
  const rows: AuditEventRow[] = ((data ?? []) as unknown as RawRow[])
    // Una riga con un tipo fuori vocabolario non e' rappresentabile in UI: il
    // CHECK del database la rende impossibile, ma non ci fidiamo sulla lettura.
    .filter((row) => isAuditEventType(row.tipo_evento))
    .map((row) => ({
      id: row.id,
      created_at: row.created_at,
      utente_id: row.utente_id,
      utente_nome: resolveNome(row),
      tipo_evento: row.tipo_evento as AuditEventType,
      modulo: row.modulo,
      record_id: row.record_id,
      descrizione: row.descrizione,
      ip_address: row.ip_address,
      esito: row.esito === "failed" ? "failed" : "success",
      dati_prima: row.dati_prima,
      dati_dopo: row.dati_dopo,
    }))

  return {
    rows,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
    error: null,
  }
}

/** Elenco per la tendina "utente". */
export async function loadAuditUtenti(): Promise<AuditUtenteOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("utenti")
    .select("id, nome")
    .order("nome")

  if (error) return []
  return ((data ?? []) as { id: string; nome: string | null }[])
    .filter((u): u is { id: string; nome: string } => Boolean(u.nome))
    .map((u) => ({ id: u.id, nome: u.nome }))
}

