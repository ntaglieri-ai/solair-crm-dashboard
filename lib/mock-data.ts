// ============================================================================
// Solair CRM — Dati mock tipizzati
// ----------------------------------------------------------------------------
// Tutti i dati statici dell'interfaccia vivono qui. I componenti importano solo
// da questo file. Per collegare Supabase in uno step successivo basta sostituire
// le funzioni `get*` con query reali, senza toccare i componenti.
// ============================================================================

// ----------------------------------------------------------------------------
// Tipi
// ----------------------------------------------------------------------------

export type SedeId =
  | "all"
  | "catania"
  | "giarre"
  | "treviso"
  | "torino"
  | "porto-sant-elpidio"

export interface Sede {
  id: SedeId
  label: string
}

export type LeadStatus =
  | "contattato"
  | "inviato-preventivo"
  | "tentato-contattare"
  | "non-contattato"

export interface Lead {
  id: string
  nome: string
  citta: string
  provincia: string
  configurazione: string
  origine: string
  status: LeadStatus
  score: number // 0-100
  sede: Exclude<SedeId, "all">
}

export type ClienteFase =
  | "nuovo-contratto"
  | "sopralluogo"
  | "iter-enel"
  | "merce-confermata"
  | "pagato-30"
  | "fattura-emessa"
  | "completato"

export interface Cliente {
  id: string
  nome: string
  fase: ClienteFase
}

export type FeedTipo =
  | "email-open"
  | "nuovo-lead"
  | "compito-scaduto"
  | "contratto-firmato"
  | "lead-fermo"
  | "conversione"

export interface FeedItem {
  id: string
  tipo: FeedTipo
  // testo con segmenti in grassetto evidenziati
  testo: string
  highlight: string[]
  timestamp: string
}

export interface KpiData {
  id: string
  label: string
  value: string
  badge: string
  badgeTone: "navy" | "success" | "warning" | "destructive" | "info"
  sottotesto: string
  icon: "users" | "flame" | "briefcase" | "alert"
  accent: "navy" | "success" | "info" | "destructive"
}

export interface MiniStat {
  id: string
  label: string
  value: string
}

export interface PipelineStage {
  fase: ClienteFase
  label: string
  count: number
  percent: number
  tone: "navy" | "teal" | "info" | "warning" | "success"
}

export interface MapMarker {
  id: string
  citta: string
  // posizione percentuale sulla mappa stilizzata (top/left)
  top: number
  left: number
  leadCount: number
  intensity: "caldo" | "medio" | "freddo"
}

// ----------------------------------------------------------------------------
// Sedi
// ----------------------------------------------------------------------------

export const SEDI: Sede[] = [
  { id: "all", label: "Tutte le sedi" },
  { id: "catania", label: "Catania" },
  { id: "giarre", label: "Giarre (CT)" },
  { id: "treviso", label: "Treviso" },
  { id: "torino", label: "Torino" },
  { id: "porto-sant-elpidio", label: "Porto Sant'Elpidio" },
]

// ----------------------------------------------------------------------------
// Etichette stato lead
// ----------------------------------------------------------------------------

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  contattato: "Contattato",
  "inviato-preventivo": "Inviato preventivo",
  "tentato-contattare": "Tentato contattare",
  "non-contattato": "Non contattato",
}

export const LEAD_STATUS_TONE: Record<
  LeadStatus,
  "success" | "info" | "warning" | "muted"
> = {
  contattato: "success",
  "inviato-preventivo": "info",
  "tentato-contattare": "warning",
  "non-contattato": "muted",
}

// ----------------------------------------------------------------------------
// KPI (per sede)
// ----------------------------------------------------------------------------

