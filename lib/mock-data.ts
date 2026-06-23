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
  "Solair Group srl",
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

// ============================================================================
// MODULO CLIENTI
// Le chiavi corrispondono ai nomi colonna Zoho per agevolare la migrazione.
// Molti campi sono opzionali: nella realtà la gran parte è vuota.
// ============================================================================

export type StatoCliente =
  | "Nuovo contratto digitale"
  | "Fin da firmare"
  | "Attesa cliente"
  | "Iter in corso"
  | "In esecuzione"
  | "Installazione completata"
  | "Emessa fattura"
  | "Chiuso"

export interface ClienteRecord {
  id: string

  // --- Base ---
  "Badge dell'attività": boolean
  "Badge di nota": boolean
  "Nome Clienti": string
  "E-mail": string
  "Ora modifica": string
  Tag: string[]
  Sede: SedeLabel

  // --- Anagrafica ---
  "Clienti Proprietario"?: string
  "Origine Lead"?: string
  Nome?: string
  Cognome: string
  "Altro telefono"?: string
  Cellulare?: string
  "Creato da"?: string
  "Modificato da"?: string
  "Ora creazione"?: string
  Saluti?: string
  "E-mail secondaria"?: string
  "Ora ultima attività"?: string
  "Codice fiscale"?: string

  // --- Indirizzo postale ---
  "Via indirizzo postale"?: string
  "Città indirizzo postale"?: string
  "Provincia indirizzo postale"?: string
  "Codice postale indirizzo"?: string

  // --- Note e stato ---
  Descrizione?: string
  "Modalità iscrizione annullata"?: string | null
  "Ora iscrizione annullata"?: string | null
  Stato: StatoCliente
  Note?: string
  "Note ufficio"?: string
  "Note pagamenti"?: string
  "Note Provvigioni"?: string

  // --- Tracking visite sito ---
  "Visita più recente"?: string
  "Prima pagina visitata"?: string
  "Tempo medio impiegato minuti"?: number
  "Numero di chat"?: number
  Relatore?: string
  "Punteggio visitatore"?: number
  "Prima visita"?: string
  "Giorni visitati"?: number
  "Social Lead ID"?: string

  // --- Configurazione impianto ---
  "COD. INVERTER"?: string
  "COD- MODULI"?: string
  "COD. STORAGE"?: string
  "DISPONIBILITA' MAGAZZINO"?: string
  Installatore?: string
  "Nr. Inverter"?: number
  "Nr. Moduli"?: number
  "Potenza Moduli Wp"?: number
  "Nr. Batterie"?: number
  "Capacità Batterie"?: string
  "Totale Storage"?: string
  "Tot Potenza DC"?: string
  "Potenza Inverter"?: string
  "Tot Potenza AC KW"?: number
  Tipologia?: string
  Retrofit?: boolean
  EPS?: boolean
  "Impianto in edilizia libera"?: boolean
  "Area vincolata"?: boolean
  ">20kW Pot. Nom."?: boolean
  "Impianto Attivo"?: boolean
  ST300?: string
  "Scaldacqua PDC"?: string
  "PDC idronica"?: string
  "P D C idronica"?: string
  STF?: string
  Accessori?: string
  "Litri Accumulo"?: number
  "N. Collettori"?: number

  // --- Pagamenti e finanziario ---
  "Modalità di Pagamento"?: string
  "1° Tranche"?: string
  "Importo Contrattuale"?: number
  "Bonifico Parziale"?: string
  "Importo Finanziamento"?: number
  "2°Tranche"?: string
  Saldo?: number
  IBAN?: string
  "Finanziamento approvato"?: boolean
  "N. rate e importo rata"?: string
  "Tot Contratto"?: number
  "di cui CT3"?: number
  "di cui FTV"?: number
  "Sconto COMBO"?: number
  Bonifico1?: string
  Bonifico2?: string
  BonificoPDC?: string
  FatturaPDC?: string
  IncentivoAtteso?: number
  "Iva Reverse charge"?: boolean
  IVA?: number
  "Importo da Listino"?: number
  "Importo TICA"?: number
  "MOD. PAGAMENTO CT3.0"?: string

  // --- Logistica e cantiere ---
  "Stratigrafia superficie di installazione"?: string
  "C/o magazzino installatore"?: string
  "Indirizzo di ritiro merce"?: string
  "Merce ordinata e da ritirare"?: string
  "C/o cantiere del cliente"?: string
  "Altri materiali"?: string
  "Data installazione ultimata"?: string
  "Data appuntamento allaccio"?: string
  "Intervento 1"?: string
  "Intervento 2"?: string

  // --- Documenti e pratiche ---
  Allegati?: string[]
  "Mappa catastale"?: string
  "Regolamento di esecizio"?: string
  "Attestato Terna"?: string
  "Codice contratto PNRR"?: string
  "Scheda ENEA"?: string
  "Verifica documentale"?: boolean
  "Layout verificato"?: boolean
  Fattura1?: string
  Fattura2?: string

  // --- Iter burocratico ---
  "Inserimento pratica GSE"?: string
  "Inserimento pratica E-Distribuzione"?: string
  POD?: string
  Zona?: string
  "Data ammissibilità"?: string
  "Data sopralluogo"?: string
  "Data affidamento sopralluogo"?: string
  "Stato sopralluogo"?: string
  "Data conferma Iter E-distribuzione"?: string
  "Notifica pred. reg. esercizio"?: boolean
  "Disponibilità Fine lavori"?: boolean
  Tica?: string
  "Stato TICA"?: string
  "Data scadenza TICA"?: string
  "Data iter Enel Concluso"?: string
  "TIPO CTR"?: string
  "Stato Sollecito"?: string
  "Data interlocutorio"?: string

  // --- Comunicazioni automatiche (stato invio Make) ---
  "Messaggio di benvenuto"?: boolean
  "Messaggio prog. preliminare"?: boolean
  "Messaggio ordine merce"?: boolean
  "Messaggio in esecuzione"?: boolean
  "Telefonata post installazione"?: boolean
  "Messaggio Fattura"?: boolean
  "Corrispettivo pagato"?: boolean
  "Data Click"?: string
  Assistenza?: string

  // --- Provvigioni ---
  "Codice rintracciabilità"?: string
  "Stato Provvigione"?: string
}

export type ClienteColumnId = Exclude<keyof ClienteRecord, "id">

export type ClienteColumnGroup =
  | "Base"
  | "Anagrafica"
  | "Indirizzo postale"
  | "Note e stato"
  | "Tracking visite sito"
  | "Configurazione impianto"
  | "Pagamenti e finanziario"
  | "Logistica e cantiere"
  | "Documenti e pratiche"
  | "Iter burocratico"
  | "Comunicazioni automatiche"
  | "Provvigioni"

export const CLIENTE_COLUMN_GROUPS: ClienteColumnGroup[] = [
  "Base",
  "Anagrafica",
  "Indirizzo postale",
  "Note e stato",
  "Tracking visite sito",
  "Configurazione impianto",
  "Pagamenti e finanziario",
  "Logistica e cantiere",
  "Documenti e pratiche",
  "Iter burocratico",
  "Comunicazioni automatiche",
  "Provvigioni",
]

export interface ClienteColumn {
  id: ClienteColumnId
  label: string
  group: ClienteColumnGroup
  defaultVisible?: boolean
}

