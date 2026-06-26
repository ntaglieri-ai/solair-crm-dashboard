// ============================================================================
// Account & Security — dati mock per le 4 pagine /crm-settings/account/*.
// Statici, nessuna chiamata API. Stato gestito lato client nei componenti.
// ============================================================================

import type { UserRole } from "./mock-data"

// --- Account Management -----------------------------------------------------

export interface AccountUser {
  id: string
  nome: string
  iniziali: string
  email: string
  ruolo: UserRole
  sede: string
  ultimoAccesso: string
  creato: string
  attivo: boolean
}

export const accountUsers: AccountUser[] = [
  { id: "u1", nome: "Nando Taglieri", iniziali: "NT", email: "nando@mostagstudio.it", ruolo: "admin", sede: "Mostag Studio", ultimoAccesso: "Oggi 09:14", creato: "12/01/2024", attivo: true },
  { id: "u2", nome: "Gaetano Grasso", iniziali: "GG", email: "g.grasso@solairgroup.it", ruolo: "commerciale", sede: "Catania", ultimoAccesso: "Oggi 08:45", creato: "03/02/2024", attivo: true },
  { id: "u3", nome: "Mariarosa De Leo", iniziali: "MD", email: "m.deleo@solairgroup.it", ruolo: "commerciale", sede: "Treviso", ultimoAccesso: "Ieri 17:30", creato: "03/02/2024", attivo: true },
  { id: "u4", nome: "Ivan Lo Faro", iniziali: "IL", email: "i.lofaro@solairgroup.it", ruolo: "commerciale", sede: "Catania", ultimoAccesso: "Ieri 16:00", creato: "18/03/2024", attivo: true },
  { id: "u5", nome: "Fabio Tizi", iniziali: "FT", email: "f.tizi@solairgroup.it", ruolo: "commerciale", sede: "Treviso", ultimoAccesso: "2 giorni fa", creato: "18/03/2024", attivo: true },
  { id: "u6", nome: "Cristian Virzi", iniziali: "CV", email: "c.virzi@solairgroup.it", ruolo: "commerciale", sede: "Catania", ultimoAccesso: "15 giorni fa", creato: "05/04/2024", attivo: false },
  { id: "u7", nome: "Filippo Ferrara", iniziali: "FF", email: "f.ferrara@solairgroup.it", ruolo: "commerciale", sede: "Treviso", ultimoAccesso: "3 giorni fa", creato: "05/04/2024", attivo: true },
  { id: "u8", nome: "Gianluca Silvestro", iniziali: "GS", email: "g.silvestro@solairgroup.it", ruolo: "commerciale", sede: "Torino", ultimoAccesso: "Oggi 10:02", creato: "20/05/2024", attivo: true },
  { id: "u9", nome: "Vito Ragaglia", iniziali: "VR", email: "v.ragaglia@solairgroup.it", ruolo: "admin", sede: "Treviso", ultimoAccesso: "Oggi 07:58", creato: "20/05/2024", attivo: true },
]

export const ACCOUNT_SEDI = ["Catania", "Treviso", "Torino", "Porto Sant'Elpidio"]

// --- Audit & Log ------------------------------------------------------------

export type AuditEsito = "success" | "failed"

export type AuditEventType =
  | "Accesso"
  | "Modifica record"
  | "Login fallito"
  | "Operazione admin"
  | "Export dati"

export const AUDIT_EVENT_TYPES: AuditEventType[] = [
  "Accesso",
  "Modifica record",
  "Login fallito",
  "Operazione admin",
  "Export dati",
]

/** Classi badge per tipo evento (accenti tenui leggibili). */
export const AUDIT_TYPE_BADGE: Record<AuditEventType, string> = {
  Accesso: "bg-blue-100 text-blue-700",
  "Modifica record": "bg-teal/15 text-teal",
  "Login fallito": "bg-red-100 text-red-700",
  "Operazione admin": "bg-orange-100 text-orange-700",
  "Export dati": "bg-purple-100 text-purple-700",
}

export interface AuditLogEvent {
  id: string
  ts: string
  utente: string
  tipo: AuditEventType
  desc: string
  ip: string
  esito: AuditEsito
}

