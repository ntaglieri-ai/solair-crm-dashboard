import { CLIENTI_FIELD_OPTION_DEFINITIONS } from "@/lib/clienti/picklist-options"
import type { ColumnValueOption } from "@/lib/crm-settings/column-values"
import {
  LEAD_FIELD_OPTION_FALLBACKS,
  type LeadOptionColumn,
} from "@/lib/leads/field-options"
import { STATO_CLIENTE_VALUES } from "@/lib/mock-data"

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
  | "decimal"
  | "percent"
  | "date"
  | "datetime"
  | "boolean"
  | "select"
  | "multiselect"
  | "lookup"
  | "email"
  | "phone"
  | "url"
  | "currency"
  | "textarea"

export const CAMPO_TIPI: CampoTipo[] = [
  "text",
  "textarea",
  "number",
  "decimal",
  "currency",
  "percent",
  "date",
  "datetime",
  "boolean",
  "select",
  "multiselect",
  "lookup",
  "email",
  "phone",
  "url",
]

export const CAMPO_TIPO_LABEL: Record<CampoTipo, string> = {
  text: "Linea singola",
  textarea: "Multi-linea",
  number: "Numero",
  decimal: "Decimale",
  currency: "Valuta",
  percent: "Percentuale",
  date: "Data",
  datetime: "Data e ora",
  boolean: "Casella di controllo",
  select: "Elenco di selezione",
  multiselect: "Selezione multipla",
  lookup: "Ricerca",
  email: "Email",
  phone: "Telefono",
  url: "URL",
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

export const MODULI_VALORI = ["Lead", "Clienti", "Compiti", "Scadenze", "Installatori"] as const
export type ModuloValori = (typeof MODULI_VALORI)[number]

const DEFAULT_VALUE_COLORS = ["#3b82f6", "#2e8b72", "#f59e0b", "#dc2626", "#8b5cf6", "#94a3b8"]

function valoriDaOpzioni(prefix: string, opzioni: readonly ColumnValueOption[]) {
  return opzioni.map((opzione, index) => ({
    id: `${prefix}_${index + 1}`,
    etichetta: opzione.label,
    colore: opzione.color ?? DEFAULT_VALUE_COLORS[index % DEFAULT_VALUE_COLORS.length],
  }))
}

function campoValori(
  campo: string,
  etichetta: string,
  opzioni: readonly ColumnValueOption[],
  prefix: string,
): CampoValori {
  return {
    campo,
    etichetta,
    valori: valoriDaOpzioni(prefix, opzioni),
  }
}

const LEAD_VALUE_LABELS: Record<LeadOptionColumn, string> = {
  stato_lead: "Stato lead",
  origine_lead: "Origine lead",
  sede: "Sede",
  campaign_name: "Campagna",
  meta_ad_name: "Ad Meta",
  meta_adset_name: "Adset Meta",
  rating: "Valutazione",
  stato_email: "Stato e-mail",
  saluti: "Saluti",
  modalita_iscrizione_annullata: "Modalità iscrizione annullata",
  stato_arricchito: "Stato arricchito",
  modello_pannello: "Modello pannello",
}

const leadValueFields = Object.entries(LEAD_FIELD_OPTION_FALLBACKS)
  .filter(([, opzioni]) => opzioni.length > 0)
  .map(([campo, opzioni]) =>
    campoValori(
      campo,
      LEAD_VALUE_LABELS[campo as LeadOptionColumn],
      opzioni,
      `lead_${campo}`,
    ),
  )

const clientiValueFields = CLIENTI_FIELD_OPTION_DEFINITIONS.map((definition) =>
  campoValori(
    definition.column,
    definition.appField,
    definition.options,
    `clienti_${definition.column}`,
  ),
)

export const valoriPerModulo: Record<ModuloValori, CampoValori[]> = {
  Lead: leadValueFields,
  Clienti: [
    campoValori("sede", "Sede", LEAD_FIELD_OPTION_FALLBACKS.sede, "clienti_sede"),
    campoValori(
      "stato",
      "Stato",
      STATO_CLIENTE_VALUES.map((value) => ({ value, label: value })),
      "clienti_stato",
    ),
    ...clientiValueFields,
  ],
  Compiti: [
    {
      campo: "stato",
      etichetta: "Stato",
      valori: [
        { id: "cs_1", etichetta: "Non iniziato", colore: "#94a3b8" },
        { id: "cs_2", etichetta: "In corso", colore: "#3b82f6" },
        { id: "cs_3", etichetta: "Rinviato", colore: "#f59e0b" },
        { id: "cs_4", etichetta: "In attesa di input", colore: "#f59e0b" },
        { id: "cs_5", etichetta: "Completato", colore: "#16a34a" },
      ],
    },
    {
      campo: "priorita",
      etichetta: "Priorità",
      valori: [
        { id: "cp_1", etichetta: "Alto", colore: "#dc2626" },
        { id: "cp_2", etichetta: "Medio", colore: "#f59e0b" },
        { id: "cp_3", etichetta: "Basso", colore: "#94a3b8" },
      ],
    },
    {
      campo: "sede",
      etichetta: "Sede",
      valori: [
        { id: "cse_1", etichetta: "Catania", colore: "#3b82f6" },
        { id: "cse_2", etichetta: "Giarre (CT)", colore: "#2e8b72" },
        { id: "cse_3", etichetta: "Treviso", colore: "#8b5cf6" },
        { id: "cse_4", etichetta: "Torino", colore: "#f59e0b" },
        { id: "cse_5", etichetta: "Porto Sant'Elpidio", colore: "#94a3b8" },
      ],
    },
  ],
  Scadenze: [],
  Installatori: [
    {
      campo: "canale_preferito",
      etichetta: "Canale preferito",
      valori: [
        { id: "ic_1", etichetta: "Email", colore: "#3b82f6" },
        { id: "ic_2", etichetta: "WhatsApp", colore: "#16a34a" },
      ],
    },
  ],
}

// --- Sezione 7: Integrazione Make -------------------------------------------

export interface ScenarioMake {
  id: string
  nome: string
  webhook_url: string
  attivo: boolean
  ultimo_trigger: string | null
}

export const scenariIniziali: ScenarioMake[] = []

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
