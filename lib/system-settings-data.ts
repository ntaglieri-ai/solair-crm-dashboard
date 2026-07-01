import type { LucideIcon } from "lucide-react"
import {
  Building2,
  Settings2,
  ListFilter,
  GitBranch,
  Zap,
  ArrowLeftRight,
  Webhook,
  DatabaseBackup,
} from "lucide-react"

export interface SystemSectionLink {
  href: string
  label: string
  icon: LucideIcon
}

export const SYSTEM_SECTION_LINKS: SystemSectionLink[] = [
  { href: "/crm-settings/system/sedi", label: "Sedi", icon: Building2 },
  { href: "/crm-settings/system/attributi", label: "Campi personalizzati", icon: Settings2 },
  { href: "/crm-settings/system/valori", label: "Valori predefiniti", icon: ListFilter },
  { href: "/crm-settings/system/regole", label: "Regole di assegnazione", icon: GitBranch },
  { href: "/crm-settings/system/flussi", label: "Flussi di lavoro", icon: Zap },
  { href: "/crm-settings/system/import-export", label: "Import / Export", icon: ArrowLeftRight },
  { href: "/crm-settings/system/make", label: "Integrazione Make", icon: Webhook },
  { href: "/crm-settings/system/backup", label: "Backup", icon: DatabaseBackup },
]

// --- Sezione 1: Sedi --------------------------------------------------------

export interface SystemSede {
  id: string
  nome: string
  indirizzo: string
  attiva: boolean
  utenti: number
}

export const sediIniziali: SystemSede[] = []

// --- Sezione 2: Attributi record --------------------------------------------

export type CampoAccesso = "no_access" | "r" | "rw"

export type CampoTipo =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "boolean"
  | "select"
  | "multiselect"
  | "lookup"
  | "email"
  | "phone"
  | "currency"
  | "textarea"

export const CAMPO_TIPI: CampoTipo[] = [
  "text",
  "number",
  "date",
  "datetime",
  "boolean",
  "select",
  "multiselect",
  "lookup",
  "email",
  "phone",
  "currency",
  "textarea",
]

export const CAMPO_TIPO_LABEL: Record<CampoTipo, string> = {
  text: "Testo",
  number: "Numero",
  date: "Data",
  datetime: "Data e ora",
  boolean: "Booleano",
  select: "Select",
  multiselect: "Multi-select",
  lookup: "Lookup",
  email: "Email",
  phone: "Telefono",
  currency: "Valuta",
  textarea: "Testo lungo",
}

export const CAMPO_ACCESSO_LABEL: Record<CampoAccesso, string> = {
  no_access: "Nessun accesso",
  r: "Sola lettura",
  rw: "Lettura e scrittura",
}

export interface CampoRecord {
  nome: string
  etichetta: string
  tipo: CampoTipo
  obbligatorio: boolean
  visibile: boolean
  accesso_default: CampoAccesso
  sistema: boolean
}

export const MODULI_ATTRIBUTI = ["Lead", "Clienti", "Compiti", "Scadenze", "Installatori"] as const
export type ModuloAttributi = (typeof MODULI_ATTRIBUTI)[number]