const KPI_ALL: KpiData[] = [
  {
    id: "lead-totali",
    label: "Lead totali",
    value: "9.003",
    badge: "+47 sett.",
    badgeTone: "navy",
    sottotesto: "da Facebook e campagne",
    icon: "users",
    accent: "navy",
  },
  {
    id: "lead-caldi",
    label: "Lead caldi oggi",
    value: "8",
    badge: "live",
    badgeTone: "success",
    sottotesto: "email aperta nelle ultime 24h",
    icon: "flame",
    accent: "success",
  },
  {
    id: "clienti",
    label: "Clienti",
    value: "10",
    badge: "3 attivi",
    badgeTone: "info",
    sottotesto: "3 in fase sopralluogo",
    icon: "briefcase",
    accent: "info",
  },
  {
    id: "compiti-scaduti",
    label: "Compiti scaduti",
    value: "5",
    badge: "urgente",
    badgeTone: "destructive",
    sottotesto: "da gestire oggi",
    icon: "alert",
    accent: "destructive",
  },
]

const KPI_BY_SEDE: Partial<Record<SedeId, KpiData[]>> = {
  catania: [
    { ...KPI_ALL[0], value: "3.412", badge: "+18 sett." },
    { ...KPI_ALL[1], value: "4" },
    { ...KPI_ALL[2], value: "4", badge: "2 attivi", sottotesto: "1 in fase sopralluogo" },
    { ...KPI_ALL[3], value: "2", sottotesto: "da gestire oggi" },
  ],
  giarre: [
    { ...KPI_ALL[0], value: "1.205", badge: "+9 sett." },
    { ...KPI_ALL[1], value: "1" },
    { ...KPI_ALL[2], value: "2", badge: "1 attivo", sottotesto: "1 in fase sopralluogo" },
    { ...KPI_ALL[3], value: "1", sottotesto: "da gestire oggi" },
  ],
  treviso: [
    { ...KPI_ALL[0], value: "2.118", badge: "+11 sett." },
    { ...KPI_ALL[1], value: "2" },
    { ...KPI_ALL[2], value: "2", badge: "0 attivi", sottotesto: "1 in fase sopralluogo" },
    { ...KPI_ALL[3], value: "1", sottotesto: "da gestire oggi" },
  ],
  torino: [
    { ...KPI_ALL[0], value: "1.456", badge: "+6 sett." },
    { ...KPI_ALL[1], value: "1" },
    { ...KPI_ALL[2], value: "1", badge: "1 attivo", sottotesto: "0 in fase sopralluogo" },
    { ...KPI_ALL[3], value: "1", sottotesto: "da gestire oggi" },
  ],
  "porto-sant-elpidio": [
    { ...KPI_ALL[0], value: "812", badge: "+3 sett." },
    { ...KPI_ALL[1], value: "0" },
    { ...KPI_ALL[2], value: "1", badge: "0 attivi", sottotesto: "0 in fase sopralluogo" },
    { ...KPI_ALL[3], value: "0", sottotesto: "nessuno oggi" },
  ],
}

// ----------------------------------------------------------------------------
// Mini stats (per sede)
// ----------------------------------------------------------------------------

const MINI_ALL: MiniStat[] = [
  { id: "conversione", label: "Tasso conversione lead → cliente", value: "2,1%" },
  { id: "sopralluoghi", label: "Sopralluoghi in agenda", value: "3" },
  { id: "fermi", label: "Lead fermi da più di 7 giorni", value: "7" },
]