export const auditLogs: AuditLogEvent[] = [
  { id: "l1", ts: "Oggi 10:14:32", utente: "Gaetano Grasso", tipo: "Modifica record", desc: "Lead #042 Mario Bianchi — stato cambiato da 'Nuovo' a 'In trattativa'", ip: "93.44.12.8", esito: "success" },
  { id: "l2", ts: "Oggi 09:58:11", utente: "Nando Taglieri", tipo: "Operazione admin", desc: "Ruolo 'Commerciale' aggiornato — rimosso permesso Export", ip: "185.12.44.2", esito: "success" },
  { id: "l3", ts: "Oggi 09:14:03", utente: "Nando Taglieri", tipo: "Accesso", desc: "Login effettuato", ip: "185.12.44.2", esito: "success" },
  { id: "l4", ts: "Oggi 08:45:17", utente: "Gaetano Grasso", tipo: "Accesso", desc: "Login effettuato", ip: "93.44.12.8", esito: "success" },
  { id: "l5", ts: "Ieri 23:12:44", utente: "unknown", tipo: "Login fallito", desc: "Tentativo di accesso con email g.grasso@solairgroup.it", ip: "45.33.89.201", esito: "failed" },
  { id: "l6", ts: "Ieri 22:58:02", utente: "unknown", tipo: "Login fallito", desc: "Tentativo di accesso con email admin@solairgroup.it", ip: "45.33.89.201", esito: "failed" },
  { id: "l7", ts: "Ieri 17:30:00", utente: "Mariarosa De Leo", tipo: "Modifica record", desc: "Cliente #018 Russo Andrea — indirizzo aggiornato", ip: "79.22.108.3", esito: "success" },
  { id: "l8", ts: "Ieri 16:00:22", utente: "Ivan Lo Faro", tipo: "Export dati", desc: "Export CSV Lead — 34 record esportati", ip: "93.44.15.9", esito: "success" },
  { id: "l9", ts: "Ieri 15:42:10", utente: "Gianluca Silvestro", tipo: "Modifica record", desc: "Compito #210 — priorità cambiata da 'Media' a 'Alta'", ip: "94.32.7.21", esito: "success" },
  { id: "l10", ts: "Ieri 14:05:58", utente: "Fabio Tizi", tipo: "Modifica record", desc: "Lead #051 Anna Verde — proprietario assegnato", ip: "79.22.110.5", esito: "success" },
  { id: "l11", ts: "Ieri 11:20:33", utente: "Nando Taglieri", tipo: "Operazione admin", desc: "Nuovo account creato — Filippo Ferrara", ip: "185.12.44.2", esito: "success" },
  { id: "l12", ts: "Ieri 09:02:14", utente: "Mariarosa De Leo", tipo: "Accesso", desc: "Login effettuato", ip: "79.22.108.3", esito: "success" },
  { id: "l13", ts: "2 giorni fa 18:44:09", utente: "unknown", tipo: "Login fallito", desc: "Tentativo di accesso con email f.tizi@solairgroup.it", ip: "201.55.3.90", esito: "failed" },
  { id: "l14", ts: "2 giorni fa 16:30:51", utente: "Ivan Lo Faro", tipo: "Export dati", desc: "Export CSV Clienti — 58 record esportati", ip: "93.44.15.9", esito: "success" },
  { id: "l15", ts: "2 giorni fa 10:11:27", utente: "Gaetano Grasso", tipo: "Modifica record", desc: "Lead #038 Luca Neri — stato cambiato in 'Perso'", ip: "93.44.12.8", esito: "success" },
]

export const auditStats = {
  accessiOggi: 12,
  modificheRecord: 47,
  loginFalliti: 2,
  operazioniAdmin: 5,
}

// --- Session & Access -------------------------------------------------------

export interface ActiveSession {
  id: string
  utente: string
  iniziali: string
  browser: string
  os: string
  posizione: string
  inizio: string
  ultima: string
}

export const activeSessions: ActiveSession[] = [
  { id: "s1", utente: "Nando Taglieri", iniziali: "NT", browser: "Chrome 124", os: "macOS", posizione: "Milano, IT", inizio: "Oggi 09:14", ultima: "Pochi secondi fa" },
  { id: "s2", utente: "Gaetano Grasso", iniziali: "GG", browser: "Safari 17", os: "iPhone", posizione: "Catania, IT", inizio: "Oggi 08:45", ultima: "2 minuti fa" },
  { id: "s3", utente: "Gianluca Silvestro", iniziali: "GS", browser: "Edge 123", os: "Windows 11", posizione: "Torino, IT", inizio: "Oggi 10:02", ultima: "5 minuti fa" },
]

export interface BlockedIp {
  id: string
  ip: string
  motivo: string
  bloccato: string
}

export const blockedIps: BlockedIp[] = [
  { id: "ip1", ip: "45.33.89.201", motivo: "2 login falliti consecutivi", bloccato: "Ieri 23:12" },
]

export const SESSION_TIMEOUTS = ["30 min", "1 ora", "2 ore", "4 ore", "8 ore", "Mai"]
export const MAX_LOGIN_ATTEMPTS = ["3", "5", "10"]