export const campiPerModulo: Record<ModuloAttributi, CampoRecord[]> = {
  Lead: [
    { nome: "ragione_sociale", etichetta: "Nome / Ragione sociale", tipo: "text", obbligatorio: true, visibile: true, accesso_default: "rw", sistema: true },
    { nome: "email", etichetta: "Email", tipo: "email", obbligatorio: false, visibile: true, accesso_default: "rw", sistema: true },
    { nome: "telefono", etichetta: "Telefono", tipo: "phone", obbligatorio: true, visibile: true, accesso_default: "rw", sistema: true },
    { nome: "stato", etichetta: "Stato lead", tipo: "select", obbligatorio: true, visibile: true, accesso_default: "rw", sistema: true },
    { nome: "fonte", etichetta: "Fonte", tipo: "select", obbligatorio: false, visibile: true, accesso_default: "rw", sistema: true },
    { nome: "priorita", etichetta: "Priorità", tipo: "select", obbligatorio: false, visibile: true, accesso_default: "rw", sistema: false },
    { nome: "valore_stimato", etichetta: "Valore stimato (€)", tipo: "currency", obbligatorio: false, visibile: true, accesso_default: "r", sistema: false },
    { nome: "note", etichetta: "Note", tipo: "textarea", obbligatorio: false, visibile: true, accesso_default: "rw", sistema: false },
  ],
  Clienti: [
    { nome: "ragione_sociale", etichetta: "Ragione sociale", tipo: "text", obbligatorio: true, visibile: true, accesso_default: "rw", sistema: true },
    { nome: "partita_iva", etichetta: "Partita IVA", tipo: "text", obbligatorio: true, visibile: true, accesso_default: "rw", sistema: true },
    { nome: "email", etichetta: "Email", tipo: "email", obbligatorio: false, visibile: true, accesso_default: "rw", sistema: true },
    { nome: "referente", etichetta: "Referente", tipo: "text", obbligatorio: false, visibile: true, accesso_default: "rw", sistema: false },
  ],
  Compiti: [
    { nome: "titolo", etichetta: "Titolo", tipo: "text", obbligatorio: true, visibile: true, accesso_default: "rw", sistema: true },
    { nome: "priorita", etichetta: "Priorità", tipo: "select", obbligatorio: true, visibile: true, accesso_default: "rw", sistema: true },
    { nome: "scadenza", etichetta: "Scadenza", tipo: "datetime", obbligatorio: true, visibile: true, accesso_default: "rw", sistema: true },
  ],
  Scadenze: [
    { nome: "nome", etichetta: "Nome scadenza", tipo: "text", obbligatorio: true, visibile: true, accesso_default: "rw", sistema: true },
    { nome: "data", etichetta: "Data scadenza", tipo: "date", obbligatorio: true, visibile: true, accesso_default: "rw", sistema: true },
  ],
  Installatori: [
    { nome: "ragione_sociale", etichetta: "Ragione sociale", tipo: "text", obbligatorio: true, visibile: true, accesso_default: "rw", sistema: true },
    { nome: "partita_iva", etichetta: "Partita IVA", tipo: "text", obbligatorio: true, visibile: true, accesso_default: "rw", sistema: true },
    { nome: "zona", etichetta: "Zona operativa", tipo: "text", obbligatorio: false, visibile: true, accesso_default: "rw", sistema: false },
  ],
}

// --- Sezione 3: Valori configurabili ----------------------------------------

export interface ValoreConfig {
  id: string
  etichetta: string
  colore: string
}

export interface CampoValori {
  campo: string
  etichetta: string
  valori: ValoreConfig[]
}

export const MODULI_VALORI = ["Lead", "Clienti", "Compiti", "Scadenze"] as const
export type ModuloValori = (typeof MODULI_VALORI)[number]

export const valoriPerModulo: Record<ModuloValori, CampoValori[]> = {
  Lead: [
    {
      campo: "stato",
      etichetta: "Stato lead",
      valori: [
        { id: "st_1", etichetta: "Nuovo", colore: "#3b82f6" },
        { id: "st_2", etichetta: "Contattato", colore: "#3b82f6" },
        { id: "st_3", etichetta: "In trattativa", colore: "#f59e0b" },
        { id: "st_4", etichetta: "Chiuso vinto", colore: "#16a34a" },
        { id: "st_5", etichetta: "Chiuso perso", colore: "#dc2626" },
      ],
    },
    {
      campo: "fonte",
      etichetta: "Fonte",
      valori: [
        { id: "fo_1", etichetta: "Meta Ads", colore: "#3b82f6" },
        { id: "fo_2", etichetta: "Sito Web", colore: "#2e8b72" },
        { id: "fo_3", etichetta: "Passaparola", colore: "#8b5cf6" },
        { id: "fo_4", etichetta: "Altro", colore: "#94a3b8" },
      ],
    },
    {
      campo: "priorita",
      etichetta: "Priorità",
      valori: [
        { id: "pr_1", etichetta: "Alta", colore: "#dc2626" },
        { id: "pr_2", etichetta: "Media", colore: "#f59e0b" },
        { id: "pr_3", etichetta: "Bassa", colore: "#94a3b8" },
      ],
    },
  ],
  Clienti: [
    {
      campo: "tipo",
      etichetta: "Tipo cliente",
      valori: [
        { id: "tc_1", etichetta: "Privato", colore: "#3b82f6" },
        { id: "tc_2", etichetta: "Azienda", colore: "#2e8b72" },
      ],
    },
  ],
  Compiti: [
    {
      campo: "priorita",
      etichetta: "Priorità",
      valori: [
        { id: "cp_1", etichetta: "Alta", colore: "#dc2626" },
        { id: "cp_2", etichetta: "Media", colore: "#f59e0b" },
        { id: "cp_3", etichetta: "Bassa", colore: "#94a3b8" },
      ],
    },
  ],
  Scadenze: [
    {
      campo: "tipo",
      etichetta: "Tipo scadenza",
      valori: [
        { id: "sc_1", etichetta: "Pagamento", colore: "#16a34a" },
        { id: "sc_2", etichetta: "Documentale", colore: "#3b82f6" },
        { id: "sc_3", etichetta: "Manutenzione", colore: "#f59e0b" },
      ],
    },
  ],
}