export const CLIENTE_COLUMNS: ClienteColumn[] = [
  // Base
  { id: "Badge dell'attività", label: "Badge dell'attività", group: "Base", defaultVisible: true },
  { id: "Badge di nota", label: "Badge di nota", group: "Base", defaultVisible: true },
  { id: "Nome Clienti", label: "Nome Clienti", group: "Base", defaultVisible: true },
  { id: "E-mail", label: "E-mail", group: "Base", defaultVisible: true },
  { id: "Ora modifica", label: "Ora modifica", group: "Base", defaultVisible: true },
  { id: "Tag", label: "Tag", group: "Base", defaultVisible: true },
  { id: "Sede", label: "Sede", group: "Base", defaultVisible: true },
  // Anagrafica
  { id: "Clienti Proprietario", label: "Clienti Proprietario", group: "Anagrafica", defaultVisible: true },
  { id: "Origine Lead", label: "Origine Lead", group: "Anagrafica" },
  { id: "Nome", label: "Nome", group: "Anagrafica" },
  { id: "Cognome", label: "Cognome", group: "Anagrafica" },
  { id: "Altro telefono", label: "Altro telefono", group: "Anagrafica" },
  { id: "Cellulare", label: "Cellulare", group: "Anagrafica", defaultVisible: true },
  { id: "Creato da", label: "Creato da", group: "Anagrafica" },
  { id: "Modificato da", label: "Modificato da", group: "Anagrafica" },
  { id: "Ora creazione", label: "Ora creazione", group: "Anagrafica" },
  { id: "Saluti", label: "Saluti", group: "Anagrafica" },
  { id: "E-mail secondaria", label: "E-mail secondaria", group: "Anagrafica" },
  { id: "Ora ultima attività", label: "Ora ultima attività", group: "Anagrafica" },
  { id: "Codice fiscale", label: "Codice fiscale", group: "Anagrafica" },
  // Indirizzo postale
  { id: "Via indirizzo postale", label: "Via indirizzo postale", group: "Indirizzo postale" },
  { id: "Città indirizzo postale", label: "Città indirizzo postale", group: "Indirizzo postale" },
  { id: "Provincia indirizzo postale", label: "Provincia indirizzo postale", group: "Indirizzo postale" },
  { id: "Codice postale indirizzo", label: "Codice postale indirizzo", group: "Indirizzo postale" },
  // Note e stato
  { id: "Descrizione", label: "Descrizione", group: "Note e stato" },
  { id: "Modalità iscrizione annullata", label: "Modalità iscrizione annullata", group: "Note e stato" },
  { id: "Ora iscrizione annullata", label: "Ora iscrizione annullata", group: "Note e stato" },
  { id: "Stato", label: "Stato", group: "Note e stato", defaultVisible: true },
  { id: "Note", label: "Note", group: "Note e stato" },
  { id: "Note ufficio", label: "Note ufficio", group: "Note e stato" },
  { id: "Note pagamenti", label: "Note pagamenti", group: "Note e stato" },
  { id: "Note Provvigioni", label: "Note Provvigioni", group: "Note e stato" },
  // Tracking visite sito
  { id: "Visita più recente", label: "Visita più recente", group: "Tracking visite sito" },
  { id: "Prima pagina visitata", label: "Prima pagina visitata", group: "Tracking visite sito" },
  { id: "Tempo medio impiegato minuti", label: "Tempo medio impiegato minuti", group: "Tracking visite sito" },
  { id: "Numero di chat", label: "Numero di chat", group: "Tracking visite sito" },
  { id: "Relatore", label: "Relatore", group: "Tracking visite sito" },
  { id: "Punteggio visitatore", label: "Punteggio visitatore", group: "Tracking visite sito" },
  { id: "Prima visita", label: "Prima visita", group: "Tracking visite sito" },
  { id: "Giorni visitati", label: "Giorni visitati", group: "Tracking visite sito" },
  { id: "Social Lead ID", label: "Social Lead ID", group: "Tracking visite sito" },
  // Configurazione impianto
  { id: "COD. INVERTER", label: "COD. INVERTER", group: "Configurazione impianto" },
  { id: "COD- MODULI", label: "COD- MODULI", group: "Configurazione impianto" },
  { id: "COD. STORAGE", label: "COD. STORAGE", group: "Configurazione impianto" },
  { id: "DISPONIBILITA' MAGAZZINO", label: "DISPONIBILITA' MAGAZZINO", group: "Configurazione impianto" },
  { id: "Installatore", label: "Installatore", group: "Configurazione impianto" },
  { id: "Nr. Inverter", label: "Nr. Inverter", group: "Configurazione impianto" },
  { id: "Nr. Moduli", label: "Nr. Moduli", group: "Configurazione impianto" },
  { id: "Potenza Moduli Wp", label: "Potenza Moduli Wp", group: "Configurazione impianto" },
  { id: "Nr. Batterie", label: "Nr. Batterie", group: "Configurazione impianto" },
  { id: "Capacità Batterie", label: "Capacità Batterie", group: "Configurazione impianto" },
  { id: "Totale Storage", label: "Totale Storage", group: "Configurazione impianto" },
  { id: "Tot Potenza DC", label: "Tot Potenza DC", group: "Configurazione impianto" },
  { id: "Potenza Inverter", label: "Potenza Inverter", group: "Configurazione impianto" },
  { id: "Tot Potenza AC KW", label: "Tot Potenza AC KW", group: "Configurazione impianto" },
  { id: "Tipologia", label: "Tipologia", group: "Configurazione impianto" },
  { id: "Retrofit", label: "Retrofit", group: "Configurazione impianto" },
  { id: "EPS", label: "EPS", group: "Configurazione impianto" },
  { id: "Impianto in edilizia libera", label: "Impianto in edilizia libera", group: "Configurazione impianto" },
  { id: "Area vincolata", label: "Area vincolata", group: "Configurazione impianto" },
  { id: ">20kW Pot. Nom.", label: ">20kW Pot. Nom.", group: "Configurazione impianto" },
  { id: "Impianto Attivo", label: "Impianto Attivo", group: "Configurazione impianto" },
  { id: "ST300", label: "ST300", group: "Configurazione impianto" },
  { id: "Scaldacqua PDC", label: "Scaldacqua PDC", group: "Configurazione impianto" },
  { id: "PDC idronica", label: "PDC idronica", group: "Configurazione impianto" },
  { id: "P D C idronica", label: "P D C idronica", group: "Configurazione impianto" },
  { id: "STF", label: "STF", group: "Configurazione impianto" },
  { id: "Accessori", label: "Accessori", group: "Configurazione impianto" },
  { id: "Litri Accumulo", label: "Litri Accumulo", group: "Configurazione impianto" },
  { id: "N. Collettori", label: "N. Collettori", group: "Configurazione impianto" },
  // Pagamenti e finanziario
  { id: "Modalità di Pagamento", label: "Modalità di Pagamento", group: "Pagamenti e finanziario" },
  { id: "1° Tranche", label: "1° Tranche", group: "Pagamenti e finanziario" },
  { id: "Importo Contrattuale", label: "Importo Contrattuale", group: "Pagamenti e finanziario" },
  { id: "Bonifico Parziale", label: "Bonifico Parziale", group: "Pagamenti e finanziario" },
  { id: "Importo Finanziamento", label: "Importo Finanziamento", group: "Pagamenti e finanziario" },
  { id: "2°Tranche", label: "2°Tranche", group: "Pagamenti e finanziario" },
  { id: "Saldo", label: "Saldo", group: "Pagamenti e finanziario" },
  { id: "IBAN", label: "IBAN", group: "Pagamenti e finanziario" },
  { id: "Finanziamento approvato", label: "Finanziamento approvato", group: "Pagamenti e finanziario" },
  { id: "N. rate e importo rata", label: "N. rate e importo rata", group: "Pagamenti e finanziario" },
  { id: "Tot Contratto", label: "Tot Contratto", group: "Pagamenti e finanziario" },
  { id: "di cui CT3", label: "di cui CT3", group: "Pagamenti e finanziario" },
  { id: "di cui FTV", label: "di cui FTV", group: "Pagamenti e finanziario" },
  { id: "Sconto COMBO", label: "Sconto COMBO", group: "Pagamenti e finanziario" },
  { id: "Bonifico1", label: "Bonifico1", group: "Pagamenti e finanziario" },
  { id: "Bonifico2", label: "Bonifico2", group: "Pagamenti e finanziario" },
  { id: "BonificoPDC", label: "BonificoPDC", group: "Pagamenti e finanziario" },
  { id: "FatturaPDC", label: "FatturaPDC", group: "Pagamenti e finanziario" },
  { id: "IncentivoAtteso", label: "IncentivoAtteso", group: "Pagamenti e finanziario" },
  { id: "Iva Reverse charge", label: "Iva Reverse charge", group: "Pagamenti e finanziario" },
  { id: "IVA", label: "IVA", group: "Pagamenti e finanziario" },
  { id: "Importo da Listino", label: "Importo da Listino", group: "Pagamenti e finanziario" },
  { id: "Importo TICA", label: "Importo TICA", group: "Pagamenti e finanziario" },
  { id: "MOD. PAGAMENTO CT3.0", label: "MOD. PAGAMENTO CT3.0", group: "Pagamenti e finanziario" },
  // Logistica e cantiere
  { id: "Stratigrafia superficie di installazione", label: "Stratigrafia superficie di installazione", group: "Logistica e cantiere" },
  { id: "C/o magazzino installatore", label: "C/o magazzino installatore", group: "Logistica e cantiere" },
  { id: "Indirizzo di ritiro merce", label: "Indirizzo di ritiro merce", group: "Logistica e cantiere" },
  { id: "Merce ordinata e da ritirare", label: "Merce ordinata e da ritirare", group: "Logistica e cantiere" },
  { id: "C/o cantiere del cliente", label: "C/o cantiere del cliente", group: "Logistica e cantiere" },
  { id: "Altri materiali", label: "Altri materiali", group: "Logistica e cantiere" },
  { id: "Data installazione ultimata", label: "Data installazione ultimata", group: "Logistica e cantiere" },
  { id: "Data appuntamento allaccio", label: "Data appuntamento allaccio", group: "Logistica e cantiere" },
  { id: "Intervento 1", label: "Intervento 1", group: "Logistica e cantiere" },
  { id: "Intervento 2", label: "Intervento 2", group: "Logistica e cantiere" },
  // Documenti e pratiche
  { id: "Allegati", label: "Allegati", group: "Documenti e pratiche" },
  { id: "Mappa catastale", label: "Mappa catastale", group: "Documenti e pratiche" },
  { id: "Regolamento di esecizio", label: "Regolamento di esecizio", group: "Documenti e pratiche" },
  { id: "Attestato Terna", label: "Attestato Terna", group: "Documenti e pratiche" },
  { id: "Codice contratto PNRR", label: "Codice contratto PNRR", group: "Documenti e pratiche" },
  { id: "Scheda ENEA", label: "Scheda ENEA", group: "Documenti e pratiche" },
  { id: "Verifica documentale", label: "Verifica documentale", group: "Documenti e pratiche" },
  { id: "Layout verificato", label: "Layout verificato", group: "Documenti e pratiche" },
  { id: "Fattura1", label: "Fattura1", group: "Documenti e pratiche" },
  { id: "Fattura2", label: "Fattura2", group: "Documenti e pratiche" },
  // Iter burocratico
  { id: "Inserimento pratica GSE", label: "Inserimento pratica GSE", group: "Iter burocratico" },
  { id: "Inserimento pratica E-Distribuzione", label: "Inserimento pratica E-Distribuzione", group: "Iter burocratico" },
  { id: "POD", label: "POD", group: "Iter burocratico" },
  { id: "Zona", label: "Zona", group: "Iter burocratico" },
  { id: "Data ammissibilità", label: "Data ammissibilità", group: "Iter burocratico" },
  { id: "Data sopralluogo", label: "Data sopralluogo", group: "Iter burocratico" },
  { id: "Data affidamento sopralluogo", label: "Data affidamento sopralluogo", group: "Iter burocratico" },
  { id: "Stato sopralluogo", label: "Stato sopralluogo", group: "Iter burocratico" },
  { id: "Data conferma Iter E-distribuzione", label: "Data conferma Iter E-distribuzione", group: "Iter burocratico" },
  { id: "Notifica pred. reg. esercizio", label: "Notifica pred. reg. esercizio", group: "Iter burocratico" },
  { id: "Disponibilità Fine lavori", label: "Disponibilità Fine lavori", group: "Iter burocratico" },
  { id: "Tica", label: "Tica", group: "Iter burocratico" },
  { id: "Stato TICA", label: "Stato TICA", group: "Iter burocratico" },
  { id: "Data scadenza TICA", label: "Data scadenza TICA", group: "Iter burocratico" },
  { id: "Data iter Enel Concluso", label: "Data iter Enel Concluso", group: "Iter burocratico" },
  { id: "TIPO CTR", label: "TIPO CTR", group: "Iter burocratico" },
  { id: "Stato Sollecito", label: "Stato Sollecito", group: "Iter burocratico" },
  { id: "Data interlocutorio", label: "Data interlocutorio", group: "Iter burocratico" },
  // Comunicazioni automatiche
  { id: "Messaggio di benvenuto", label: "Messaggio di benvenuto", group: "Comunicazioni automatiche" },
  { id: "Messaggio prog. preliminare", label: "Messaggio prog. preliminare", group: "Comunicazioni automatiche" },
  { id: "Messaggio ordine merce", label: "Messaggio ordine merce", group: "Comunicazioni automatiche" },
  { id: "Messaggio in esecuzione", label: "Messaggio in esecuzione", group: "Comunicazioni automatiche" },
  { id: "Telefonata post installazione", label: "Telefonata post installazione", group: "Comunicazioni automatiche" },
  { id: "Messaggio Fattura", label: "Messaggio Fattura", group: "Comunicazioni automatiche" },
  { id: "Corrispettivo pagato", label: "Corrispettivo pagato", group: "Comunicazioni automatiche" },
  { id: "Data Click", label: "Data Click", group: "Comunicazioni automatiche" },
  { id: "Assistenza", label: "Assistenza", group: "Comunicazioni automatiche" },
  // Provvigioni
  { id: "Codice rintracciabilità", label: "Codice rintracciabilità", group: "Provvigioni" },
  { id: "Stato Provvigione", label: "Stato Provvigione", group: "Provvigioni" },
]

