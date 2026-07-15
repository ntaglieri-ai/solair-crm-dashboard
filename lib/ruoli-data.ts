// ============================================================================
// Ruoli e permessi — dati mock per la sezione CRM Settings › Ruoli e permessi.
// Nessuna persistenza: lo stato è gestito lato client nei componenti.
// ============================================================================

import type { UserRole } from "./mock-data"

export type RuoloColore =
  | "navy"
  | "teal"
  | "gray"
  | "violet"
  | "amber"
  | "rose"

/** Colore associato a ciascun ruolo utente (allineato alle card ruolo). */
export const USER_ROLE_COLORE: Record<UserRole, RuoloColore> = {
  admin: "navy",
  commerciale: "teal",
  tecnico: "gray",
}

/** Pagine del CRM su cui si può concedere/negare la visibilità. */
export type PaginaId =
  | "dashboard"
  | "lead"
  | "clienti"
  | "compiti"
  | "scadenze"
  | "documenti"
  | "installatori"
  | "crm_settings"

export const PAGINE: { id: PaginaId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "lead", label: "Lead" },
  { id: "clienti", label: "Clienti" },
  { id: "compiti", label: "Compiti" },
  { id: "scadenze", label: "Scadenze" },
  { id: "documenti", label: "Documenti" },
  { id: "installatori", label: "Installatori" },
  { id: "crm_settings", label: "CRM Settings & Admin" },
]

/** Moduli su cui si configurano i permessi di record. */
export type ModuloRecordId = "lead" | "clienti" | "compiti" | "scadenze"

export const MODULI_RECORD: { id: ModuloRecordId; label: string }[] = [
  { id: "lead", label: "Lead" },
  { id: "clienti", label: "Clienti" },
  { id: "compiti", label: "Compiti" },
  { id: "scadenze", label: "Scadenze" },
]

/** Permessi atomici sui record. */
export type RecordPermesso = "view" | "create" | "edit" | "delete" | "export"

export const RECORD_PERMESSI: { id: RecordPermesso; label: string }[] = [
  { id: "view", label: "Visualizza" },
  { id: "create", label: "Crea" },
  { id: "edit", label: "Modifica" },
  { id: "delete", label: "Elimina" },
  { id: "export", label: "Esporta" },
]

export type VisibilitaScope = "all" | "own"

export interface RuoloPermessi {
  pagine: Record<PaginaId, boolean>
  record: Record<ModuloRecordId, RecordPermesso[]>
  visibilita_sedi: VisibilitaScope
  cartelle_nextcloud: VisibilitaScope
  riconfigurazioni: boolean
  azioni?: Record<string, boolean>
  scope_dati?: Record<string, string>
  campi?: Record<string, Record<string, string>>
}

export interface Ruolo {
  id: string
  code?: string | null
  nome: string
  descrizione: string
  colore: RuoloColore
  utenti: number
  permessi: RuoloPermessi
}

export const RUOLO_COLOR_CLASS: Record<RuoloColore, string> = {
  navy: "bg-navy text-navy-foreground",
  teal: "bg-teal text-teal-foreground",
  gray: "bg-muted text-muted-foreground",
  violet: "bg-violet-100 text-violet-800",
  amber: "bg-amber-100 text-amber-800",
  rose: "bg-rose-100 text-rose-800",
}

export const mockRuoli: Ruolo[] = [
  {
    id: "r1",
    nome: "Admin",
    descrizione: "Accesso completo a tutto il CRM e alle impostazioni",
    colore: "navy",
    utenti: 2,
    permessi: {
      pagine: {
        dashboard: true,
        lead: true,
        clienti: true,
        compiti: true,
        scadenze: true,
        documenti: true,
        installatori: true,
        crm_settings: true,
      },
      record: {
        lead: ["view", "create", "edit", "delete", "export"],
        clienti: ["view", "create", "edit", "delete", "export"],
        compiti: ["view", "create", "edit", "delete"],
        scadenze: ["view", "create", "edit", "delete"],
      },
      visibilita_sedi: "all",
      cartelle_nextcloud: "all",
      riconfigurazioni: true,
    },
  },
  {
    id: "r2",
    nome: "Commerciale",
    descrizione: "Gestione lead, clienti e attività commerciali",
    colore: "teal",
    utenti: 7,
    permessi: {
      pagine: {
        dashboard: true,
        lead: true,
        clienti: true,
        compiti: true,
        scadenze: true,
        documenti: true,
        installatori: false,
        crm_settings: false,
      },
      record: {
        lead: ["view", "create", "edit"],
        clienti: ["view", "create", "edit"],
        compiti: ["view", "create", "edit"],
        scadenze: ["view", "create"],
      },
      visibilita_sedi: "own",
      cartelle_nextcloud: "own",
      riconfigurazioni: false,
    },
  },
  {
    id: "r3",
    nome: "Tecnico",
    descrizione: "Accesso agli installatori e alle scadenze tecniche",
    colore: "gray",
    utenti: 0,
    permessi: {
      pagine: {
        dashboard: true,
        lead: false,
        clienti: false,
        compiti: true,
        scadenze: true,
        documenti: true,
        installatori: true,
        crm_settings: false,
      },
      record: {
        lead: [],
        clienti: [],
        compiti: ["view", "create", "edit"],
        scadenze: ["view", "create", "edit"],
      },
      visibilita_sedi: "own",
      cartelle_nextcloud: "own",
      riconfigurazioni: false,
    },
  },
]

/** Sedi disponibili per l'assegnazione utenti. */
export const SEDI_DISPONIBILI = [
  "Catania",
  "Giarre CT",
  "Treviso",
  "Torino",
  "Porto Sant'Elpidio",
  "Mostag Studio",
]

/**
 * Restituisce fino a 3 pill descrittive con le info chiave dei permessi,
 * usate nell'anteprima delle card ruolo.
 */
export function permessiHighlights(p: RuoloPermessi): string[] {
  const out: string[] = []
  out.push(p.visibilita_sedi === "all" ? "Tutte le sedi" : "Solo sede assegnata")
  const puoEsportare = Object.values(p.record).some((perms) =>
    perms.includes("export"),
  )
  out.push(puoEsportare ? "Può esportare" : "No export")
  out.push(
    p.pagine.crm_settings ? "Accesso CRM Settings & Admin" : "No CRM Settings & Admin",
  )
  return out
}