// --- Sezione 4: Regole di assegnazione --------------------------------------

export interface RegolaCondizione {
  campo: string
  operatore: string
  valore: string
}

export interface RegolaAssegnazione {
  id: string
  nome: string
  attiva: boolean
  modulo: string
  condizioni: RegolaCondizione[]
  assegna_a: string
}

export const regoleIniziali: RegolaAssegnazione[] = [
  { id: "reg_001", nome: "Lead Catania → Gaetano", attiva: true, modulo: "lead", condizioni: [{ campo: "citta", operatore: "=", valore: "Catania" }], assegna_a: "Gaetano Grasso" },
  { id: "reg_002", nome: "Lead Treviso → Mariarosa", attiva: true, modulo: "lead", condizioni: [{ campo: "citta", operatore: "=", valore: "Treviso" }], assegna_a: "Mariarosa De Leo" },
  { id: "reg_003", nome: "Lead Torino → Gianluca", attiva: false, modulo: "lead", condizioni: [{ campo: "citta", operatore: "=", valore: "Torino" }], assegna_a: "Gianluca Silvestro" },
]

export const UTENTI_ASSEGNABILI = [
  "Gaetano Grasso",
  "Mariarosa De Leo",
  "Gianluca Silvestro",
  "Ivan Lo Faro",
  "Fabio Tizi",
  "Filippo Ferrara",
]

// --- Sezione 5: Flussi di lavoro --------------------------------------------

export type WorkflowTrigger = "creazione" | "modifica" | "data" | "manuale"

export const WORKFLOW_TRIGGER_LABEL: Record<WorkflowTrigger, string> = {
  creazione: "Creazione",
  modifica: "Modifica",
  data: "Data",
  manuale: "Manuale",
}

export interface Workflow {
  id: string
  nome: string
  attivo: boolean
  modulo: string
  trigger: WorkflowTrigger
  azioni: string[]
}

export const workflowsIniziali: Workflow[] = [
  { id: "wf_001", nome: "Notifica nuovo lead", attivo: true, modulo: "lead", trigger: "creazione", azioni: ["Invia notifica a proprietario"] },
  { id: "wf_002", nome: "Aggiorna stato cliente dopo firma", attivo: true, modulo: "lead", trigger: "modifica", azioni: ["Crea cliente", "Aggiorna stato lead → Chiuso vinto"] },
  { id: "wf_003", nome: "Promemoria scadenza 7gg", attivo: false, modulo: "scadenze", trigger: "data", azioni: ["Invia notifica a proprietario"] },
]

// --- Sezione 7: Integrazione Make -------------------------------------------

export interface ScenarioMake {
  id: string
  nome: string
  webhook_url: string
  attivo: boolean
  ultimo_trigger: string | null
}

export const scenariIniziali: ScenarioMake[] = [
  { id: "mk_001", nome: "Lead da Meta Ads", webhook_url: "https://hook.eu1.make.com/xxx", attivo: false, ultimo_trigger: null },
  { id: "mk_002", nome: "PDF + Firma digitale", webhook_url: "https://hook.eu1.make.com/yyy", attivo: true, ultimo_trigger: "2026-06-24T10:28:00Z" },
]

/** Formatta una data ISO come data relativa breve in italiano. */
export function formatRelativeIt(iso: string | null): string {
  if (!iso) return "Mai"
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffMs = now - then
  const min = Math.round(diffMs / 60000)
  if (min < 1) return "Adesso"
  if (min < 60) return `${min} min fa`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h fa`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} g fa`
  return new Date(iso).toLocaleDateString("it-IT")
}
