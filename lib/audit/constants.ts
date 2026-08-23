// Vocabolario condiviso dell'audit log.
//
// I due elenchi qui sotto NON sono una convenzione applicativa: ricalcano
// alla lettera i CHECK constraint gia' presenti su public.audit_log
//
//   audit_log_tipo_evento_check  tipo_evento IN (accesso, modifica_record,
//                                login_fallito, operazione_admin, export_dati,
//                                eliminazione)
//   audit_log_esito_check        esito IN (success, failed)
//
// Scrivere un valore fuori da questi insiemi fa fallire l'INSERT lato Postgres,
// quindi writer e lettore devono partire dalla stessa lista: e' questo file.
// Le etichette italiane restano solo di presentazione — nel database viaggiano
// sempre gli slug.

export const AUDIT_EVENT_TYPES = [
  "accesso",
  "modifica_record",
  "login_fallito",
  "operazione_admin",
  "export_dati",
  "eliminazione",
] as const

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number]

export const AUDIT_ESITI = ["success", "failed"] as const

export type AuditEsito = (typeof AUDIT_ESITI)[number]

export function isAuditEventType(value: unknown): value is AuditEventType {
  return (
    typeof value === "string" &&
    (AUDIT_EVENT_TYPES as readonly string[]).includes(value)
  )
}

/** Etichetta leggibile per tipo evento (solo UI: nel DB resta lo slug). */
export const AUDIT_EVENT_LABEL: Record<AuditEventType, string> = {
  accesso: "Accesso",
  modifica_record: "Modifica record",
  login_fallito: "Login fallito",
  operazione_admin: "Operazione admin",
  export_dati: "Export dati",
  eliminazione: "Eliminazione",
}

/**
 * Categoria cromatica per tipo evento. Guida sia il bordo sinistro delle stat
 * card sia il badge in tabella, cosi' lo stesso concetto ha lo stesso colore
 * nei due punti in cui compare.
 */
export type AuditTone = "accesso" | "modifica" | "admin" | "fallito" | "neutro"

export const AUDIT_EVENT_TONE: Record<AuditEventType, AuditTone> = {
  accesso: "accesso",
  modifica_record: "modifica",
  login_fallito: "fallito",
  operazione_admin: "admin",
  export_dati: "neutro",
  eliminazione: "fallito",
}

/** Modulo di provenienza dell'evento, usato per il campo `modulo`. */
export type AuditModulo =
  | "auth"
  | "lead"
  | "cliente"
  | "utenti"
  | "permessi"
  | "compito"
  | "installatore"

// --- Contratto condiviso client/server --------------------------------------
// Questi valori servono anche al componente client. Devono stare qui e non in
// queries.ts: quel modulo importa il client Supabase server-side, che a sua
// volta importa next/headers — trascinarlo nel bundle del browser fa fallire
// la build.

export const AUDIT_PAGE_SIZE = 20

export const AUDIT_PERIODI = [
  { id: "oggi", label: "Oggi", giorni: 1 },
  { id: "7g", label: "Ultimi 7 giorni", giorni: 7 },
  { id: "mese", label: "Ultimo mese", giorni: 30 },
  { id: "tutto", label: "Tutto lo storico", giorni: null },
] as const

export type AuditPeriodo = (typeof AUDIT_PERIODI)[number]["id"]

export function isAuditPeriodo(value: unknown): value is AuditPeriodo {
  return AUDIT_PERIODI.some((p) => p.id === value)
}

export interface AuditEventRow {
  id: string
  created_at: string
  utente_id: string | null
  /** Nome gia' risolto: join su utenti, poi istantanea, poi null. */
  utente_nome: string | null
  tipo_evento: AuditEventType
  modulo: string | null
  record_id: string | null
  descrizione: string
  ip_address: string | null
  esito: AuditEsito
  dati_prima: unknown
  dati_dopo: unknown
}

export interface AuditFiltri {
  periodo: AuditPeriodo
  tipo: AuditEventType | "all"
  utenteId: string | "all"
  search: string
  page: number
}

export interface AuditStats {
  accessiOggi: number
  modificheRecord: number
  loginFalliti: number
  operazioniAdmin: number
}

export interface AuditEventsResult {
  rows: AuditEventRow[]
  total: number
  page: number
  totalPages: number
  error: string | null
}

export interface AuditUtenteOption {
  id: string
  nome: string
}
