// ============================================================================
// CRM Settings › File Manager — dati mock (nessuna chiamata API).
// Stato gestito lato client nelle pagine. I ruoli storage sono dedicati a
// quest'area e indipendenti dai ruoli utente del resto del CRM.
// ============================================================================

export type StorageRoleColor = "red" | "navy" | "blue" | "teal" | "gray"

/** Mappa colore ruolo → classi token del design system. */
export const STORAGE_ROLE_CLASS: Record<StorageRoleColor, string> = {
  red: "bg-destructive/15 text-destructive",
  navy: "bg-navy text-navy-foreground",
  blue: "bg-info text-info-foreground",
  teal: "bg-teal text-teal-foreground",
  gray: "bg-muted text-muted-foreground",
}

/** Ordine e colore canonico di tutti i ruoli storage. */
export const STORAGE_ROLES: { nome: string; colore: StorageRoleColor }[] = [
  { nome: "Superadmin", colore: "red" },
  { nome: "Amministratore", colore: "navy" },
  { nome: "Direttore", colore: "blue" },
  { nome: "Standard", colore: "teal" },
  { nome: "Agente", colore: "gray" },
]

export function storageRoleColor(nome: string): StorageRoleColor {
  return STORAGE_ROLES.find((r) => r.nome === nome)?.colore ?? "gray"
}

// --- Connessione Nextcloud --------------------------------------------------

export const NEXTCLOUD_CONFIG = {
  url: "https://nx101824.your-storageshare.de",
  ultimoTest: "Oggi 09:14",
  serviceUsername: "crm-service@solairgroup",
}

// --- Struttura cartelle: template di percorso per modulo --------------------

export type CartellaVariabile =
  | "{id}"
  | "{cognome}"
  | "{nome}"
  | "{ragione_sociale}"
  | "{data}"
  | "{anno}"

export const CARTELLA_VARIABILI: CartellaVariabile[] = [
  "{id}",
  "{cognome}",
  "{nome}",
  "{ragione_sociale}",
  "{data}",
  "{anno}",
]

export interface PathTemplate {
  id: string
  modulo: "Lead" | "Clienti" | "Installatori"
  template: string
}

export const PATH_TEMPLATES: PathTemplate[] = [
  { id: "pt_lead", modulo: "Lead", template: "/Lead/{id}_{cognome}_{nome}/" },
  { id: "pt_clienti", modulo: "Clienti", template: "/Clienti/{id}_{ragione_sociale}/" },
  { id: "pt_inst", modulo: "Installatori", template: "/Installatori/{id}_{cognome}/" },
]

/** Valori di esempio usati per l'anteprima live dei template. */
const EXAMPLE_VALUES: Record<string, Record<string, string>> = {
  Lead: { "{id}": "042", "{cognome}": "Bianchi", "{nome}": "Mario", "{data}": "2026-06-27", "{anno}": "2026" },
  Clienti: { "{id}": "018", "{ragione_sociale}": "Ferrara_Antonio", "{data}": "2026-06-27", "{anno}": "2026" },
  Installatori: { "{id}": "003", "{cognome}": "Mancuso", "{nome}": "Carlo", "{data}": "2026-06-27", "{anno}": "2026" },
}

/** Sostituisce le variabili {..} con valori di esempio in base al modulo. */
export function previewPath(modulo: string, template: string): string {
  const values = EXAMPLE_VALUES[modulo] ?? {}
  return template.replace(/\{[a-z_]+\}/g, (m) => values[m] ?? m)
}

// --- Permessi storage per ruolo ---------------------------------------------

export type CartelleVisibili = "Tutte" | "Propri record" | "Nessuna"

export interface PermessoStorage {
  ruolo: string
  colore: StorageRoleColor
  cartelle: CartelleVisibili
  upload: boolean
  download: boolean
  elimina: boolean
  /** Superadmin non è modificabile. */
  locked?: boolean
}

export const PERMESSI_STORAGE: PermessoStorage[] = [
  { ruolo: "Superadmin", colore: "red", cartelle: "Tutte", upload: true, download: true, elimina: true, locked: true },
  { ruolo: "Amministratore", colore: "navy", cartelle: "Tutte", upload: true, download: true, elimina: true },
  { ruolo: "Direttore", colore: "blue", cartelle: "Tutte", upload: true, download: true, elimina: false },
  { ruolo: "Standard", colore: "teal", cartelle: "Propri record", upload: true, download: true, elimina: false },
  { ruolo: "Agente", colore: "gray", cartelle: "Propri record", upload: false, download: true, elimina: false },
]

export const CARTELLE_VISIBILI_OPTIONS: CartelleVisibili[] = [
  "Tutte",
  "Propri record",
  "Nessuna",
]

// --- Cartelle condivise -----------------------------------------------------

export type AccessoCartella = "r" | "rw"

export interface CartellaCondivisa {
  id: string
  nome: string
  path: string
  ruoli_accesso: string[]
  accesso: AccessoCartella
}

export const CARTELLE_CONDIVISE: CartellaCondivisa[] = [
  {
    id: "cc_001",
    nome: "Materiale commerciale",
    path: "/Condivise/MaterialeCommerciale/",
    ruoli_accesso: ["Superadmin", "Amministratore", "Direttore", "Standard", "Agente"],
    accesso: "r",
  },
  {
    id: "cc_002",
    nome: "Listini prezzi",
    path: "/Condivise/Listini/",
    ruoli_accesso: ["Superadmin", "Amministratore", "Direttore"],
    accesso: "rw",
  },
  {
    id: "cc_003",
    nome: "Contratti template",
    path: "/Condivise/ContrattiTemplate/",
    ruoli_accesso: ["Superadmin", "Amministratore"],
    accesso: "rw",
  },
  {
    id: "cc_004",
    nome: "Documentazione tecnica",
    path: "/Condivise/DocTecnica/",
    ruoli_accesso: ["Superadmin", "Amministratore", "Direttore"],
    accesso: "r",
  },
]