const MINI_BY_SEDE: Partial<Record<SedeId, MiniStat[]>> = {
  catania: [
    { id: "conversione", label: "Tasso conversione lead → cliente", value: "2,6%" },
    { id: "sopralluoghi", label: "Sopralluoghi in agenda", value: "2" },
    { id: "fermi", label: "Lead fermi da più di 7 giorni", value: "3" },
  ],
  giarre: [
    { id: "conversione", label: "Tasso conversione lead → cliente", value: "1,9%" },
    { id: "sopralluoghi", label: "Sopralluoghi in agenda", value: "0" },
    { id: "fermi", label: "Lead fermi da più di 7 giorni", value: "1" },
  ],
  treviso: [
    { id: "conversione", label: "Tasso conversione lead → cliente", value: "2,3%" },
    { id: "sopralluoghi", label: "Sopralluoghi in agenda", value: "1" },
    { id: "fermi", label: "Lead fermi da più di 7 giorni", value: "2" },
  ],
  torino: [
    { id: "conversione", label: "Tasso conversione lead → cliente", value: "1,7%" },
    { id: "sopralluoghi", label: "Sopralluoghi in agenda", value: "0" },
    { id: "fermi", label: "Lead fermi da più di 7 giorni", value: "1" },
  ],
  "porto-sant-elpidio": [
    { id: "conversione", label: "Tasso conversione lead → cliente", value: "1,2%" },
    { id: "sopralluoghi", label: "Sopralluoghi in agenda", value: "0" },
    { id: "fermi", label: "Lead fermi da più di 7 giorni", value: "0" },
  ],
}

// ----------------------------------------------------------------------------
// Lead caldi
// ----------------------------------------------------------------------------

export const LEADS: Lead[] = [
  {
    id: "lead-1",
    nome: "Niccolò Leo",
    citta: "Zevio",
    provincia: "VR",
    configurazione: "9+21,2 Sineng",
    origine: "Facebook",
    status: "contattato",
    score: 94,
    sede: "treviso",
  },
  {
    id: "lead-2",
    nome: "Giuseppe Giacalone",
    citta: "Palermo",
    provincia: "PA",
    configurazione: "9kWp+32kWh",
    origine: "Facebook",
    status: "inviato-preventivo",
    score: 87,
    sede: "catania",
  },
  {
    id: "lead-3",
    nome: "Antonio Scarpinato",
    citta: "Gela",
    provincia: "CL",
    configurazione: "7+20 solis",
    origine: "Facebook",
    status: "tentato-contattare",
    score: 71,
    sede: "catania",
  },
  {
    id: "lead-4",
    nome: "Nicola Mancuso",
    citta: "Nissoria",
    provincia: "EN",
    configurazione: "Modulo SEI",
    origine: "Pubblicità",
    status: "non-contattato",
    score: 58,
    sede: "giarre",
  },
  {
    id: "lead-5",
    nome: "Luca Benini",
    citta: "Ravenna",
    provincia: "RA",
    configurazione: "7+20 Solis",
    origine: "Facebook",
    status: "non-contattato",
    score: 42,
    sede: "treviso",
  },
]

// ----------------------------------------------------------------------------
// Clienti / Pipeline
// ----------------------------------------------------------------------------

export const PIPELINE: PipelineStage[] = [
  { fase: "nuovo-contratto", label: "Nuovo contratto", count: 6, percent: 60, tone: "navy" },
  { fase: "sopralluogo", label: "Sopralluogo", count: 3, percent: 30, tone: "info" },
  { fase: "iter-enel", label: "Iter ENEL", count: 2, percent: 20, tone: "teal" },
  { fase: "merce-confermata", label: "Merce confermata", count: 1, percent: 10, tone: "teal" },
  { fase: "pagato-30", label: "Pagato 30%", count: 1, percent: 10, tone: "warning" },
  { fase: "fattura-emessa", label: "Fattura emessa", count: 1, percent: 10, tone: "warning" },
  { fase: "completato", label: "Completato", count: 0, percent: 0, tone: "success" },
]

// ----------------------------------------------------------------------------
// Feed live
// ----------------------------------------------------------------------------