// Ordine colonne di default in tabella (segue il prompt Step 4)
export const DEFAULT_CLIENTE_COLUMNS: ClienteColumnId[] = [
  "Badge dell'attività",
  "Badge di nota",
  "Tag",
  "Nome Clienti",
  "Clienti Proprietario",
  "Sede",
  "Stato",
  "Cellulare",
  "E-mail",
  "Ora modifica",
]

export const STATO_CLIENTE_VALUES: StatoCliente[] = [
  "Nuovo contratto digitale",
  "Fin da firmare",
  "Attesa cliente",
  "Iter in corso",
  "In esecuzione",
  "Installazione completata",
  "Emessa fattura",
  "Chiuso",
]

export const STATO_CLIENTE_TONE: Record<
  StatoCliente,
  "muted" | "success" | "warning" | "info" | "teal" | "destructive"
> = {
  "Nuovo contratto digitale": "info",
  "Fin da firmare": "warning",
  "Attesa cliente": "muted",
  "Iter in corso": "warning",
  "In esecuzione": "teal",
  "Installazione completata": "success",
  "Emessa fattura": "success",
  Chiuso: "muted",
}

export const CLIENTI_TOTAL = 1842

export const mockClienti: ClienteRecord[] = [
  {
    id: "cli-1",
    "Badge dell'attività": true,
    "Badge di nota": false,
    "Nome Clienti": "Quinto Pietro",
    "E-mail": "cosmetikline@libero.it",
    "Ora modifica": "18/06/2025 09:14",
    Tag: [],
    Sede: "Catania",
    "Clienti Proprietario": "Gaetano Grasso",
    "Origine Lead": "Facebook",
    Nome: "Pietro",
    Cognome: "Quinto",
    Cellulare: "+39 348 1122334",
    "Creato da": "Gaetano Grasso",
    "Ora creazione": "02/04/2025 11:20",
    Saluti: "Sig.",
    Stato: "Nuovo contratto digitale",
    Installatore: "PM-Technology",
  },
  {
    id: "cli-2",
    "Badge dell'attività": false,
    "Badge di nota": true,
    "Nome Clienti": "Andrea Mazzotti",
    "E-mail": "kilwa76@gmail.com",
    "Ora modifica": "17/06/2025 16:48",
    Tag: [],
    Sede: "Treviso",
    "Clienti Proprietario": "Mariarosa De Leo",
    "Origine Lead": "Sito web",
    Nome: "Andrea",
    Cognome: "Mazzotti",
    Cellulare: "+39 333 9988776",
    "Creato da": "Mariarosa De Leo",
    "Ora creazione": "28/03/2025 09:05",
    Saluti: "Sig.",
    Stato: "Nuovo contratto digitale",
    Installatore: "DIESSE IMPIANTI",
    Note: "Cliente interessato a storage aggiuntivo.",
  },
  {
    id: "cli-3",
    "Badge dell'attività": false,
    "Badge di nota": false,
    "Nome Clienti": "Michela Baronti",
    "E-mail": "michelabaronti@gmail.com",
    "Ora modifica": "17/06/2025 10:32",
    Tag: [],
    Sede: "Porto Sant'Elpidio",
    "Clienti Proprietario": "Ivan Lo Faro",
    "Origine Lead": "Pubblicità",
    Nome: "Michela",
    Cognome: "Baronti",
    Cellulare: "+39 340 5566778",
    "Creato da": "Ivan Lo Faro",
    "Ora creazione": "15/03/2025 14:50",
    Saluti: "Sig.ra",
    Stato: "Nuovo contratto digitale",
    Installatore: "DG Impianti",
  },
  {
    id: "cli-4",
    "Badge dell'attività": true,
    "Badge di nota": true,
    "Nome Clienti": "Luca Mantovani",
    "E-mail": "mantovaniluca@hotmail.com",
    "Ora modifica": "16/06/2025 12:05",
    Tag: [],
    Sede: "Torino",
    "Clienti Proprietario": "Fabio Tizi",
    "Origine Lead": "Facebook",
    Nome: "Luca",
    Cognome: "Mantovani",
    Cellulare: "+39 347 2233445",
    "Creato da": "Fabio Tizi",
    "Ora creazione": "10/03/2025 08:30",
    Saluti: "Sig.",
    Stato: "Nuovo contratto digitale",
    Installatore: "Bmax",
  },
  {
    id: "cli-5",
    "Badge dell'attività": false,
    "Badge di nota": false,
    "Nome Clienti": "Gianluca Piccioni",
    "E-mail": "gianlucapiccioni72@gmail.com",
    "Ora modifica": "16/06/2025 08:51",
    Tag: [],
    Sede: "Catania",
    "Clienti Proprietario": "Cristian Virzì",
    "Origine Lead": "Sito web",
    Nome: "Gianluca",
    Cognome: "Piccioni",
    Cellulare: "+39 349 6677889",
    "Creato da": "Cristian Virzì",
    "Ora creazione": "05/03/2025 17:10",
    Saluti: "Sig.",
    Stato: "Nuovo contratto digitale",
    Installatore: "Ca.Gi Srl",
    Accessori: "Wallbox 7,4 kW",
    Note: "Richiesta installazione wallbox in garage.",
  },
  {
    id: "cli-6",
    "Badge dell'attività": true,
    "Badge di nota": false,
    "Nome Clienti": "Giuseppe Patanè",
    "E-mail": "venerapatan@gmail.com",
    "Ora modifica": "15/06/2025 19:22",
    Tag: [],
    Sede: "Giarre (CT)",
    "Clienti Proprietario": "Filippo Ferrara",
    "Origine Lead": "Manuale",
    Nome: "Giuseppe",
    Cognome: "Patanè",
    Cellulare: "+39 346 1212343",
    "Creato da": "Filippo Ferrara",
    "Ora creazione": "20/02/2025 10:00",
    Saluti: "Sig.",
    Stato: "Fin da firmare",
    Installatore: "Solair Group srl",
    "Modalità di Pagamento": "Finanziamento",
    "Finanziamento approvato": false,
  },
  {
    id: "cli-7",
    "Badge dell'attività": false,
    "Badge di nota": true,
    "Nome Clienti": "Giangi Parigini",
    "E-mail": "giangiacomo.parigini@gmail.com",
    "Ora modifica": "14/06/2025 11:47",
    Tag: [],
    Sede: "Treviso",
    "Clienti Proprietario": "Gianluca Silvestro",
    "Origine Lead": "Facebook",
    Nome: "Giangiacomo",
    Cognome: "Parigini",
    Cellulare: "+39 333 4545656",
    "Creato da": "Gianluca Silvestro",
    "Ora creazione": "18/02/2025 13:25",
    Saluti: "Sig.",
    Stato: "Attesa cliente",
    Installatore: "DIESSE IMPIANTI",
    Note: "In attesa documentazione catastale dal cliente.",
  },
  {
    id: "cli-8",
    "Badge dell'attività": true,
    "Badge di nota": false,
    "Nome Clienti": "Francesca Lo Gioco",
    "E-mail": "fabiogirolimetto98@gmail.com",
    "Ora modifica": "13/06/2025 15:38",
    Tag: [],
    Sede: "Porto Sant'Elpidio",
    "Clienti Proprietario": "Mariarosa De Leo",
    "Origine Lead": "Pubblicità",
    Nome: "Francesca",
    Cognome: "Lo Gioco",
    Cellulare: "+39 340 7878989",
    "Creato da": "Mariarosa De Leo",
    "Ora creazione": "12/02/2025 09:40",
    Saluti: "Sig.ra",
    Stato: "Nuovo contratto digitale",
    Installatore: "DG Impianti",
    "C/o cantiere del cliente": "Due cantieri: abitazione + capannone",
    Note: "Cantiere multiplo, coordinare sopralluoghi.",
  },
  {
    id: "cli-9",
    "Badge dell'attività": false,
    "Badge di nota": true,
    "Nome Clienti": "Giovanni Torrisi",
    "E-mail": "giovanni.torrisi@uniurb.it",
    "Ora modifica": "12/06/2025 18:02",
    Tag: [],
    Sede: "Catania",
    "Clienti Proprietario": "Gaetano Grasso",
    "Origine Lead": "Sito web",
    Nome: "Giovanni",
    Cognome: "Torrisi",
    Cellulare: "+39 348 3434545",
    "Creato da": "Gaetano Grasso",
    "Ora creazione": "30/01/2025 11:15",
    Saluti: "Dott.",
    Stato: "Emessa fattura",
    Installatore: "PM-Technology",
    "Corrispettivo pagato": true,
    "Messaggio Fattura": true,
    Fattura1: "FT-2025-0142.pdf",
    "Importo Contrattuale": 18500,
    Saldo: 0,
  },
  {
    id: "cli-10",
    "Badge dell'attività": true,
    "Badge di nota": true,
    "Nome Clienti": "Maria Cristina Greco",
    "E-mail": "mc.greco@solairgroup.it",
    "Ora modifica": "19/06/2025 14:55",
    Tag: [],
    Sede: "Catania",
    "Clienti Proprietario": "Cristian Virzì",
    "Origine Lead": "Facebook",
    Nome: "Maria Cristina",
    Cognome: "Greco",
    "Altro telefono": "+39 095 7654321",
    Cellulare: "+39 349 1029384",
    "Creato da": "Cristian Virzì",
    "Modificato da": "Gaetano Grasso",
    "Ora creazione": "08/01/2025 09:00",
    "Ora ultima attività": "19/06/2025 14:55",
    Saluti: "Sig.ra",
    "E-mail secondaria": "cristina.greco.privata@gmail.com",
    "Codice fiscale": "GRCMCR80A41C351K",
    "Via indirizzo postale": "Via Etnea 245",
    "Città indirizzo postale": "Catania",
    "Provincia indirizzo postale": "CT",
    "Codice postale indirizzo": "95128",
    Descrizione: "Impianto residenziale con storage e wallbox, pratica PNRR.",
    Stato: "In esecuzione",
    Note: "Cliente molto collaborativa, documentazione completa.",
    "Note ufficio": "Verificare conformità layout prima dell'ordine.",
    "Note pagamenti": "Acconto ricevuto, saldo a fine lavori.",
    "Visita più recente": "17/06/2025 21:30",
    "Prima pagina visitata": "/fotovoltaico-residenziale",
    "Tempo medio impiegato minuti": 7,
    "Numero di chat": 2,
    "Punteggio visitatore": 88,
    "Prima visita": "20/12/2024 18:10",
    "Giorni visitati": 5,
    "COD. INVERTER": "INV-HUAWEI-SUN2000-6KTL",
    "COD- MODULI": "MOD-JINKO-440N",
    "COD. STORAGE": "STG-HUAWEI-LUNA2000-10",
    "DISPONIBILITA' MAGAZZINO": "Disponibile",
    Installatore: "Solair Group srl",
    "Nr. Inverter": 1,
    "Nr. Moduli": 16,
    "Potenza Moduli Wp": 440,
    "Nr. Batterie": 2,
    "Capacità Batterie": "10 kWh",
    "Totale Storage": "10 kWh",
    "Tot Potenza DC": "7,04 kWp",
    "Potenza Inverter": "6 kW",
    "Tot Potenza AC KW": 6,
    Tipologia: "Monofase",
    Retrofit: false,
    EPS: true,
    "Impianto in edilizia libera": true,
    "Area vincolata": false,
    ">20kW Pot. Nom.": false,
    "Impianto Attivo": false,
    Accessori: "Wallbox 7,4 kW, ottimizzatori",
    "Modalità di Pagamento": "Bonifico + Finanziamento",
    "1° Tranche": "5.000 €",
    "Importo Contrattuale": 22400,
    "Importo Finanziamento": 15000,
    "2°Tranche": "7.400 €",
    Saldo: 10000,
    IBAN: "IT60X0542811101000000123456",
    "Finanziamento approvato": true,
    "N. rate e importo rata": "120 x 145 €",
    "Tot Contratto": 22400,
    "di cui CT3": 4200,
    "di cui FTV": 18200,
    "Sconto COMBO": 1500,
    IncentivoAtteso: 3360,
    "Iva Reverse charge": false,
    IVA: 10,
    "Importo da Listino": 23900,
    "MOD. PAGAMENTO CT3.0": "Cessione del credito",
    "C/o cantiere del cliente": "Abitazione principale",
    "Data installazione ultimata": "10/06/2025",
    "Data appuntamento allaccio": "25/06/2025 09:00",
    "Intervento 1": "Posa moduli e inverter",
    "Intervento 2": "Installazione storage",
    Allegati: ["contratto.pdf", "visura-catastale.pdf", "layout.pdf"],
    "Mappa catastale": "mappa-catastale-greco.pdf",
    "Regolamento di esecizio": "reg-esercizio.pdf",
    "Attestato Terna": "attestato-terna.pdf",
    "Codice contratto PNRR": "PNRR-2025-00874",
    "Scheda ENEA": "scheda-enea.pdf",
    "Verifica documentale": true,
    "Layout verificato": true,
    "Inserimento pratica GSE": "12/06/2025",
    "Inserimento pratica E-Distribuzione": "11/06/2025",
    POD: "IT001E12345678",
    Zona: "Sud",
    "Data ammissibilità": "14/06/2025",
    "Data sopralluogo": "15/05/2025",
    "Stato sopralluogo": "Completato",
    "Data conferma Iter E-distribuzione": "16/06/2025",
    "Notifica pred. reg. esercizio": true,
    "Disponibilità Fine lavori": true,
    Tica: "TICA-2025-552",
    "Stato TICA": "Accettata",
    "Data scadenza TICA": "30/09/2025",
    "TIPO CTR": "Residenziale",
    "Stato Sollecito": "Nessuno",
    "Messaggio di benvenuto": true,
    "Messaggio prog. preliminare": true,
    "Messaggio ordine merce": true,
    "Messaggio in esecuzione": true,
    "Telefonata post installazione": false,
    "Messaggio Fattura": false,
    "Corrispettivo pagato": false,
    "Data Click": "08/01/2025 09:02",
    Assistenza: "Nessuna richiesta aperta",
    "Codice rintracciabilità": "RTR-GR-0010",
    "Stato Provvigione": "Da liquidare",
  },
  {
    id: "cli-11",
    "Badge dell'attività": false,
    "Badge di nota": false,
    "Nome Clienti": "Salvatore Rizzo",
    "E-mail": "salvo.rizzo@gmail.com",
    "Ora modifica": "11/06/2025 10:18",
    Tag: [],
    Sede: "Giarre (CT)",
    "Clienti Proprietario": "Filippo Ferrara",
    "Origine Lead": "Manuale",
    Nome: "Salvatore",
    Cognome: "Rizzo",
    Cellulare: "+39 347 5050606",
    "Creato da": "Filippo Ferrara",
    "Ora creazione": "22/01/2025 15:30",
    Saluti: "Sig.",
    Stato: "Installazione completata",
    Installatore: "DG Impianti",
    "Impianto Attivo": true,
    "Tot Potenza AC KW": 4.5,
    "Importo Contrattuale": 12900,
  },
]

