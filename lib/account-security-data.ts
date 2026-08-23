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
// I dati mock dell'audit sono stati rimossi: la pagina
// /crm-settings/account/audit legge da public.audit_log. Il vocabolario dei
// tipi evento vive in lib/audit/constants.ts, allineato ai CHECK constraint
// della tabella.

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