export const FEED: FeedItem[] = [
  {
    id: "feed-1",
    tipo: "email-open",
    testo: "Niccolò Leo ha aperto la mail del preventivo — 2 volte",
    highlight: ["Niccolò Leo"],
    timestamp: "Oggi 07:08",
  },
  {
    id: "feed-2",
    tipo: "nuovo-lead",
    testo: "Nuovo lead da Facebook — 9kWp Palermo",
    highlight: ["9kWp Palermo"],
    timestamp: "Oggi 06:53",
  },
  {
    id: "feed-3",
    tipo: "compito-scaduto",
    testo: "Compito scaduto: richiamare Andrea Cocita",
    highlight: ["Andrea Cocita"],
    timestamp: "Ieri 16:06",
  },
  {
    id: "feed-4",
    tipo: "contratto-firmato",
    testo: "Gianluca Piccioni ha firmato il contratto",
    highlight: ["Gianluca Piccioni"],
    timestamp: "Ieri 10:44",
  },
  {
    id: "feed-5",
    tipo: "lead-fermo",
    testo: "Lead fermo da 8 giorni: Francesco Esposito",
    highlight: ["Francesco Esposito"],
    timestamp: "4 Giu",
  },
  {
    id: "feed-6",
    tipo: "email-open",
    testo: "Adelaide Vogliotti ha aperto la mail del sopralluogo",
    highlight: ["Adelaide Vogliotti"],
    timestamp: "3 Giu",
  },
  {
    id: "feed-7",
    tipo: "conversione",
    testo: "Luca Mantovani convertito a cliente",
    highlight: ["Luca Mantovani"],
    timestamp: "30 Mag",
  },
]

// ----------------------------------------------------------------------------
// Mappa sedi Solair
// ----------------------------------------------------------------------------

export const MAP_MARKERS: MapMarker[] = [
  { id: "torino", citta: "Torino", top: 24, left: 18, leadCount: 12, intensity: "medio" },
  { id: "treviso", citta: "Treviso", top: 22, left: 44, leadCount: 23, intensity: "caldo" },
  { id: "porto", citta: "Porto Sant'Elpidio", top: 47, left: 52, leadCount: 8, intensity: "freddo" },
  { id: "catania", citta: "Catania", top: 84, left: 60, leadCount: 31, intensity: "caldo" },
  { id: "giarre", citta: "Giarre (CT)", top: 80, left: 64, leadCount: 9, intensity: "medio" },
]

// ----------------------------------------------------------------------------
// Navigazione sidebar
// ----------------------------------------------------------------------------

export interface NavItem {
  label: string
  href: string
  icon:
    | "dashboard"
    | "leads"
    | "clienti"
    | "compiti"
    | "scadenze"
    | "documenti"
    | "installatori"
    | "impostazioni"
  badge?: { count: number; tone: "destructive" | "muted" }
  active?: boolean
}

export const NAV_PRINCIPALE: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "dashboard", active: true },
  { label: "Lead", href: "/lead", icon: "leads", badge: { count: 9, tone: "destructive" } },
  { label: "Clienti", href: "/clienti", icon: "clienti" },
  { label: "Compiti", href: "/compiti", icon: "compiti", badge: { count: 5, tone: "muted" } },
]

export const NAV_GESTIONE: NavItem[] = [
  { label: "Scadenze", href: "/scadenze", icon: "scadenze" },
  { label: "Documenti", href: "/documenti", icon: "documenti" },
  { label: "Installatori", href: "/installatori", icon: "installatori" },
  { label: "Impostazioni", href: "/impostazioni", icon: "impostazioni" },
]

export const CURRENT_USER = {
  iniziali: "NT",
  nome: "Nando Taglieri",
  ruolo: "Admin · Mostag Studio",
}

// ----------------------------------------------------------------------------
// Selettori (simulano una query per sede)
// ----------------------------------------------------------------------------

export function getKpiData(sede: SedeId): KpiData[] {
  return KPI_BY_SEDE[sede] ?? KPI_ALL
}

export function getMiniStats(sede: SedeId): MiniStat[] {
  return MINI_BY_SEDE[sede] ?? MINI_ALL
}

export function getLeads(sede: SedeId): Lead[] {
  const filtered = sede === "all" ? LEADS : LEADS.filter((l) => l.sede === sede)
  return [...filtered].sort((a, b) => b.score - a.score)
}
