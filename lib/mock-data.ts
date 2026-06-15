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
  | "convertito"
  | "perso"

// Lead "caldo" leggero usato nella dashboard (sottoinsieme di campi)
export interface HotLead {
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
  convertito: "Convertito",
  perso: "Perso",
}

export const LEAD_STATUS_TONE: Record<
  LeadStatus,
  "success" | "info" | "warning" | "muted" | "teal" | "destructive"
> = {
  contattato: "success",
  "inviato-preventivo": "info",
  "tentato-contattare": "warning",
  "non-contattato": "muted",
  convertito: "teal",
  perso: "destructive",
}

// Totale lead "reale" del CRM (i mock sotto sono un sottoinsieme rappresentativo)
export const LEAD_TOTAL = 9003

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

export const HOT_LEADS: HotLead[] = [
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
  { label: "Lead", href: "/leads", icon: "leads", badge: { count: 9, tone: "destructive" } },
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

export function getHotLeads(sede: SedeId): HotLead[] {
  const filtered =
    sede === "all" ? HOT_LEADS : HOT_LEADS.filter((l) => l.sede === sede)
  return [...filtered].sort((a, b) => b.score - a.score)
}

// ============================================================================
// MODULO LEAD — modello dati allineato ai nomi colonna di Zoho CRM
// ----------------------------------------------------------------------------
// I nomi delle proprietà corrispondono esattamente alle colonne Zoho per
// agevolare la futura migrazione dati. L'interfaccia `Lead` è la fonte di
// verità del modulo lead (lista + scheda).
// ============================================================================

export type StatoLead =
  | "Non contattato"
  | "Contattato"
  | "Tentato di contattare"
  | "Inviato Preventivo"
  | "Convertito"
  | "Perso"

export type OrigineLead =
  | "Facebook"
  | "Pubblicità"
  | "Sito web"
  | "Manuale"
  | "Utenza di servizio"

export type SedeLabel =
  | "Catania"
  | "Giarre (CT)"
  | "Treviso"
  | "Torino"
  | "Porto Sant'Elpidio"

export type StatoEmail = "Recapitata" | "Aperta" | "Non recapitata" | "—"

export interface LeadActivity {
  id: string
  tipo: "email-open" | "cambio-stato" | "nota" | "nuovo-lead"
  descrizione: string
  timestamp: string
  autore?: string
}

export interface LeadDoc {
  id: string
  nome: string
  formato: "pdf" | "jpg" | "png" | "dwg"
  dataUpload: string
  dimensione: string
}

// Interfaccia Lead — chiavi = nomi colonna Zoho (vedi prompt Step 3 v2)
export interface Lead {
  id: string
  "Badge dell'attività": boolean
  "Badge di nota": boolean
  Tag: string[]
  "Nome Lead": string
  "Lead Proprietario": string
  "Città": string
  Provincia: string
  "Stato Lead": StatoLead
  "Data Click": string
  "Ora creazione": string
  "campaign name": string
  Telefono: string
  "Mobile/Fisso": string
  "Origine Lead": OrigineLead
  "E-mail": string
  Stato: StatoEmail
  Nome: string
  Cognome: string
  "Creato da": string
  "Ora ultima attività": string
  "Codice postale": string
  Paese: string
  Descrizione: string
  Valutazione: number
  "Tempo di conversione Lead": string
  "Modalità iscrizione annullata": string | null
  "Ora iscrizione annullata": string | null
  "Account convertito": string | null
  "Contatto convertito": string | null
  "Residente in Sicilia": boolean
  "Social Lead ID": string | null
  "Data sopralluogo": string | null
  "Installatore - Incaricato sopralluogo": string | null
  "Connesso a": string | null
  "Data/Ora": string
  kWp: number
  kWh: number
  "Modello pannello": string
  Sede: SedeLabel
  // campi UI extra Solair
  "Wallbox richiesto": boolean
  emailAperture: number
  leadCaldo: boolean
  possibileDuplicato: boolean
  attivita: LeadActivity[]
  documenti: LeadDoc[]
}

export type LeadColumnId = Exclude<
  keyof Lead,
  | "id"
  | "Wallbox richiesto"
  | "emailAperture"
  | "leadCaldo"
  | "possibileDuplicato"
  | "attivita"
  | "documenti"
>

export interface LeadColumn {
  id: LeadColumnId
  label: string
  defaultVisible: boolean
}

// Registro colonne nell'ordine Zoho. `defaultVisible` = colonne mostrate
// inizialmente in tabella (usate dal pannello "Gestisci colonne").
export const LEAD_COLUMNS: LeadColumn[] = [
  { id: "Badge dell'attività", label: "Badge dell'attività", defaultVisible: true },
  { id: "Badge di nota", label: "Badge di nota", defaultVisible: true },
  { id: "Tag", label: "Tag", defaultVisible: true },
  { id: "Nome Lead", label: "Nome Lead", defaultVisible: true },
  { id: "Lead Proprietario", label: "Lead Proprietario", defaultVisible: true },
  { id: "Città", label: "Città", defaultVisible: true },
  { id: "Provincia", label: "Provincia", defaultVisible: true },
  { id: "Stato Lead", label: "Stato Lead", defaultVisible: true },
  { id: "Data Click", label: "Data Click", defaultVisible: true },
  { id: "Ora creazione", label: "Ora creazione", defaultVisible: true },
  { id: "campaign name", label: "campaign name", defaultVisible: true },
  { id: "Telefono", label: "Telefono", defaultVisible: true },
  { id: "Origine Lead", label: "Origine Lead", defaultVisible: true },
  { id: "E-mail", label: "E-mail", defaultVisible: true },
  { id: "Valutazione", label: "Valutazione", defaultVisible: true },
  { id: "Mobile/Fisso", label: "Mobile/Fisso", defaultVisible: false },
  { id: "Stato", label: "Stato (email)", defaultVisible: false },
  { id: "Nome", label: "Nome", defaultVisible: false },
  { id: "Cognome", label: "Cognome", defaultVisible: false },
  { id: "Creato da", label: "Creato da", defaultVisible: false },
  { id: "Ora ultima attività", label: "Ora ultima attività", defaultVisible: false },
  { id: "Codice postale", label: "Codice postale", defaultVisible: false },
  { id: "Paese", label: "Paese", defaultVisible: false },
  { id: "Descrizione", label: "Descrizione", defaultVisible: false },
  { id: "Tempo di conversione Lead", label: "Tempo di conversione Lead", defaultVisible: false },
  { id: "Modalità iscrizione annullata", label: "Modalità iscrizione annullata", defaultVisible: false },
  { id: "Ora iscrizione annullata", label: "Ora iscrizione annullata", defaultVisible: false },
  { id: "Account convertito", label: "Account convertito", defaultVisible: false },
  { id: "Contatto convertito", label: "Contatto convertito", defaultVisible: false },
  { id: "Residente in Sicilia", label: "Residente in Sicilia", defaultVisible: false },
  { id: "Social Lead ID", label: "Social Lead ID", defaultVisible: false },
  { id: "Data sopralluogo", label: "Data sopralluogo", defaultVisible: false },
  { id: "Installatore - Incaricato sopralluogo", label: "Installatore - Incaricato sopralluogo", defaultVisible: false },
  { id: "Connesso a", label: "Connesso a", defaultVisible: false },
  { id: "Data/Ora", label: "Data/Ora", defaultVisible: false },
  { id: "kWp", label: "kWp", defaultVisible: false },
  { id: "kWh", label: "kWh", defaultVisible: false },
  { id: "Modello pannello", label: "Modello pannello", defaultVisible: false },
  { id: "Sede", label: "Sede", defaultVisible: false },
]

export const DEFAULT_VISIBLE_COLUMNS: LeadColumnId[] = LEAD_COLUMNS.filter(
  (c) => c.defaultVisible,
).map((c) => c.id)

// Toni badge per Stato Lead
export const STATO_LEAD_TONE: Record<
  StatoLead,
  "muted" | "success" | "warning" | "info" | "teal" | "destructive"
> = {
  "Non contattato": "muted",
  Contattato: "success",
  "Tentato di contattare": "warning",
  "Inviato Preventivo": "info",
  Convertito: "teal",
  Perso: "destructive",
}

export const STATO_LEAD_ORDER: StatoLead[] = [
  "Non contattato",
  "Tentato di contattare",
  "Contattato",
  "Inviato Preventivo",
  "Convertito",
  "Perso",
]

export const ORIGINE_LEAD_VALUES: OrigineLead[] = [
  "Facebook",
  "Pubblicità",
  "Sito web",
  "Manuale",
  "Utenza di servizio",
]

export const SEDE_LABELS: SedeLabel[] = [
  "Catania",
  "Giarre (CT)",
  "Treviso",
  "Torino",
  "Porto Sant'Elpidio",
]

// Toni badge per i Tag (tag noti colorati, custom in grigio)
export const TAG_TONE: Record<string, "info" | "success" | "warning" | "muted"> = {
  "Inviato Preventivo": "info",
  Richiamare: "success",
  "NON RISPONDE": "warning",
}

export function tagTone(tag: string): "info" | "success" | "warning" | "muted" {
  return TAG_TONE[tag] ?? "muted"
}

export const mockCommerciali: string[] = [
  "Gaetano Grasso",
  "Mariarosa De Leo",
  "Ivan Lo Faro",
  "Fabio Tizi",
  "Cristian Virzì",
  "Filippo Ferrara",
  "Gianluca Silvestro",
]

export const mockSedi: SedeLabel[] = SEDE_LABELS

export const mockInstallatori: string[] = [
  "PM-Technology",
  "DIESSE IMPIANTI",
  "DG Impianti",
  "Bmax",
  "Ca.Gi Srl",
]

// Numero di possibili duplicati rilevati (banner lista)
export const DUPLICATI_COUNT = 23

// Activity di default (lead creato)
function leadCreato(origine: string, ts: string): LeadActivity {
  return {
    id: "act-create",
    tipo: "nuovo-lead",
    descrizione: `Lead creato da Make — Origine: ${origine}`,
    timestamp: ts,
  }
}

export const mockLeads: Lead[] = [
  {
    id: "lead-1",
    "Badge dell'attività": true,
    "Badge di nota": true,
    Tag: ["Inviato Preventivo", "Richiamare"],
    "Nome Lead": "Niccolò Leo",
    "Lead Proprietario": "Gaetano Grasso",
    "Città": "Zevio",
    Provincia: "VR",
    "Stato Lead": "Contattato",
    "Data Click": "12 Giu 2026 07:08",
    "Ora creazione": "12 Giu 2026 09:02",
    "campaign name": "9+21,2 Sineng - NORD w11(Dinamica)",
    Telefono: "+39 347 1122334",
    "Mobile/Fisso": "Mobile",
    "Origine Lead": "Facebook",
    "E-mail": "niccolo.leo@gmail.com",
    Stato: "Aperta",
    Nome: "Niccolò",
    Cognome: "Leo",
    "Creato da": "Make Integration",
    "Ora ultima attività": "Oggi 07:08",
    "Codice postale": "37059",
    Paese: "Italia",
    Descrizione: "Cliente molto interessato, valuta anche colonnina di ricarica.",
    Valutazione: 94,
    "Tempo di conversione Lead": "—",
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    "Account convertito": null,
    "Contatto convertito": null,
    "Residente in Sicilia": false,
    "Social Lead ID": "fb-100023948",
    "Data sopralluogo": null,
    "Installatore - Incaricato sopralluogo": null,
    "Connesso a": "Campagna NORD w11",
    "Data/Ora": "12 Giu 2026 09:02",
    kWp: 9,
    kWh: 21.2,
    "Modello pannello": "Sineng",
    Sede: "Treviso",
    "Wallbox richiesto": true,
    emailAperture: 2,
    leadCaldo: true,
    possibileDuplicato: true,
    attivita: [
      { id: "a1", tipo: "email-open", descrizione: "Email preventivo aperta — 2 volte", timestamp: "Oggi 07:08" },
      { id: "a2", tipo: "cambio-stato", descrizione: "Stato cambiato da 'Tentato di contattare' a 'Contattato'", timestamp: "Ieri 15:20", autore: "Gaetano Grasso" },
      { id: "a3", tipo: "nota", descrizione: "Richiamato, disponibile per sopralluogo settimana prossima.", timestamp: "Ieri 15:18", autore: "Gaetano Grasso" },
      leadCreato("Facebook", "12 Giu 2026 09:02"),
    ],
    documenti: [
      { id: "d1", nome: "preventivo_niccolo_leo.pdf", formato: "pdf", dataUpload: "12 Giu 2026", dimensione: "248 KB" },
      { id: "d2", nome: "planimetria.jpg", formato: "jpg", dataUpload: "12 Giu 2026", dimensione: "1,4 MB" },
    ],
  },
  {
    id: "lead-2",
    "Badge dell'attività": false,
    "Badge di nota": false,
    Tag: [],
    "Nome Lead": "Mauro Quici",
    "Lead Proprietario": "Mariarosa De Leo",
    "Città": "Trivento",
    Provincia: "CB",
    "Stato Lead": "Non contattato",
    "Data Click": "11 Giu 2026 18:22",
    "Ora creazione": "11 Giu 2026 18:25",
    "campaign name": "9+32 kWh - CENTRO w10(Statica)",
    Telefono: "+39 320 7766554",
    "Mobile/Fisso": "Mobile",
    "Origine Lead": "Utenza di servizio",
    "E-mail": "mauro.quici@gmail.com",
    Stato: "Recapitata",
    Nome: "Mauro",
    Cognome: "Quici",
    "Creato da": "Make Integration",
    "Ora ultima attività": "11 Giu 2026 18:25",
    "Codice postale": "86029",
    Paese: "Italia",
    Descrizione: "",
    Valutazione: 38,
    "Tempo di conversione Lead": "—",
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    "Account convertito": null,
    "Contatto convertito": null,
    "Residente in Sicilia": false,
    "Social Lead ID": null,
    "Data sopralluogo": null,
    "Installatore - Incaricato sopralluogo": null,
    "Connesso a": null,
    "Data/Ora": "11 Giu 2026 18:25",
    kWp: 9,
    kWh: 32,
    "Modello pannello": "Sungrow",
    Sede: "Porto Sant'Elpidio",
    "Wallbox richiesto": false,
    emailAperture: 0,
    leadCaldo: false,
    possibileDuplicato: false,
    attivita: [leadCreato("Utenza di servizio", "11 Giu 2026 18:25")],
    documenti: [],
  },
  {
    id: "lead-3",
    "Badge dell'attività": true,
    "Badge di nota": false,
    Tag: ["Inviato Preventivo"],
    "Nome Lead": "Antonio Graziano",
    "Lead Proprietario": "Ivan Lo Faro",
    "Città": "Bovalino",
    Provincia: "RC",
    "Stato Lead": "Contattato",
    "Data Click": "11 Giu 2026 09:40",
    "Ora creazione": "11 Giu 2026 10:02",
    "campaign name": "9 kWp + 32 kWh - SUD w10(Dinamica)",
    Telefono: "+39 339 4455667",
    "Mobile/Fisso": "Mobile",
    "Origine Lead": "Facebook",
    "E-mail": "antonio.graziano@gmail.com",
    Stato: "Aperta",
    Nome: "Antonio",
    Cognome: "Graziano",
    "Creato da": "Make Integration",
    "Ora ultima attività": "Oggi 08:15",
    "Codice postale": "89034",
    Paese: "Italia",
    Descrizione: "Inviato preventivo, in attesa di risposta.",
    Valutazione: 82,
    "Tempo di conversione Lead": "—",
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    "Account convertito": null,
    "Contatto convertito": null,
    "Residente in Sicilia": false,
    "Social Lead ID": "fb-100024112",
    "Data sopralluogo": null,
    "Installatore - Incaricato sopralluogo": null,
    "Connesso a": "Campagna SUD w10",
    "Data/Ora": "11 Giu 2026 10:02",
    kWp: 9,
    kWh: 32,
    "Modello pannello": "Huawei",
    Sede: "Catania",
    "Wallbox richiesto": false,
    emailAperture: 1,
    leadCaldo: true,
    possibileDuplicato: true,
    attivita: [
      { id: "a1", tipo: "email-open", descrizione: "Email preventivo aperta", timestamp: "Oggi 08:15" },
      { id: "a2", tipo: "cambio-stato", descrizione: "Stato cambiato da 'Non contattato' a 'Contattato'", timestamp: "Ieri 11:00", autore: "Ivan Lo Faro" },
      leadCreato("Facebook", "11 Giu 2026 10:02"),
    ],
    documenti: [
      { id: "d1", nome: "preventivo_antonio_graziano.pdf", formato: "pdf", dataUpload: "11 Giu 2026", dimensione: "255 KB" },
    ],
  },
  {
    id: "lead-4",
    "Badge dell'attività": true,
    "Badge di nota": true,
    Tag: ["NON RISPONDE", "Richiamare"],
    "Nome Lead": "Aleksandar Mijailovic",
    "Lead Proprietario": "Ivan Lo Faro",
    "Città": "San Giovanni al Natisone",
    Provincia: "UD",
    "Stato Lead": "Tentato di contattare",
    "Data Click": "10 Giu 2026 14:05",
    "Ora creazione": "10 Giu 2026 14:20",
    "campaign name": "Friuli VG - NORD (giornaliero)",
    Telefono: "+39 348 9911223",
    "Mobile/Fisso": "Mobile",
    "Origine Lead": "Facebook",
    "E-mail": "a.mijailovic@gmail.com",
    Stato: "Recapitata",
    Nome: "Aleksandar",
    Cognome: "Mijailovic",
    "Creato da": "Make Integration",
    "Ora ultima attività": "Ieri 17:40",
    "Codice postale": "33048",
    Paese: "Italia",
    Descrizione: "Non risponde, riprovare in orario serale.",
    Valutazione: 61,
    "Tempo di conversione Lead": "—",
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    "Account convertito": null,
    "Contatto convertito": null,
    "Residente in Sicilia": false,
    "Social Lead ID": "fb-100024501",
    "Data sopralluogo": null,
    "Installatore - Incaricato sopralluogo": null,
    "Connesso a": null,
    "Data/Ora": "10 Giu 2026 14:20",
    kWp: 7,
    kWh: 20,
    "Modello pannello": "VTac",
    Sede: "Treviso",
    "Wallbox richiesto": false,
    emailAperture: 0,
    leadCaldo: false,
    possibileDuplicato: false,
    attivita: [
      { id: "a1", tipo: "cambio-stato", descrizione: "Stato cambiato da 'Non contattato' a 'Tentato di contattare'", timestamp: "Ieri 17:40", autore: "Ivan Lo Faro" },
      leadCreato("Facebook", "10 Giu 2026 14:20"),
    ],
    documenti: [],
  },
  {
    id: "lead-5",
    "Badge dell'attività": false,
    "Badge di nota": false,
    Tag: [],
    "Nome Lead": "Simone Ferri",
    "Lead Proprietario": "Filippo Ferrara",
    "Città": "Firenze",
    Provincia: "FI",
    "Stato Lead": "Non contattato",
    "Data Click": "10 Giu 2026 08:10",
    "Ora creazione": "10 Giu 2026 08:12",
    "campaign name": "9+20 VTac - NORD w09(Statica)",
    Telefono: "+39 333 1239870",
    "Mobile/Fisso": "Mobile",
    "Origine Lead": "Pubblicità",
    "E-mail": "simone.ferri@gmail.com",
    Stato: "Recapitata",
    Nome: "Simone",
    Cognome: "Ferri",
    "Creato da": "Make Integration",
    "Ora ultima attività": "10 Giu 2026 08:12",
    "Codice postale": "50122",
    Paese: "Italia",
    Descrizione: "",
    Valutazione: 45,
    "Tempo di conversione Lead": "—",
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    "Account convertito": null,
    "Contatto convertito": null,
    "Residente in Sicilia": false,
    "Social Lead ID": null,
    "Data sopralluogo": null,
    "Installatore - Incaricato sopralluogo": null,
    "Connesso a": null,
    "Data/Ora": "10 Giu 2026 08:12",
    kWp: 9,
    kWh: 20,
    "Modello pannello": "VTac",
    Sede: "Porto Sant'Elpidio",
    "Wallbox richiesto": false,
    emailAperture: 0,
    leadCaldo: false,
    possibileDuplicato: false,
    attivita: [leadCreato("Pubblicità", "10 Giu 2026 08:12")],
    documenti: [],
  },
  {
    id: "lead-6",
    "Badge dell'attività": false,
    "Badge di nota": false,
    Tag: [],
    "Nome Lead": "Antonio Siciliano",
    "Lead Proprietario": "Gaetano Grasso",
    "Città": "Pietraperzia",
    Provincia: "EN",
    "Stato Lead": "Non contattato",
    "Data Click": "09 Giu 2026 19:30",
    "Ora creazione": "09 Giu 2026 19:33",
    "campaign name": "Modulo SEI SICILIANO 6+12",
    Telefono: "+39 347 5544332",
    "Mobile/Fisso": "Mobile",
    "Origine Lead": "Facebook",
    "E-mail": "antonio.siciliano@gmail.com",
    Stato: "Recapitata",
    Nome: "Antonio",
    Cognome: "Siciliano",
    "Creato da": "Make Integration",
    "Ora ultima attività": "09 Giu 2026 19:33",
    "Codice postale": "94016",
    Paese: "Italia",
    Descrizione: "",
    Valutazione: 52,
    "Tempo di conversione Lead": "—",
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    "Account convertito": null,
    "Contatto convertito": null,
    "Residente in Sicilia": true,
    "Social Lead ID": "fb-100025008",
    "Data sopralluogo": null,
    "Installatore - Incaricato sopralluogo": null,
    "Connesso a": null,
    "Data/Ora": "09 Giu 2026 19:33",
    kWp: 6,
    kWh: 12,
    "Modello pannello": "SEI",
    Sede: "Giarre (CT)",
    "Wallbox richiesto": false,
    emailAperture: 0,
    leadCaldo: false,
    possibileDuplicato: false,
    attivita: [leadCreato("Facebook", "09 Giu 2026 19:33")],
    documenti: [],
  },
  {
    id: "lead-7",
    "Badge dell'attività": true,
    "Badge di nota": true,
    Tag: ["NON RISPONDE", "Richiamare"],
    "Nome Lead": "Paolo Busellato",
    "Lead Proprietario": "Ivan Lo Faro",
    "Città": "Recoaro Terme",
    Provincia: "VI",
    "Stato Lead": "Tentato di contattare",
    "Data Click": "09 Giu 2026 11:15",
    "Ora creazione": "09 Giu 2026 11:18",
    "campaign name": "9 kWp + 32 kWh - NORD w09(Dinamica)",
    Telefono: "+39 320 5566778",
    "Mobile/Fisso": "Fisso",
    "Origine Lead": "Facebook",
    "E-mail": "paolo.busellato@libero.it",
    Stato: "Non recapitata",
    Nome: "Paolo",
    Cognome: "Busellato",
    "Creato da": "Make Integration",
    "Ora ultima attività": "Ieri 09:30",
    "Codice postale": "36076",
    Paese: "Italia",
    Descrizione: "Numero fisso, non risponde. Richiamare.",
    Valutazione: 57,
    "Tempo di conversione Lead": "—",
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    "Account convertito": null,
    "Contatto convertito": null,
    "Residente in Sicilia": false,
    "Social Lead ID": "fb-100025233",
    "Data sopralluogo": null,
    "Installatore - Incaricato sopralluogo": null,
    "Connesso a": null,
    "Data/Ora": "09 Giu 2026 11:18",
    kWp: 9,
    kWh: 32,
    "Modello pannello": "Huawei",
    Sede: "Treviso",
    "Wallbox richiesto": false,
    emailAperture: 0,
    leadCaldo: false,
    possibileDuplicato: true,
    attivita: [
      { id: "a1", tipo: "cambio-stato", descrizione: "Stato cambiato da 'Non contattato' a 'Tentato di contattare'", timestamp: "Ieri 09:30", autore: "Ivan Lo Faro" },
      leadCreato("Facebook", "09 Giu 2026 11:18"),
    ],
    documenti: [],
  },
  {
    id: "lead-8",
    "Badge dell'attività": true,
    "Badge di nota": true,
    Tag: ["Inviato Preventivo", "Richiamare"],
    "Nome Lead": "Mattia Bianco",
    "Lead Proprietario": "Ivan Lo Faro",
    "Città": "Monselice",
    Provincia: "PD",
    "Stato Lead": "Contattato",
    "Data Click": "08 Giu 2026 16:40",
    "Ora creazione": "08 Giu 2026 16:45",
    "campaign name": "9 kWp + 32 kWh - NORD w08(Statica)",
    Telefono: "+39 348 6677889",
    "Mobile/Fisso": "Mobile",
    "Origine Lead": "Facebook",
    "E-mail": "mattia.bianco@gmail.com",
    Stato: "Aperta",
    Nome: "Mattia",
    Cognome: "Bianco",
    "Creato da": "Make Integration",
    "Ora ultima attività": "Oggi 09:50",
    "Codice postale": "35043",
    Paese: "Italia",
    Descrizione: "Preventivo inviato, richiamare per conferma.",
    Valutazione: 78,
    "Tempo di conversione Lead": "—",
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    "Account convertito": null,
    "Contatto convertito": null,
    "Residente in Sicilia": false,
    "Social Lead ID": "fb-100025620",
    "Data sopralluogo": null,
    "Installatore - Incaricato sopralluogo": null,
    "Connesso a": "Campagna NORD w08",
    "Data/Ora": "08 Giu 2026 16:45",
    kWp: 9,
    kWh: 32,
    "Modello pannello": "Huawei",
    Sede: "Treviso",
    "Wallbox richiesto": true,
    emailAperture: 2,
    leadCaldo: true,
    possibileDuplicato: false,
    attivita: [
      { id: "a1", tipo: "email-open", descrizione: "Email preventivo aperta — 2 volte", timestamp: "Oggi 09:50" },
      leadCreato("Facebook", "08 Giu 2026 16:45"),
    ],
    documenti: [
      { id: "d1", nome: "preventivo_mattia_bianco.pdf", formato: "pdf", dataUpload: "08 Giu 2026", dimensione: "241 KB" },
    ],
  },
  {
    id: "lead-9",
    "Badge dell'attività": false,
    "Badge di nota": true,
    Tag: ["nuccio"],
    "Nome Lead": "Manuel Gabrieli",
    "Lead Proprietario": "Filippo Ferrara",
    "Città": "Mantova",
    Provincia: "MN",
    "Stato Lead": "Non contattato",
    "Data Click": "08 Giu 2026 10:05",
    "Ora creazione": "08 Giu 2026 10:08",
    "campaign name": "7+20 VTac - NORD w23",
    Telefono: "+39 333 4455112",
    "Mobile/Fisso": "Mobile",
    "Origine Lead": "Manuale",
    "E-mail": "manuel.gabrieli@gmail.com",
    Stato: "—",
    Nome: "Manuel",
    Cognome: "Gabrieli",
    "Creato da": "Filippo Ferrara",
    "Ora ultima attività": "08 Giu 2026 10:08",
    "Codice postale": "46100",
    Paese: "Italia",
    Descrizione: "Tag interno: nuccio.",
    Valutazione: 40,
    "Tempo di conversione Lead": "—",
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    "Account convertito": null,
    "Contatto convertito": null,
    "Residente in Sicilia": false,
    "Social Lead ID": null,
    "Data sopralluogo": null,
    "Installatore - Incaricato sopralluogo": null,
    "Connesso a": null,
    "Data/Ora": "08 Giu 2026 10:08",
    kWp: 7,
    kWh: 20,
    "Modello pannello": "VTac",
    Sede: "Torino",
    "Wallbox richiesto": false,
    emailAperture: 0,
    leadCaldo: false,
    possibileDuplicato: false,
    attivita: [
      { id: "a1", tipo: "nota", descrizione: "Tag interno: nuccio", timestamp: "08 Giu 2026 10:08", autore: "Filippo Ferrara" },
      leadCreato("Manuale", "08 Giu 2026 10:08"),
    ],
    documenti: [],
  },
  {
    id: "lead-10",
    "Badge dell'attività": true,
    "Badge di nota": false,
    Tag: ["Inviato Preventivo"],
    "Nome Lead": "Gurpreet Singh",
    "Lead Proprietario": "Ivan Lo Faro",
    "Città": "Brescia",
    Provincia: "BS",
    "Stato Lead": "Contattato",
    "Data Click": "07 Giu 2026 12:00",
    "Ora creazione": "07 Giu 2026 12:04",
    "campaign name": "9 kWp + 32 kWh - NORD w07(Dinamica)",
    Telefono: "+39 327 8899001",
    "Mobile/Fisso": "Mobile",
    "Origine Lead": "Facebook",
    "E-mail": "gurpreet.singh@gmail.com",
    Stato: "Aperta",
    Nome: "Gurpreet",
    Cognome: "Singh",
    "Creato da": "Make Integration",
    "Ora ultima attività": "Ieri 14:20",
    "Codice postale": "25121",
    Paese: "Italia",
    Descrizione: "Preventivo inviato.",
    Valutazione: 73,
    "Tempo di conversione Lead": "—",
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    "Account convertito": null,
    "Contatto convertito": null,
    "Residente in Sicilia": false,
    "Social Lead ID": "fb-100026010",
    "Data sopralluogo": null,
    "Installatore - Incaricato sopralluogo": null,
    "Connesso a": "Campagna NORD w07",
    "Data/Ora": "07 Giu 2026 12:04",
    kWp: 9,
    kWh: 32,
    "Modello pannello": "Sungrow",
    Sede: "Torino",
    "Wallbox richiesto": false,
    emailAperture: 1,
    leadCaldo: false,
    possibileDuplicato: false,
    attivita: [
      { id: "a1", tipo: "email-open", descrizione: "Email preventivo aperta", timestamp: "Ieri 14:20" },
      leadCreato("Facebook", "07 Giu 2026 12:04"),
    ],
    documenti: [],
  },
  {
    id: "lead-11",
    "Badge dell'attività": true,
    "Badge di nota": false,
    Tag: ["Inviato Preventivo"],
    "Nome Lead": "Salvatore Conti",
    "Lead Proprietario": "Cristian Virzì",
    "Città": "Catania",
    Provincia: "CT",
    "Stato Lead": "Inviato Preventivo",
    "Data Click": "06 Giu 2026 13:25",
    "Ora creazione": "06 Giu 2026 13:28",
    "campaign name": "10+20 Sungrow - SUD w06(Statica)",
    Telefono: "+39 347 1239988",
    "Mobile/Fisso": "Mobile",
    "Origine Lead": "Sito web",
    "E-mail": "salvatore.conti@gmail.com",
    Stato: "Aperta",
    Nome: "Salvatore",
    Cognome: "Conti",
    "Creato da": "Make Integration",
    "Ora ultima attività": "Oggi 06:40",
    "Codice postale": "95124",
    Paese: "Italia",
    Descrizione: "Preventivo inviato, attende conferma.",
    Valutazione: 86,
    "Tempo di conversione Lead": "—",
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    "Account convertito": null,
    "Contatto convertito": null,
    "Residente in Sicilia": true,
    "Social Lead ID": null,
    "Data sopralluogo": "18 Giu 2026 10:00",
    "Installatore - Incaricato sopralluogo": "DIESSE IMPIANTI",
    "Connesso a": "Campagna SUD w06",
    "Data/Ora": "06 Giu 2026 13:28",
    kWp: 10,
    kWh: 20,
    "Modello pannello": "Sungrow",
    Sede: "Catania",
    "Wallbox richiesto": false,
    emailAperture: 3,
    leadCaldo: true,
    possibileDuplicato: false,
    attivita: [
      { id: "a1", tipo: "email-open", descrizione: "Email preventivo aperta — 3 volte", timestamp: "Oggi 06:40" },
      { id: "a2", tipo: "cambio-stato", descrizione: "Stato cambiato da 'Contattato' a 'Inviato Preventivo'", timestamp: "07 Giu 2026", autore: "Cristian Virzì" },
      leadCreato("Sito web", "06 Giu 2026 13:28"),
    ],
    documenti: [
      { id: "d1", nome: "preventivo_salvatore_conti.pdf", formato: "pdf", dataUpload: "06 Giu 2026", dimensione: "268 KB" },
    ],
  },
  {
    id: "lead-12",
    "Badge dell'attività": true,
    "Badge di nota": true,
    Tag: ["Inviato Preventivo"],
    "Nome Lead": "Rosario Finocchiaro",
    "Lead Proprietario": "Cristian Virzì",
    "Città": "Giarre",
    Provincia: "CT",
    "Stato Lead": "Convertito",
    "Data Click": "28 Mag 2026 09:00",
    "Ora creazione": "25 Mag 2026 09:00",
    "campaign name": "8+12 Solis - SUD w03(Statica)",
    Telefono: "+39 333 2244668",
    "Mobile/Fisso": "Mobile",
    "Origine Lead": "Facebook",
    "E-mail": "rosario.finocchiaro@gmail.com",
    Stato: "Aperta",
    Nome: "Rosario",
    Cognome: "Finocchiaro",
    "Creato da": "Make Integration",
    "Ora ultima attività": "02 Giu 2026",
    "Codice postale": "95014",
    Paese: "Italia",
    Descrizione: "Convertito a cliente, contratto firmato.",
    Valutazione: 90,
    "Tempo di conversione Lead": "8 giorni",
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    "Account convertito": "Finocchiaro Impianti",
    "Contatto convertito": "Rosario Finocchiaro",
    "Residente in Sicilia": true,
    "Social Lead ID": "fb-100021100",
    "Data sopralluogo": "01 Giu 2026 11:00",
    "Installatore - Incaricato sopralluogo": "DG Impianti",
    "Connesso a": "Campagna SUD w03",
    "Data/Ora": "25 Mag 2026 09:00",
    kWp: 8,
    kWh: 12,
    "Modello pannello": "Solis",
    Sede: "Giarre (CT)",
    "Wallbox richiesto": true,
    emailAperture: 4,
    leadCaldo: false,
    possibileDuplicato: false,
    attivita: [
      { id: "a1", tipo: "cambio-stato", descrizione: "Stato cambiato da 'Inviato Preventivo' a 'Convertito'", timestamp: "02 Giu 2026", autore: "Cristian Virzì" },
      leadCreato("Facebook", "25 Mag 2026 09:00"),
    ],
    documenti: [
      { id: "d1", nome: "contratto_finocchiaro.pdf", formato: "pdf", dataUpload: "02 Giu 2026", dimensione: "312 KB" },
    ],
  },
  {
    id: "lead-13",
    "Badge dell'attività": false,
    "Badge di nota": false,
    Tag: [],
    "Nome Lead": "Federica Conti",
    "Lead Proprietario": "Fabio Tizi",
    "Città": "Moncalieri",
    Provincia: "TO",
    "Stato Lead": "Contattato",
    "Data Click": "08 Giu 2026 16:40",
    "Ora creazione": "08 Giu 2026 16:42",
    "campaign name": "6+10 Huawei - NORD w08(Statica)",
    Telefono: "+39 366 7711223",
    "Mobile/Fisso": "Mobile",
    "Origine Lead": "Sito web",
    "E-mail": "federica.conti@gmail.com",
    Stato: "Aperta",
    Nome: "Federica",
    Cognome: "Conti",
    "Creato da": "Make Integration",
    "Ora ultima attività": "Ieri 18:30",
    "Codice postale": "10024",
    Paese: "Italia",
    Descrizione: "",
    Valutazione: 68,
    "Tempo di conversione Lead": "—",
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    "Account convertito": null,
    "Contatto convertito": null,
    "Residente in Sicilia": false,
    "Social Lead ID": null,
    "Data sopralluogo": null,
    "Installatore - Incaricato sopralluogo": null,
    "Connesso a": null,
    "Data/Ora": "08 Giu 2026 16:42",
    kWp: 6,
    kWh: 10,
    "Modello pannello": "Huawei",
    Sede: "Torino",
    "Wallbox richiesto": true,
    emailAperture: 1,
    leadCaldo: false,
    possibileDuplicato: false,
    attivita: [leadCreato("Sito web", "08 Giu 2026 16:42")],
    documenti: [],
  },
  {
    id: "lead-14",
    "Badge dell'attività": false,
    "Badge di nota": true,
    Tag: [],
    "Nome Lead": "Davide Riccardi",
    "Lead Proprietario": "Mariarosa De Leo",
    "Città": "Porto Sant'Elpidio",
    Provincia: "FM",
    "Stato Lead": "Perso",
    "Data Click": "20 Mag 2026 11:15",
    "Ora creazione": "20 Mag 2026 11:18",
    "campaign name": "6+6 Huawei - CENTRO w02(Dinamica)",
    Telefono: "+39 329 4567812",
    "Mobile/Fisso": "Mobile",
    "Origine Lead": "Pubblicità",
    "E-mail": "davide.riccardi@gmail.com",
    Stato: "Recapitata",
    Nome: "Davide",
    Cognome: "Riccardi",
    "Creato da": "Make Integration",
    "Ora ultima attività": "28 Mag 2026",
    "Codice postale": "63821",
    Paese: "Italia",
    Descrizione: "Ha scelto un concorrente.",
    Valutazione: 26,
    "Tempo di conversione Lead": "—",
    "Modalità iscrizione annullata": "Email",
    "Ora iscrizione annullata": "27 Mag 2026",
    "Account convertito": null,
    "Contatto convertito": null,
    "Residente in Sicilia": false,
    "Social Lead ID": null,
    "Data sopralluogo": null,
    "Installatore - Incaricato sopralluogo": null,
    "Connesso a": null,
    "Data/Ora": "20 Mag 2026 11:18",
    kWp: 6,
    kWh: 6,
    "Modello pannello": "Huawei",
    Sede: "Porto Sant'Elpidio",
    "Wallbox richiesto": false,
    emailAperture: 1,
    leadCaldo: false,
    possibileDuplicato: false,
    attivita: [
      { id: "a1", tipo: "cambio-stato", descrizione: "Stato cambiato da 'Contattato' a 'Perso'", timestamp: "28 Mag 2026", autore: "Mariarosa De Leo" },
      leadCreato("Pubblicità", "20 Mag 2026 11:18"),
    ],
    documenti: [],
  },
  {
    id: "lead-15",
    "Badge dell'attività": true,
    "Badge di nota": false,
    Tag: ["NON RISPONDE"],
    "Nome Lead": "Chiara Bianchi",
    "Lead Proprietario": "Gianluca Silvestro",
    "Città": "Torino",
    Provincia: "TO",
    "Stato Lead": "Tentato di contattare",
    "Data Click": "06 Giu 2026 13:25",
    "Ora creazione": "06 Giu 2026 13:30",
    "campaign name": "10+20 Sungrow - NORD w06(Statica)",
    Telefono: "+39 347 5512347",
    "Mobile/Fisso": "Mobile",
    "Origine Lead": "Sito web",
    "E-mail": "chiara.bianchi@gmail.com",
    Stato: "Non recapitata",
    Nome: "Chiara",
    Cognome: "Bianchi",
    "Creato da": "Make Integration",
    "Ora ultima attività": "Ieri 10:10",
    "Codice postale": "10128",
    Paese: "Italia",
    Descrizione: "Numero non raggiungibile.",
    Valutazione: 49,
    "Tempo di conversione Lead": "—",
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    "Account convertito": null,
    "Contatto convertito": null,
    "Residente in Sicilia": false,
    "Social Lead ID": null,
    "Data sopralluogo": null,
    "Installatore - Incaricato sopralluogo": null,
    "Connesso a": null,
    "Data/Ora": "06 Giu 2026 13:30",
    kWp: 10,
    kWh: 20,
    "Modello pannello": "Sungrow",
    Sede: "Torino",
    "Wallbox richiesto": false,
    emailAperture: 0,
    leadCaldo: false,
    possibileDuplicato: false,
    attivita: [
      { id: "a1", tipo: "cambio-stato", descrizione: "Stato cambiato da 'Non contattato' a 'Tentato di contattare'", timestamp: "Ieri 10:10", autore: "Gianluca Silvestro" },
      leadCreato("Sito web", "06 Giu 2026 13:30"),
    ],
    documenti: [],
  },
  // --- coppia duplicato #1 (E-mail quasi identica a lead-3 Antonio Graziano) ---
  {
    id: "lead-16",
    "Badge dell'attività": false,
    "Badge di nota": false,
    Tag: [],
    "Nome Lead": "Antonio Graziano",
    "Lead Proprietario": "Ivan Lo Faro",
    "Città": "Bovalino",
    Provincia: "RC",
    "Stato Lead": "Non contattato",
    "Data Click": "11 Giu 2026 09:42",
    "Ora creazione": "11 Giu 2026 10:05",
    "campaign name": "9 kWp + 32 kWh - SUD w10(Dinamica)",
    Telefono: "+39 339 4455668",
    "Mobile/Fisso": "Mobile",
    "Origine Lead": "Facebook",
    "E-mail": "antonio.graziano1@gmail.com",
    Stato: "Recapitata",
    Nome: "Antonio",
    Cognome: "Graziano",
    "Creato da": "Make Integration",
    "Ora ultima attività": "11 Giu 2026 10:05",
    "Codice postale": "89034",
    Paese: "Italia",
    Descrizione: "Possibile duplicato di Antonio Graziano (lead-3).",
    Valutazione: 50,
    "Tempo di conversione Lead": "—",
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    "Account convertito": null,
    "Contatto convertito": null,
    "Residente in Sicilia": false,
    "Social Lead ID": "fb-100024113",
    "Data sopralluogo": null,
    "Installatore - Incaricato sopralluogo": null,
    "Connesso a": null,
    "Data/Ora": "11 Giu 2026 10:05",
    kWp: 9,
    kWh: 32,
    "Modello pannello": "Huawei",
    Sede: "Catania",
    "Wallbox richiesto": false,
    emailAperture: 0,
    leadCaldo: false,
    possibileDuplicato: true,
    attivita: [leadCreato("Facebook", "11 Giu 2026 10:05")],
    documenti: [],
  },
  // --- coppia duplicato #2 (Telefono identico a lead-7 Paolo Busellato) ---
  {
    id: "lead-17",
    "Badge dell'attività": false,
    "Badge di nota": false,
    Tag: [],
    "Nome Lead": "Paolo Busellato",
    "Lead Proprietario": "Ivan Lo Faro",
    "Città": "Recoaro Terme",
    Provincia: "VI",
    "Stato Lead": "Non contattato",
    "Data Click": "09 Giu 2026 11:20",
    "Ora creazione": "09 Giu 2026 11:25",
    "campaign name": "9 kWp + 32 kWh - NORD w09(Statica)",
    Telefono: "+39 320 5566778",
    "Mobile/Fisso": "Mobile",
    "Origine Lead": "Sito web",
    "E-mail": "p.busellato@gmail.com",
    Stato: "Recapitata",
    Nome: "Paolo",
    Cognome: "Busellato",
    "Creato da": "Make Integration",
    "Ora ultima attività": "09 Giu 2026 11:25",
    "Codice postale": "36076",
    Paese: "Italia",
    Descrizione: "Possibile duplicato di Paolo Busellato (lead-7) — stesso telefono.",
    Valutazione: 48,
    "Tempo di conversione Lead": "—",
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    "Account convertito": null,
    "Contatto convertito": null,
    "Residente in Sicilia": false,
    "Social Lead ID": null,
    "Data sopralluogo": null,
    "Installatore - Incaricato sopralluogo": null,
    "Connesso a": null,
    "Data/Ora": "09 Giu 2026 11:25",
    kWp: 9,
    kWh: 32,
    "Modello pannello": "Huawei",
    Sede: "Treviso",
    "Wallbox richiesto": false,
    emailAperture: 0,
    leadCaldo: false,
    possibileDuplicato: true,
    attivita: [leadCreato("Sito web", "09 Giu 2026 11:25")],
    documenti: [],
  },
]

export function getLeadById(id: string): Lead | undefined {
  return mockLeads.find((l) => l.id === id)
}

export function leadInitials(nomeLead: string): string {
  return nomeLead
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}