export function getClienteById(id: string): ClienteRecord | undefined {
  return mockClienti.find((c) => c.id === id)
}

// ============================================================================
// MODULO COMPITI (Tasks)
// ============================================================================

export type StatoCompito = "Da fare" | "In corso" | "In attesa" | "Completato"

export type PrioritaCompito = "Alto" | "Medio" | "Basso"

export interface CompitoNota {
  id: string
  testo: string
  autore: string
  data: string
}

export interface Compito {
  id: string
  Oggetto: string
  Stato: StatoCompito
  Priorità: PrioritaCompito
  "Data di scadenza": string // DD/MM/YYYY
  "Proprietario del compito": string
  Sede: SedeLabel
  "Correlato a": { tipo: "Lead" | "Cliente"; id: string; nome: string } | null
  Descrizione: string
  Promemoria: string | null
  "Data di creazione": string
  "Orario di chiusura": string | null
  Note: CompitoNota[]
}

export const STATO_COMPITO_ORDER: StatoCompito[] = [
  "Da fare",
  "In corso",
  "In attesa",
  "Completato",
]

export const STATO_COMPITO_TONE: Record<StatoCompito, string> = {
  "Da fare": "bg-secondary text-secondary-foreground",
  "In corso": "bg-info/15 text-info",
  "In attesa": "bg-warning/15 text-warning",
  Completato: "bg-success/15 text-success",
}

export const PRIORITA_COMPITO_ORDER: PrioritaCompito[] = ["Alto", "Medio", "Basso"]

export const PRIORITA_COMPITO_TONE: Record<PrioritaCompito, string> = {
  Alto: "bg-destructive/12 text-destructive",
  Medio: "bg-warning/15 text-warning",
  Basso: "bg-secondary text-muted-foreground",
}

export const mockProprietariCompito: string[] = [
  "Marco Rossi",
  "Giulia Bianchi",
  "Luca Ferrari",
  "Sara Esposto",
  "Andrea Greco",
  "Elena Conti",
]

export const COMPITI_TOTAL = 1247

