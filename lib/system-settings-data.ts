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

export const MODULI_VALORI = ["Lead", "Clienti", "Compiti", "Scadenze", "Installatori"] as const
export type ModuloValori = (typeof MODULI_VALORI)[number]

export const valoriPerModulo: Record<ModuloValori, CampoValori[]> = {
  Lead: [
    {
      campo: "stato_lead",
      etichetta: "Stato lead",
      valori: [
        { id: "st_1", etichetta: "Non contattato", colore: "#94a3b8" },
        { id: "st_2", etichetta: "Tentato di contattare", colore: "#f59e0b" },
        { id: "st_3", etichetta: "Contattato", colore: "#16a34a" },
        { id: "st_4", etichetta: "Inviato Preventivo", colore: "#3b82f6" },
        { id: "st_5", etichetta: "Convertito", colore: "#2e8b72" },
        { id: "st_6", etichetta: "Perso", colore: "#dc2626" },
      ],
    },
    {
      campo: "origine_lead",
      etichetta: "Origine lead",
      valori: [
        { id: "fo_1", etichetta: "Facebook", colore: "#3b82f6" },
        { id: "fo_2", etichetta: "Pubblicità", colore: "#f59e0b" },
        { id: "fo_3", etichetta: "Sito web", colore: "#2e8b72" },
        { id: "fo_4", etichetta: "Chat", colore: "#3b82f6" },
        { id: "fo_5", etichetta: "Configuratore WebSite", colore: "#2e8b72" },
        { id: "fo_6", etichetta: "Manuale", colore: "#94a3b8" },
        { id: "fo_7", etichetta: "Utenza di servizio", colore: "#1e3a5f" },
      ],
    },
    {
      campo: "sede",
      etichetta: "Sede",
      valori: [
        { id: "se_1", etichetta: "Catania", colore: "#3b82f6" },
        { id: "se_2", etichetta: "Giarre (CT)", colore: "#2e8b72" },
        { id: "se_3", etichetta: "Treviso", colore: "#8b5cf6" },
        { id: "se_4", etichetta: "Torino", colore: "#f59e0b" },
        { id: "se_5", etichetta: "Porto Sant'Elpidio", colore: "#94a3b8" },
      ],
    },
  ],
  Clienti: [
    {
      campo: "sede",
      etichetta: "Sede",
      valori: [
        { id: "cl_se_1", etichetta: "Catania", colore: "#3b82f6" },
        { id: "cl_se_2", etichetta: "Giarre (CT)", colore: "#2e8b72" },
        { id: "cl_se_3", etichetta: "Treviso", colore: "#8b5cf6" },
        { id: "cl_se_4", etichetta: "Torino", colore: "#f59e0b" },
        { id: "cl_se_5", etichetta: "Porto Sant'Elpidio", colore: "#94a3b8" },
      ],
    },
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