export function compitoInitials(nome: string): string {
  return nome
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/** Converte DD/MM/YYYY in Date (mezzanotte locale). */
function parseDMY(d: string): Date | null {
  const [day, m, y] = d.split("/")
  if (!day || !m || !y) return null
  return new Date(Number(y), Number(m) - 1, Number(day))
}

/** "Oggi" coerente con la data di sistema dell'app (20/06/2026). */
const COMPITI_TODAY = new Date(2026, 5, 20)

export function isCompitoScaduto(c: Compito): boolean {
  if (c.Stato === "Completato") return false
  const due = parseDMY(c["Data di scadenza"])
  if (!due) return false
  return due.getTime() < COMPITI_TODAY.getTime()
}

export const mockCompiti: Compito[] = [
  {
    id: "task-001",
    Oggetto: "Richiamare per conferma sopralluogo",
    Stato: "Da fare",
    Priorità: "Alto",
    "Data di scadenza": "18/06/2026",
    "Proprietario del compito": "Marco Rossi",
    Sede: "Catania",
    "Correlato a": { tipo: "Lead", id: "lead-001", nome: "Andrea Cocita" },
    Descrizione:
      "Confermare la data del sopralluogo tecnico per l'impianto fotovoltaico da 6 kW.",
    Promemoria: "18/06/2026 09:00",
    "Data di creazione": "12/06/2026 14:20",
    "Orario di chiusura": null,
    Note: [
      {
        id: "n1",
        testo: "Cliente preferisce essere contattato dopo le 17.",
        autore: "Marco Rossi",
        data: "13/06/2026 10:05",
      },
    ],
  },
  {
    id: "task-002",
    Oggetto: "Inviare preventivo aggiornato impianto 4.5 kW",
    Stato: "In corso",
    Priorità: "Alto",
    "Data di scadenza": "21/06/2026",
    "Proprietario del compito": "Giulia Bianchi",
    Sede: "Treviso",
    "Correlato a": { tipo: "Cliente", id: "cli-001", nome: "Famiglia Russo" },
    Descrizione:
      "Aggiornare il preventivo con il nuovo listino moduli e inviarlo via email.",
    Promemoria: null,
    "Data di creazione": "15/06/2026 09:00",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-003",
    Oggetto: "Sollecitare firma contratto digitale",
    Stato: "In attesa",
    Priorità: "Medio",
    "Data di scadenza": "23/06/2026",
    "Proprietario del compito": "Luca Ferrari",
    Sede: "Torino",
    "Correlato a": { tipo: "Cliente", id: "cli-002", nome: "Salvatore Greco" },
    Descrizione: "Il cliente ha ricevuto il link per la firma ma non ha ancora firmato.",
    Promemoria: "23/06/2026 11:00",
    "Data di creazione": "16/06/2026 16:40",
    "Orario di chiusura": null,
    Note: [
      {
        id: "n1",
        testo: "In attesa che il cliente recuperi lo SPID.",
        autore: "Luca Ferrari",
        data: "17/06/2026 12:00",
      },
    ],
  },
  {
    id: "task-004",
    Oggetto: "Verificare documentazione GSE",
    Stato: "Completato",
    Priorità: "Medio",
    "Data di scadenza": "14/06/2026",
    "Proprietario del compito": "Sara Esposto",
    Sede: "Catania",
    "Correlato a": { tipo: "Cliente", id: "cli-003", nome: "Maria Lombardo" },
    Descrizione: "Controllare che la pratica GSE sia completa prima dell'invio.",
    Promemoria: null,
    "Data di creazione": "10/06/2026 08:30",
    "Orario di chiusura": "13/06/2026 17:15",
    Note: [],
  },
  {
    id: "task-005",
    Oggetto: "Programmare installazione inverter",
    Stato: "Da fare",
    Priorità: "Alto",
    "Data di scadenza": "25/06/2026",
    "Proprietario del compito": "Andrea Greco",
    Sede: "Giarre (CT)",
    "Correlato a": { tipo: "Cliente", id: "cli-004", nome: "Giuseppe Marino" },
    Descrizione: "Coordinare con l'installatore la data di posa dell'inverter ibrido.",
    Promemoria: "24/06/2026 08:00",
    "Data di creazione": "17/06/2026 11:10",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-006",
    Oggetto: "Follow-up post-installazione",
    Stato: "Da fare",
    Priorità: "Basso",
    "Data di scadenza": "30/06/2026",
    "Proprietario del compito": "Elena Conti",
    Sede: "Porto Sant'Elpidio",
    "Correlato a": { tipo: "Cliente", id: "cli-005", nome: "Antonio Caruso" },
    Descrizione: "Verificare la soddisfazione del cliente e proporre il monitoraggio.",
    Promemoria: null,
    "Data di creazione": "18/06/2026 15:00",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-007",
    Oggetto: "Raccogliere bolletta per dimensionamento",
    Stato: "In corso",
    Priorità: "Medio",
    "Data di scadenza": "19/06/2026",
    "Proprietario del compito": "Marco Rossi",
    Sede: "Catania",
    "Correlato a": { tipo: "Lead", id: "lead-002", nome: "Concetta Privitera" },
    Descrizione: "Richiedere l'ultima bolletta per calcolare il fabbisogno annuo.",
    Promemoria: null,
    "Data di creazione": "14/06/2026 10:00",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-008",
    Oggetto: "Preparare contratto per appuntamento",
    Stato: "In attesa",
    Priorità: "Alto",
    "Data di scadenza": "22/06/2026",
    "Proprietario del compito": "Giulia Bianchi",
    Sede: "Treviso",
    "Correlato a": { tipo: "Lead", id: "lead-003", nome: "Vincenzo Lo Bianco" },
    Descrizione: "Predisporre il contratto digitale per l'incontro in sede.",
    Promemoria: "22/06/2026 15:30",
    "Data di creazione": "16/06/2026 09:45",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-009",
    Oggetto: "Chiamata di benvenuto nuovo cliente",
    Stato: "Completato",
    Priorità: "Basso",
    "Data di scadenza": "12/06/2026",
    "Proprietario del compito": "Luca Ferrari",
    Sede: "Torino",
    "Correlato a": { tipo: "Cliente", id: "cli-006", nome: "Rosa Calabrese" },
    Descrizione: "Presentare i prossimi step e i riferimenti del referente tecnico.",
    Promemoria: null,
    "Data di creazione": "08/06/2026 14:00",
    "Orario di chiusura": "11/06/2026 16:20",
    Note: [],
  },
  {
    id: "task-010",
    Oggetto: "Sollecito saldo finale impianto",
    Stato: "Da fare",
    Priorità: "Alto",
    "Data di scadenza": "17/06/2026",
    "Proprietario del compito": "Sara Esposto",
    Sede: "Catania",
    "Correlato a": { tipo: "Cliente", id: "cli-007", nome: "Domenico Rizzo" },
    Descrizione: "Inviare promemoria per il pagamento del saldo a installazione conclusa.",
    Promemoria: "17/06/2026 10:00",
    "Data di creazione": "11/06/2026 11:30",
    "Orario di chiusura": null,
    Note: [
      {
        id: "n1",
        testo: "Promesso pagamento entro fine settimana.",
        autore: "Sara Esposto",
        data: "16/06/2026 09:00",
      },
    ],
  },
  {
    id: "task-011",
    Oggetto: "Sopralluogo tecnico tetto a falde",
    Stato: "In corso",
    Priorità: "Medio",
    "Data di scadenza": "24/06/2026",
    "Proprietario del compito": "Andrea Greco",
    Sede: "Giarre (CT)",
    "Correlato a": { tipo: "Lead", id: "lead-004", nome: "Carmela Santoro" },
    Descrizione: "Valutare esposizione e ombreggiamenti per il dimensionamento.",
    Promemoria: null,
    "Data di creazione": "17/06/2026 08:15",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-012",
    Oggetto: "Inviare scheda tecnica batteria di accumulo",
    Stato: "Da fare",
    Priorità: "Basso",
    "Data di scadenza": "27/06/2026",
    "Proprietario del compito": "Elena Conti",
    Sede: "Porto Sant'Elpidio",
    "Correlato a": { tipo: "Cliente", id: "cli-008", nome: "Francesco Parisi" },
    Descrizione: "Condividere le specifiche del sistema di accumulo da 10 kWh.",
    Promemoria: null,
    "Data di creazione": "18/06/2026 13:20",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-013",
    Oggetto: "Aggiornare stato pratica Enel",
    Stato: "In attesa",
    Priorità: "Medio",
    "Data di scadenza": "26/06/2026",
    "Proprietario del compito": "Marco Rossi",
    Sede: "Catania",
    "Correlato a": { tipo: "Cliente", id: "cli-009", nome: "Agata Fichera" },
    Descrizione: "Verificare l'avanzamento della pratica di connessione con il distributore.",
    Promemoria: "26/06/2026 09:30",
    "Data di creazione": "15/06/2026 17:00",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-014",
    Oggetto: "Richiamare lead non risposto",
    Stato: "Da fare",
    Priorità: "Medio",
    "Data di scadenza": "16/06/2026",
    "Proprietario del compito": "Giulia Bianchi",
    Sede: "Treviso",
    "Correlato a": { tipo: "Lead", id: "lead-005", nome: "Giovanni Messina" },
    Descrizione: "Secondo tentativo di contatto dopo mancata risposta.",
    Promemoria: null,
    "Data di creazione": "13/06/2026 10:40",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-015",
    Oggetto: "Programmare collaudo impianto",
    Stato: "Completato",
    Priorità: "Alto",
    "Data di scadenza": "10/06/2026",
    "Proprietario del compito": "Luca Ferrari",
    Sede: "Torino",
    "Correlato a": { tipo: "Cliente", id: "cli-010", nome: "Pietro Gulino" },
    Descrizione: "Fissare la data del collaudo con il tecnico abilitato.",
    Promemoria: null,
    "Data di creazione": "05/06/2026 09:00",
    "Orario di chiusura": "09/06/2026 12:00",
    Note: [],
  },
  {
    id: "task-016",
    Oggetto: "Inviare contratto di manutenzione",
    Stato: "Da fare",
    Priorità: "Basso",
    "Data di scadenza": "29/06/2026",
    "Proprietario del compito": "Sara Esposto",
    Sede: "Catania",
    "Correlato a": { tipo: "Cliente", id: "cli-011", nome: "Lucia Amato" },
    Descrizione: "Proporre il piano di manutenzione annuale.",
    Promemoria: null,
    "Data di creazione": "18/06/2026 16:10",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-017",
    Oggetto: "Verifica pratica detrazione fiscale",
    Stato: "In corso",
    Priorità: "Medio",
    "Data di scadenza": "28/06/2026",
    "Proprietario del compito": "Andrea Greco",
    Sede: "Giarre (CT)",
    "Correlato a": { tipo: "Cliente", id: "cli-012", nome: "Sebastiano Lo Giudice" },
    Descrizione: "Controllare i documenti per la detrazione del 50%.",
    Promemoria: null,
    "Data di creazione": "17/06/2026 14:30",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-018",
    Oggetto: "Appuntamento commerciale in sede",
    Stato: "In attesa",
    Priorità: "Alto",
    "Data di scadenza": "20/06/2026",
    "Proprietario del compito": "Elena Conti",
    Sede: "Porto Sant'Elpidio",
    "Correlato a": { tipo: "Lead", id: "lead-006", nome: "Rosario Tumino" },
    Descrizione: "Incontro per illustrare l'offerta e firmare la proposta.",
    Promemoria: "20/06/2026 16:00",
    "Data di creazione": "16/06/2026 11:00",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-019",
    Oggetto: "Caricare foto impianto su gestionale",
    Stato: "Completato",
    Priorità: "Basso",
    "Data di scadenza": "13/06/2026",
    "Proprietario del compito": "Marco Rossi",
    Sede: "Catania",
    "Correlato a": { tipo: "Cliente", id: "cli-013", nome: "Nunzio Spadaro" },
    Descrizione: "Allegare le foto del cantiere alla scheda cliente.",
    Promemoria: null,
    "Data di creazione": "12/06/2026 09:20",
    "Orario di chiusura": "12/06/2026 18:00",
    Note: [],
  },
  {
    id: "task-020",
    Oggetto: "Chiamare per recensione Google",
    Stato: "Da fare",
    Priorità: "Basso",
    "Data di scadenza": "02/07/2026",
    "Proprietario del compito": "Giulia Bianchi",
    Sede: "Treviso",
    "Correlato a": { tipo: "Cliente", id: "cli-014", nome: "Daniela Vitale" },
    Descrizione: "Chiedere al cliente soddisfatto una recensione online.",
    Promemoria: null,
    "Data di creazione": "18/06/2026 17:30",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-021",
    Oggetto: "Sollecito documenti per finanziamento",
    Stato: "In corso",
    Priorità: "Alto",
    "Data di scadenza": "19/06/2026",
    "Proprietario del compito": "Luca Ferrari",
    Sede: "Torino",
    "Correlato a": { tipo: "Cliente", id: "cli-015", nome: "Alfio Costa" },
    Descrizione: "Mancano busta paga e documento d'identità per la pratica.",
    Promemoria: "19/06/2026 09:00",
    "Data di creazione": "15/06/2026 10:15",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-022",
    Oggetto: "Pianificare consegna materiale",
    Stato: "Da fare",
    Priorità: "Medio",
    "Data di scadenza": "01/07/2026",
    "Proprietario del compito": "Sara Esposto",
    Sede: "Catania",
    "Correlato a": { tipo: "Cliente", id: "cli-016", nome: "Grazia Pellegrino" },
    Descrizione: "Coordinare con il magazzino la consegna dei moduli.",
    Promemoria: null,
    "Data di creazione": "18/06/2026 12:00",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-023",
    Oggetto: "Risolvere segnalazione monitoraggio",
    Stato: "In attesa",
    Priorità: "Alto",
    "Data di scadenza": "20/06/2026",
    "Proprietario del compito": "Andrea Greco",
    Sede: "Giarre (CT)",
    "Correlato a": { tipo: "Cliente", id: "cli-017", nome: "Mario Floridia" },
    Descrizione: "Anomalia di produzione segnalata dal portale di monitoraggio.",
    Promemoria: "20/06/2026 11:00",
    "Data di creazione": "17/06/2026 18:40",
    "Orario di chiusura": null,
    Note: [
      {
        id: "n1",
        testo: "In attesa di feedback dall'assistenza inverter.",
        autore: "Andrea Greco",
        data: "18/06/2026 10:00",
      },
    ],
  },
  {
    id: "task-024",
    Oggetto: "Invio questionario soddisfazione",
    Stato: "Completato",
    Priorità: "Basso",
    "Data di scadenza": "11/06/2026",
    "Proprietario del compito": "Elena Conti",
    Sede: "Porto Sant'Elpidio",
    "Correlato a": null,
    Descrizione: "Inviare il modulo di customer satisfaction ai clienti del mese.",
    Promemoria: null,
    "Data di creazione": "09/06/2026 09:00",
    "Orario di chiusura": "10/06/2026 15:30",
    Note: [],
  },
  {
    id: "task-025",
    Oggetto: "Preparare offerta colonnina di ricarica",
    Stato: "Da fare",
    Priorità: "Medio",
    "Data di scadenza": "03/07/2026",
    "Proprietario del compito": "Marco Rossi",
    Sede: "Catania",
    "Correlato a": { tipo: "Lead", id: "lead-007", nome: "Salvo Indelicato" },
    Descrizione: "Quotazione per wallbox da 7.4 kW abbinata all'impianto.",
    Promemoria: null,
    "Data di creazione": "18/06/2026 11:45",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-026",
    Oggetto: "Ricontattare lead freddo",
    Stato: "Da fare",
    Priorità: "Basso",
    "Data di scadenza": "15/06/2026",
    "Proprietario del compito": "Giulia Bianchi",
    Sede: "Treviso",
    "Correlato a": { tipo: "Lead", id: "lead-008", nome: "Teresa Catalano" },
    Descrizione: "Tentativo di riattivazione dopo due mesi di silenzio.",
    Promemoria: null,
    "Data di creazione": "12/06/2026 16:00",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-027",
    Oggetto: "Confermare data allaccio",
    Stato: "In corso",
    Priorità: "Alto",
    "Data di scadenza": "23/06/2026",
    "Proprietario del compito": "Luca Ferrari",
    Sede: "Torino",
    "Correlato a": { tipo: "Cliente", id: "cli-018", nome: "Orazio Pappalardo" },
    Descrizione: "Definire con il distributore la data di allaccio alla rete.",
    Promemoria: "23/06/2026 08:30",
    "Data di creazione": "16/06/2026 14:00",
    "Orario di chiusura": null,
    Note: [],
  },
  {
    id: "task-028",
    Oggetto: "Aggiornare CRM con esito visita",
    Stato: "Completato",
    Priorità: "Basso",
    "Data di scadenza": "09/06/2026",
    "Proprietario del compito": "Sara Esposto",
    Sede: "Catania",
    "Correlato a": { tipo: "Lead", id: "lead-009", nome: "Carmelo Distefano" },
    Descrizione: "Registrare le note del sopralluogo nel gestionale.",
    Promemoria: null,
    "Data di creazione": "07/06/2026 09:00",
    "Orario di chiusura": "08/06/2026 17:45",
    Note: [],
  },
]

export function getCompitoById(id: string): Compito | undefined {
  return mockCompiti.find((c) => c.id === id)
}

// ============================================================================
// MODULO SCADENZE (Deadlines)
// ============================================================================

export interface ScadenzaNota {
  id: string
  testo: string
  autore: string
  data: string
}

export interface Scadenza {
  id: string
  "Nome Scadenze": string
  /** datetime "DD/MM/YYYY HH:MM" */
  "Data scadenza": string
  "Proprietario di Scadenze": string
  "Ora modifica": string
  "Ora creazione": string
  "Ora ultima attività": string
  /** collegamento a lead/cliente (etichetta), nullable */
  "Connesso a": string | null
  Descrizione: string | null
  /** nome file allegato, nullable */
  "Caricamento file 1": string | null
  Tag: string[]
  "Modalità iscrizione annullata": string | null
  "Ora iscrizione annullata": string | null
  Note: ScadenzaNota[]
}

export const SCADENZE_TOTAL = 8

export const mockProprietariScadenza: string[] = [
  "Paola Polimeni",
  "Utenza di servizio",
]

/** "Oggi" coerente con la data di sistema dell'app. */
const SCADENZE_TODAY = new Date(2026, 5, 20)

/** parse "DD/MM/YYYY HH:MM" → Date (o solo data). */
function parseScadenzaDate(value: string): Date | null {
  const [datePart] = value.split(" ")
  const [d, m, y] = datePart.split("/")
  if (!d || !m || !y) return null
  return new Date(Number(y), Number(m) - 1, Number(d))
}

/** Scaduta = data nel passato e iscrizione non annullata (non chiusa). */
export function isScadenzaScaduta(s: Scadenza): boolean {
  if (s["Modalità iscrizione annullata"]) return false
  const due = parseScadenzaDate(s["Data scadenza"])
  if (!due) return false
  return due.getTime() < SCADENZE_TODAY.getTime()
}

export function scadenzaInitials(nome: string): string {
  return nome
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export const mockScadenze: Scadenza[] = [
  {
    id: "scad-001",
    "Nome Scadenze": "inserimento pratica safina",
    "Data scadenza": "03/06/2025 10:00",
    "Proprietario di Scadenze": "Paola Polimeni",
    "Ora modifica": "02/06/2025 16:40",
    "Ora creazione": "28/05/2025 09:15",
    "Ora ultima attività": "02/06/2025 16:40",
    "Connesso a": "Safina Costruzioni",
    Descrizione:
      "Completare l'inserimento della pratica per il cliente Safina entro la scadenza.",
    "Caricamento file 1": "pratica_safina.pdf",
    Tag: ["PRATICHE ENEL"],
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    Note: [
      {
        id: "n1",
        testo: "Documenti ricevuti, manca solo la firma del titolare.",
        autore: "Paola Polimeni",
        data: "30/05/2025 11:20",
      },
    ],
  },
  {
    id: "scad-002",
    "Nome Scadenze": "Letizia Cono",
    "Data scadenza": "21/03/2025 09:30",
    "Proprietario di Scadenze": "Utenza di servizio",
    "Ora modifica": "20/03/2025 18:00",
    "Ora creazione": "15/03/2025 10:00",
    "Ora ultima attività": "20/03/2025 18:00",
    "Connesso a": "Letizia Cono",
    Descrizione: null,
    "Caricamento file 1": null,
    Tag: [],
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    Note: [],
  },
  {
    id: "scad-003",
    "Nome Scadenze": "Andrea Polimeni",
    "Data scadenza": "20/03/2025 16:00",
    "Proprietario di Scadenze": "Utenza di servizio",
    "Ora modifica": "19/03/2025 14:30",
    "Ora creazione": "12/03/2025 09:45",
    "Ora ultima attività": "19/03/2025 14:30",
    "Connesso a": "Andrea Polimeni",
    Descrizione: "Verifica documentazione per attivazione pratica.",
    "Caricamento file 1": null,
    Tag: [],
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    Note: [],
  },
  {
    id: "scad-004",
    "Nome Scadenze": "Antonino Luca PNRR40%",
    "Data scadenza": "21/03/2025 09:00",
    "Proprietario di Scadenze": "Utenza di servizio",
    "Ora modifica": "20/03/2025 12:10",
    "Ora creazione": "10/03/2025 11:00",
    "Ora ultima attività": "20/03/2025 12:10",
    "Connesso a": "Antonino Luca",
    Descrizione: "Invio domanda di accesso al contributo PNRR 40%.",
    "Caricamento file 1": "domanda_pnrr_luca.pdf",
    Tag: ["Codice contratto PNRR"],
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    Note: [],
  },
  {
    id: "scad-005",
    "Nome Scadenze": "Tica lachetta",
    "Data scadenza": "08/04/2025 12:00",
    "Proprietario di Scadenze": "Utenza di servizio",
    "Ora modifica": "07/04/2025 17:20",
    "Ora creazione": "01/04/2025 08:30",
    "Ora ultima attività": "07/04/2025 17:20",
    "Connesso a": "Lachetta Srl",
    Descrizione: "Scadenza pagamento TICA per la connessione.",
    "Caricamento file 1": null,
    Tag: ["Importo TICA"],
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    Note: [],
  },
  {
    id: "scad-006",
    "Nome Scadenze": "Tica Regali D'Anna",
    "Data scadenza": "11/04/2025 12:00",
    "Proprietario di Scadenze": "Utenza di servizio",
    "Ora modifica": "10/04/2025 15:00",
    "Ora creazione": "03/04/2025 09:00",
    "Ora ultima attività": "10/04/2025 15:00",
    "Connesso a": "Regali D'Anna",
    Descrizione: null,
    "Caricamento file 1": null,
    Tag: ["Importo TICA"],
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    Note: [],
  },
  {
    id: "scad-007",
    "Nome Scadenze": "Inviare pratica PNRR40% Sarra Minichello",
    "Data scadenza": "28/03/2025 09:00",
    "Proprietario di Scadenze": "Utenza di servizio",
    "Ora modifica": "27/03/2025 16:45",
    "Ora creazione": "20/03/2025 10:30",
    "Ora ultima attività": "27/03/2025 16:45",
    "Connesso a": "Sarra Minichello",
    Descrizione: "Inviare la pratica PNRR 40% per il cliente Sarra Minichello.",
    "Caricamento file 1": "pratica_pnrr_minichello.pdf",
    Tag: ["Codice contratto PNRR"],
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    Note: [],
  },
  {
    id: "scad-008",
    "Nome Scadenze": "Tica FT Elettra",
    "Data scadenza": "31/03/2025 09:30",
    "Proprietario di Scadenze": "Utenza di servizio",
    "Ora modifica": "30/03/2025 11:15",
    "Ora creazione": "24/03/2025 09:00",
    "Ora ultima attività": "30/03/2025 11:15",
    "Connesso a": "FT Elettra",
    Descrizione: "Pagamento TICA in scadenza per pratica FT Elettra.",
    "Caricamento file 1": null,
    Tag: ["Importo TICA"],
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    Note: [],
  },
]

export function getScadenzaById(id: string): Scadenza | undefined {
  return mockScadenze.find((s) => s.id === id)
}

// ============================================================================
// Installatori
// ----------------------------------------------------------------------------
// Modulo Installatori: anagrafica delle aziende installatrici partner.
// Stessa impostazione di Clienti (tabella, filtri, impostazioni, tag).
// ============================================================================

export type InstallatoreStato = "Attivo" | "Inattivo"

export const INSTALLATORE_STATO_VALUES: InstallatoreStato[] = [
  "Attivo",
  "Inattivo",
]

export const INSTALLATORE_STATO_TONE: Record<
  InstallatoreStato,
  "success" | "destructive"
> = {
  Attivo: "success",
  Inattivo: "destructive",
}

// Proprietari (account manager) degli installatori
export const mockInstallatoreProprietari: string[] = [
  "Paola Polimeni",
  "Donato D'Urso",
  "Gaetano Grasso",
  "Mariarosa De Leo",
]

export interface InstallatoreRecord {
  id: string

  // --- Base ---
  "Badge dell'attività": boolean
  "Badge di nota": boolean
  Tag: string[]
  "Nome Installatore": string
  "E-mail": string
  "Proprietario di Installatore"?: string
  "Ora modifica": string
  Stato: InstallatoreStato

  // --- Anagrafica ---
  "Persona di riferimento"?: string
  "E-mail secondaria"?: string
  Cellulare?: string
  "Altro telefono"?: string
  "Partita IVA"?: string
  "Connesso a"?: string
  "Creato da"?: string
  "Modificato da"?: string
  "Ora creazione"?: string
  "Ora ultima attività"?: string

  // --- Indirizzo postale ---
  "Via indirizzo postale"?: string
  "Città indirizzo postale"?: string
  "Provincia indirizzo postale"?: string
  "Codice postale indirizzo"?: string

  // --- Note e stato ---
  "Opt-out e-mail"?: boolean
  Bloccato?: boolean
  "Modalità iscrizione annullata"?: string | null
  "Ora iscrizione annullata"?: string | null
  Note?: string
}

export type InstallatoreColumnId = Exclude<keyof InstallatoreRecord, "id">

export type InstallatoreColumnGroup =
  | "Base"
  | "Anagrafica"
  | "Indirizzo postale"
  | "Note e stato"

export const INSTALLATORE_COLUMN_GROUPS: InstallatoreColumnGroup[] = [
  "Base",
  "Anagrafica",
  "Indirizzo postale",
  "Note e stato",
]

export interface InstallatoreColumn {
  id: InstallatoreColumnId
  label: string
  group: InstallatoreColumnGroup
  defaultVisible?: boolean
}

export const INSTALLATORE_COLUMNS: InstallatoreColumn[] = [
  // Base
  { id: "Badge dell'attività", label: "Badge dell'attività", group: "Base", defaultVisible: true },
  { id: "Badge di nota", label: "Badge di nota", group: "Base", defaultVisible: true },
  { id: "Tag", label: "Tag", group: "Base", defaultVisible: true },
  { id: "Nome Installatore", label: "Nome Installatore", group: "Base", defaultVisible: true },
  { id: "E-mail", label: "E-mail", group: "Base", defaultVisible: true },
  { id: "Proprietario di Installatore", label: "Proprietario di Installatore", group: "Base", defaultVisible: true },
  { id: "Ora modifica", label: "Ora modifica", group: "Base", defaultVisible: true },
  { id: "Stato", label: "Stato", group: "Base", defaultVisible: true },
  // Anagrafica
  { id: "Persona di riferimento", label: "Persona di riferimento", group: "Anagrafica" },
  { id: "E-mail secondaria", label: "E-mail secondaria", group: "Anagrafica" },
  { id: "Cellulare", label: "Cellulare", group: "Anagrafica" },
  { id: "Altro telefono", label: "Altro telefono", group: "Anagrafica" },
  { id: "Partita IVA", label: "Partita IVA", group: "Anagrafica" },
  { id: "Connesso a", label: "Connesso a", group: "Anagrafica" },
  { id: "Creato da", label: "Creato da", group: "Anagrafica" },
  { id: "Modificato da", label: "Modificato da", group: "Anagrafica" },
  { id: "Ora creazione", label: "Ora creazione", group: "Anagrafica" },
  { id: "Ora ultima attività", label: "Ora ultima attività", group: "Anagrafica" },
  // Indirizzo postale
  { id: "Via indirizzo postale", label: "Via indirizzo postale", group: "Indirizzo postale" },
  { id: "Città indirizzo postale", label: "Città indirizzo postale", group: "Indirizzo postale" },
  { id: "Provincia indirizzo postale", label: "Provincia indirizzo postale", group: "Indirizzo postale" },
  { id: "Codice postale indirizzo", label: "Codice postale indirizzo", group: "Indirizzo postale" },
  // Note e stato
  { id: "Opt-out e-mail", label: "Opt-out e-mail", group: "Note e stato" },
  { id: "Bloccato", label: "Bloccato", group: "Note e stato" },
  { id: "Modalità iscrizione annullata", label: "Modalità iscrizione annullata", group: "Note e stato" },
  { id: "Ora iscrizione annullata", label: "Ora iscrizione annullata", group: "Note e stato" },
  { id: "Note", label: "Note", group: "Note e stato" },
]

export const DEFAULT_INSTALLATORE_COLUMNS: InstallatoreColumnId[] = [
  "Badge dell'attività",
  "Badge di nota",
  "Tag",
  "Nome Installatore",
  "E-mail",
  "Proprietario di Installatore",
  "Ora modifica",
]

export const INSTALLATORI_TOTAL = 9

export const mockInstallatoriRecords: InstallatoreRecord[] = [
  {
    id: "inst-001",
    "Badge dell'attività": false,
    "Badge di nota": false,
    Tag: ["Convenzionato"],
    "Nome Installatore": "Ettroimpianti srl",
    "E-mail": "elettroimpiantimurgano@gmail.com",
    "Proprietario di Installatore": "Paola Polimeni",
    "Ora modifica": "15/06/2026 10:07 AM",
    Stato: "Attivo",
    "Persona di riferimento": "Salvatore Murgano",
    Cellulare: "+39 333 1122334",
    "Partita IVA": "IT01234560871",
    "Connesso a": "Ettroimpianti srl",
    "Creato da": "Paola Polimeni",
    "Modificato da": "Paola Polimeni",
    "Ora creazione": "02/02/2024 09:00 AM",
    "Ora ultima attività": "15/06/2026 10:07 AM",
    "Città indirizzo postale": "Catania",
    "Provincia indirizzo postale": "CT",
    "Opt-out e-mail": false,
    Bloccato: false,
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
  },
  {
    id: "inst-002",
    "Badge dell'attività": false,
    "Badge di nota": false,
    Tag: ["Partner", "Certificato"],
    "Nome Installatore": "Pm-technology _Massimo Popano",
    "E-mail": "tecnico@pm-technology.eu",
    "Proprietario di Installatore": "Paola Polimeni",
    "Ora modifica": "09/06/2026 03:08 PM",
    Stato: "Attivo",
    "Persona di riferimento": "Massimo Popano",
    Cellulare: "+39 347 9988776",
    "Partita IVA": "IT04567890873",
    "Connesso a": "PM-Technology",
    "Creato da": "Paola Polimeni",
    "Modificato da": "Paola Polimeni",
    "Ora creazione": "11/03/2024 14:20 PM",
    "Ora ultima attività": "09/06/2026 03:08 PM",
    "Città indirizzo postale": "Treviso",
    "Provincia indirizzo postale": "TV",
    "Opt-out e-mail": false,
    Bloccato: false,
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
  },
  {
    id: "inst-003",
    "Badge dell'attività": false,
    "Badge di nota": false,
    Tag: ["Certificato"],
    "Nome Installatore": "DIESSE IMPIANTI",
    "E-mail": "matteo@impretek.it",
    "Proprietario di Installatore": "Paola Polimeni",
    "Ora modifica": "01/12/2025 12:37 PM",
    Stato: "Attivo",
    "Persona di riferimento": "Matteo Diesse",
    Cellulare: "+39 320 4455667",
    "Partita IVA": "IT07654320874",
    "Connesso a": "DIESSE IMPIANTI",
    "Creato da": "Paola Polimeni",
    "Modificato da": "Paola Polimeni",
    "Ora creazione": "18/05/2024 10:05 AM",
    "Ora ultima attività": "01/12/2025 12:37 PM",
    "Città indirizzo postale": "Torino",
    "Provincia indirizzo postale": "TO",
    "Opt-out e-mail": false,
    Bloccato: false,
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
  },
  {
    id: "inst-004",
    "Badge dell'attività": false,
    "Badge di nota": false,
    Tag: [],
    "Nome Installatore": "DG Impianti",
    "E-mail": "info@dgimpiantitalia.com",
    "Proprietario di Installatore": "Paola Polimeni",
    "Ora modifica": "22/10/2025 10:21 AM",
    Stato: "Attivo",
    "Persona di riferimento": "Daniele Greco",
    Cellulare: "+39 366 5566778",
    "Partita IVA": "IT09876540875",
    "Connesso a": "DG Impianti",
    "Creato da": "Paola Polimeni",
    "Modificato da": "Paola Polimeni",
    "Ora creazione": "07/09/2024 16:40 PM",
    "Ora ultima attività": "22/10/2025 10:21 AM",
    "Città indirizzo postale": "Giarre",
    "Provincia indirizzo postale": "CT",
    "Opt-out e-mail": false,
    Bloccato: false,
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
  },
  {
    id: "inst-005",
    "Badge dell'attività": false,
    "Badge di nota": true,
    Tag: ["Sospeso"],
    "Nome Installatore": "Tarna Group",
    "E-mail": "ufficio.tecnico@tarnagroup.it",
    "Proprietario di Installatore": "Paola Polimeni",
    "Ora modifica": "27/11/2025 07:34 AM",
    Stato: "Inattivo",
    "Persona di riferimento": "Luca Tarna",
    Cellulare: "+39 351 1239876",
    "Partita IVA": "IT02233440876",
    "Connesso a": "Tarna Group",
    "Creato da": "Paola Polimeni",
    "Modificato da": "Paola Polimeni",
    "Ora creazione": "14/01/2024 11:00 AM",
    "Ora ultima attività": "27/11/2025 07:34 AM",
    "Città indirizzo postale": "Porto Sant'Elpidio",
    "Provincia indirizzo postale": "FM",
    "Opt-out e-mail": true,
    Bloccato: true,
    "Modalità iscrizione annullata": "Manuale",
    "Ora iscrizione annullata": "27/11/2025 07:34 AM",
    Note: "Collaborazione sospesa in attesa di rinnovo certificazioni.",
  },
  {
    id: "inst-006",
    "Badge dell'attività": false,
    "Badge di nota": true,
    Tag: ["Preferito", "Zona Sicilia"],
    "Nome Installatore": "Bmax di Beatrice Piepoli",
    "E-mail": "Bmaxservice777@gmail.com",
    "Proprietario di Installatore": "Paola Polimeni",
    "Ora modifica": "12/06/2025 09:41 AM",
    Stato: "Attivo",
    "Persona di riferimento": "Beatrice Piepoli",
    Cellulare: "+39 333 7778899",
    "Partita IVA": "IT05566770877",
    "Connesso a": "Bmax",
    "Creato da": "Paola Polimeni",
    "Modificato da": "Paola Polimeni",
    "Ora creazione": "22/02/2024 09:30 AM",
    "Ora ultima attività": "12/06/2025 09:41 AM",
    "Città indirizzo postale": "Catania",
    "Provincia indirizzo postale": "CT",
    "Opt-out e-mail": false,
    Bloccato: false,
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    Note: "Installatore di fiducia per la zona di Catania.",
  },
  {
    id: "inst-007",
    "Badge dell'attività": false,
    "Badge di nota": true,
    Tag: ["Manutenzione"],
    "Nome Installatore": "Ca.Gi Srl",
    "E-mail": "peppebellanca@live.it",
    "Proprietario di Installatore": "Paola Polimeni",
    "Ora modifica": "04/06/2026 11:25 AM",
    Stato: "Attivo",
    "Persona di riferimento": "Giuseppe Bellanca",
    Cellulare: "+39 340 1112233",
    "Partita IVA": "IT06677880878",
    "Connesso a": "Ca.Gi Srl",
    "Creato da": "Paola Polimeni",
    "Modificato da": "Paola Polimeni",
    "Ora creazione": "30/04/2024 15:10 PM",
    "Ora ultima attività": "04/06/2026 11:25 AM",
    "Città indirizzo postale": "Catania",
    "Provincia indirizzo postale": "CT",
    "Opt-out e-mail": false,
    Bloccato: false,
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    Note: "Gestisce le manutenzioni programmate degli impianti.",
  },
  {
    id: "inst-008",
    "Badge dell'attività": false,
    "Badge di nota": true,
    Tag: ["Partner", "Preferito"],
    "Nome Installatore": "Solair Group srl",
    "E-mail": "",
    "Proprietario di Installatore": "Paola Polimeni",
    "Ora modifica": "09/07/2025 09:20 AM",
    Stato: "Attivo",
    "Persona di riferimento": "Ufficio tecnico",
    Cellulare: "+39 095 7654321",
    "Partita IVA": "IT07788990879",
    "Connesso a": "Solair Group srl",
    "Creato da": "Paola Polimeni",
    "Modificato da": "Paola Polimeni",
    "Ora creazione": "09/07/2024 09:20 AM",
    "Ora ultima attività": "09/07/2025 09:20 AM",
    "Città indirizzo postale": "Catania",
    "Provincia indirizzo postale": "CT",
    "Opt-out e-mail": false,
    Bloccato: false,
    "Modalità iscrizione annullata": null,
    "Ora iscrizione annullata": null,
    Note: "Installatore interno del gruppo Solair.",
  },
  {
    id: "inst-009",
    "Badge dell'attività": false,
    "Badge di nota": false,
    Tag: ["Sospeso"],
    "Nome Installatore": "Ecofinite di Salonia Stefania Maria",
    "E-mail": "o.patania@ecofinite.it",
    "Proprietario di Installatore": "Donato D'Urso",
    "Ora modifica": "27/11/2025 07:34 AM",
    Stato: "Inattivo",
    "Persona di riferimento": "Orazio Patania",
    Cellulare: "+39 328 9090909",
    "Partita IVA": "IT08899000880",
    "Connesso a": "Ecofinite",
    "Creato da": "Donato D'Urso",
    "Modificato da": "Donato D'Urso",
    "Ora creazione": "03/06/2024 12:00 PM",
    "Ora ultima attività": "27/11/2025 07:34 AM",
    "Città indirizzo postale": "Treviso",
    "Provincia indirizzo postale": "TV",
    "Opt-out e-mail": true,
    Bloccato: false,
    "Modalità iscrizione annullata": "Automatica",
    "Ora iscrizione annullata": "27/11/2025 07:34 AM",
  },
]

export function getInstallatoreById(
  id: string,
): InstallatoreRecord | undefined {
  return mockInstallatoriRecords.find((i) => i.id === id)
}
