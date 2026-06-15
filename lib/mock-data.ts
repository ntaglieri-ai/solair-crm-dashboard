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

export type LeadOrigine = "Facebook" | "Pubblicità" | "Sito web" | "Manuale"

export type LeadTipoImpianto = "monofase" | "trifase"

export interface LeadAttivita {
  id: string
  tipo: "email-open" | "cambio-stato" | "nota" | "nuovo-lead"
  descrizione: string
  timestamp: string
  autore?: string
}

export interface LeadDocumento {
  id: string
  nome: string
  formato: "pdf" | "jpg" | "png" | "dwg"
  dataUpload: string
  dimensione: string
}

export interface Lead {
  id: string
  nome: string
  cognome?: string
  citta: string
  provincia: string
  cap?: string
  indirizzo?: string
  email?: string
  telefono?: string
  configurazione: string
  origine: LeadOrigine | string
  status: LeadStatus
  score: number // 0-100
  sede: Exclude<SedeId, "all">
  commerciale?: string
  dataCreazione?: string
  note?: string
  // configurazione preventivo
  kwp?: number
  kwh?: number
  modelloPannello?: string
  tipoImpianto?: LeadTipoImpianto
  zona?: string
  campaignName?: string
  wallbox?: boolean
  // email tracking
  emailAperture?: number
  ultimaApertura?: string
  leadCaldo?: boolean
  // duplicate detection
  possibileDuplicato?: boolean
  // cronologia + documenti
  attivita?: LeadAttivita[]
  documenti?: LeadDocumento[]
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

// Ordine di visualizzazione degli stati nei filtri
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "non-contattato",
  "tentato-contattare",
  "contattato",
  "inviato-preventivo",
  "convertito",
  "perso",
]

export const LEAD_ORIGINI: LeadOrigine[] = [
  "Facebook",
  "Pubblicità",
  "Sito web",
  "Manuale",
]

export const MOCK_COMMERCIALI: string[] = [
  "Gaetano Grasso",
  "Mariarosa De Leo",
  "Ivan Lo Faro",
  "Fabio Tizi",
  "Cristian Virzì",
]

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

export function getLeads(sede: SedeId): Lead[] {
  const filtered = sede === "all" ? LEADS : LEADS.filter((l) => l.sede === sede)
  return [...filtered].sort((a, b) => b.score - a.score)
}

// ----------------------------------------------------------------------------
// Modulo Lead — dataset completo (lista + scheda dettaglio)
// ----------------------------------------------------------------------------

function attivitaBase(
  origine: string,
  creato: string,
): LeadAttivita[] {
  return [
    {
      id: "att-create",
      tipo: "nuovo-lead",
      descrizione: `Lead creato da Make — ${origine}`,
      timestamp: creato,
    },
  ]
}

export const mockLeads: Lead[] = [
  {
    id: "lead-1",
    nome: "Niccolò",
    cognome: "Leo",
    citta: "Zevio",
    provincia: "VR",
    cap: "37059",
    indirizzo: "Via Roma 14",
    email: "niccolo.leo@gmail.com",
    telefono: "+39 347 1122334",
    configurazione: "9+21,2 Sineng",
    origine: "Facebook",
    status: "contattato",
    score: 94,
    sede: "treviso",
    commerciale: "Gaetano Grasso",
    dataCreazione: "12 Giu 2026",
    note: "Cliente molto interessato, valuta anche colonnina di ricarica.",
    kwp: 9,
    kwh: 21.2,
    modelloPannello: "Sineng",
    tipoImpianto: "trifase",
    zona: "Nord",
    campaignName: "9+21,2 Sineng - NORD w11(Dinamica)",
    wallbox: true,
    emailAperture: 2,
    ultimaApertura: "Oggi 07:08",
    leadCaldo: true,
    possibileDuplicato: true,
    attivita: [
      {
        id: "a1",
        tipo: "email-open",
        descrizione: "Email preventivo aperta — 2 volte",
        timestamp: "Oggi 07:08",
      },
      {
        id: "a2",
        tipo: "cambio-stato",
        descrizione: "Stato cambiato da 'Tentato contattare' a 'Contattato'",
        timestamp: "Ieri 15:20",
        autore: "Gaetano Grasso",
      },
      {
        id: "a3",
        tipo: "nota",
        descrizione: "Richiamato, disponibile per sopralluogo settimana prossima.",
        timestamp: "Ieri 15:18",
        autore: "Gaetano Grasso",
      },
      {
        id: "a4",
        tipo: "nuovo-lead",
        descrizione: "Lead creato da Make — Facebook",
        timestamp: "12 Giu 2026 09:02",
      },
    ],
    documenti: [
      {
        id: "d1",
        nome: "preventivo_niccolo_leo.pdf",
        formato: "pdf",
        dataUpload: "12 Giu 2026",
        dimensione: "248 KB",
      },
      {
        id: "d2",
        nome: "planimetria.jpg",
        formato: "jpg",
        dataUpload: "12 Giu 2026",
        dimensione: "1,4 MB",
      },
    ],
  },
  {
    id: "lead-2",
    nome: "Giuseppe",
    cognome: "Giacalone",
    citta: "Palermo",
    provincia: "PA",
    cap: "90121",
    indirizzo: "Via Libertà 88",
    email: "g.giacalone@libero.it",
    telefono: "+39 320 5566778",
    configurazione: "9kWp+32kWh",
    origine: "Facebook",
    status: "inviato-preventivo",
    score: 87,
    sede: "catania",
    commerciale: "Ivan Lo Faro",
    dataCreazione: "11 Giu 2026",
    note: "Preventivo inviato, attende conferma del coniuge.",
    kwp: 9,
    kwh: 32,
    modelloPannello: "Huawei",
    tipoImpianto: "trifase",
    zona: "Sud",
    campaignName: "9kWp+32kWh - SUD w10(Statica)",
    wallbox: false,
    emailAperture: 3,
    ultimaApertura: "Oggi 06:40",
    leadCaldo: true,
    attivita: [
      {
        id: "a1",
        tipo: "email-open",
        descrizione: "Email preventivo aperta — 3 volte",
        timestamp: "Oggi 06:40",
      },
      {
        id: "a2",
        tipo: "cambio-stato",
        descrizione: "Stato cambiato da 'Contattato' a 'Inviato preventivo'",
        timestamp: "10 Giu 2026",
        autore: "Ivan Lo Faro",
      },
      ...attivitaBase("Facebook", "11 Giu 2026 11:30"),
    ],
    documenti: [
      {
        id: "d1",
        nome: "preventivo_giacalone.pdf",
        formato: "pdf",
        dataUpload: "10 Giu 2026",
        dimensione: "262 KB",
      },
    ],
  },
  {
    id: "lead-3",
    nome: "Antonio",
    cognome: "Scarpinato",
    citta: "Gela",
    provincia: "CL",
    cap: "93012",
    indirizzo: "Corso Vittorio Emanuele 5",
    email: "antonio.scarpinato@gmail.com",
    telefono: "+39 339 4455667",
    configurazione: "7+20 solis",
    origine: "Facebook",
    status: "tentato-contattare",
    score: 71,
    sede: "catania",
    commerciale: "Cristian Virzì",
    dataCreazione: "10 Giu 2026",
    note: "Non risponde al telefono, riprovare in serata.",
    kwp: 7,
    kwh: 20,
    modelloPannello: "Solis",
    tipoImpianto: "monofase",
    zona: "Sud",
    campaignName: "7+20 Solis - SUD w09(Dinamica)",
    wallbox: false,
    emailAperture: 0,
    leadCaldo: false,
    attivita: attivitaBase("Facebook", "10 Giu 2026 08:15"),
    documenti: [],
  },
  {
    id: "lead-4",
    nome: "Nicola",
    cognome: "Mancuso",
    citta: "Nissoria",
    provincia: "EN",
    cap: "94010",
    indirizzo: "Via Etnea 22",
    email: "nicola.mancuso@outlook.it",
    telefono: "+39 348 9988776",
    configurazione: "Modulo SEI",
    origine: "Pubblicità",
    status: "non-contattato",
    score: 58,
    sede: "catania",
    commerciale: "Cristian Virzì",
    dataCreazione: "09 Giu 2026",
    kwp: 6,
    kwh: 10,
    modelloPannello: "SEI",
    tipoImpianto: "monofase",
    zona: "Sud",
    campaignName: "Modulo SEI - SUD w08(Statica)",
    wallbox: false,
    emailAperture: 0,
    leadCaldo: false,
    attivita: attivitaBase("Pubblicità", "09 Giu 2026 14:05"),
    documenti: [],
  },
  {
    id: "lead-5",
    nome: "Luca",
    cognome: "Benini",
    citta: "Ravenna",
    provincia: "RA",
    cap: "48121",
    indirizzo: "Via Ravegnana 100",
    email: "luca.benini@gmail.com",
    telefono: "+39 333 1239870",
    configurazione: "7+20 Solis",
    origine: "Facebook",
    status: "non-contattato",
    score: 42,
    sede: "treviso",
    commerciale: "Mariarosa De Leo",
    dataCreazione: "09 Giu 2026",
    kwp: 7,
    kwh: 20,
    modelloPannello: "Solis",
    tipoImpianto: "monofase",
    zona: "Nord",
    campaignName: "7+20 Solis - NORD w08(Dinamica)",
    wallbox: false,
    emailAperture: 0,
    leadCaldo: false,
    attivita: attivitaBase("Facebook", "09 Giu 2026 10:22"),
    documenti: [],
  },
  {
    id: "lead-6",
    nome: "Federica",
    cognome: "Conti",
    citta: "Moncalieri",
    provincia: "TO",
    cap: "10024",
    indirizzo: "Via Torino 9",
    email: "federica.conti@gmail.com",
    telefono: "+39 366 7711223",
    configurazione: "6+10 Huawei",
    origine: "Sito web",
    status: "contattato",
    score: 82,
    sede: "torino",
    commerciale: "Fabio Tizi",
    dataCreazione: "08 Giu 2026",
    kwp: 6,
    kwh: 10,
    modelloPannello: "Huawei",
    tipoImpianto: "monofase",
    zona: "Nord",
    campaignName: "6+10 Huawei - NORD w07(Statica)",
    wallbox: true,
    emailAperture: 1,
    ultimaApertura: "Ieri 18:30",
    leadCaldo: false,
    attivita: attivitaBase("Sito web", "08 Giu 2026 16:40"),
    documenti: [],
  },
  {
    id: "lead-7",
    nome: "Marco",
    cognome: "Ferrero",
    citta: "Torino",
    provincia: "TO",
    cap: "10128",
    indirizzo: "Corso Duca 41",
    email: "marco.ferrero@tiscali.it",
    telefono: "+39 340 5512347",
    configurazione: "9+15 Sungrow",
    origine: "Manuale",
    status: "inviato-preventivo",
    score: 76,
    sede: "torino",
    commerciale: "Fabio Tizi",
    dataCreazione: "07 Giu 2026",
    kwp: 9,
    kwh: 15,
    modelloPannello: "Sungrow",
    tipoImpianto: "trifase",
    zona: "Nord",
    campaignName: "9+15 Sungrow - NORD w06(Dinamica)",
    wallbox: false,
    emailAperture: 2,
    ultimaApertura: "Ieri 09:10",
    leadCaldo: false,
    attivita: attivitaBase("Manuale", "07 Giu 2026 12:00"),
    documenti: [],
  },
  {
    id: "lead-8",
    nome: "Sara",
    cognome: "Marchetti",
    citta: "Fermo",
    provincia: "FM",
    cap: "63900",
    indirizzo: "Via Mazzini 3",
    email: "sara.marchetti@gmail.com",
    telefono: "+39 351 8890011",
    configurazione: "8+12 Solis",
    origine: "Facebook",
    status: "convertito",
    score: 90,
    sede: "porto-sant-elpidio",
    commerciale: "Mariarosa De Leo",
    dataCreazione: "02 Giu 2026",
    note: "Convertita a cliente, contratto firmato.",
    kwp: 8,
    kwh: 12,
    modelloPannello: "Solis",
    tipoImpianto: "monofase",
    zona: "Centro",
    campaignName: "8+12 Solis - CENTRO w05(Statica)",
    wallbox: true,
    emailAperture: 4,
    ultimaApertura: "01 Giu 2026",
    leadCaldo: false,
    attivita: [
      {
        id: "a1",
        tipo: "cambio-stato",
        descrizione: "Stato cambiato da 'Inviato preventivo' a 'Convertito'",
        timestamp: "02 Giu 2026",
        autore: "Mariarosa De Leo",
      },
      ...attivitaBase("Facebook", "25 Mag 2026 09:00"),
    ],
    documenti: [
      {
        id: "d1",
        nome: "contratto_marchetti.pdf",
        formato: "pdf",
        dataUpload: "02 Giu 2026",
        dimensione: "310 KB",
      },
    ],
  },
  {
    id: "lead-9",
    nome: "Davide",
    cognome: "Riccardi",
    citta: "Porto Sant'Elpidio",
    provincia: "FM",
    cap: "63821",
    indirizzo: "Lungomare Faleria 77",
    email: "davide.riccardi@gmail.com",
    telefono: "+39 329 4567812",
    configurazione: "6+6 Huawei",
    origine: "Pubblicità",
    status: "perso",
    score: 28,
    sede: "porto-sant-elpidio",
    commerciale: "Mariarosa De Leo",
    dataCreazione: "28 Mag 2026",
    note: "Ha scelto un concorrente.",
    kwp: 6,
    kwh: 6,
    modelloPannello: "Huawei",
    tipoImpianto: "monofase",
    zona: "Centro",
    campaignName: "6+6 Huawei - CENTRO w04(Dinamica)",
    wallbox: false,
    emailAperture: 1,
    leadCaldo: false,
    attivita: [
      {
        id: "a1",
        tipo: "cambio-stato",
        descrizione: "Stato cambiato da 'Contattato' a 'Perso'",
        timestamp: "28 Mag 2026",
        autore: "Mariarosa De Leo",
      },
      ...attivitaBase("Pubblicità", "20 Mag 2026 11:15"),
    ],
    documenti: [],
  },
  {
    id: "lead-10",
    nome: "Chiara",
    cognome: "Bianchi",
    citta: "Catania",
    provincia: "CT",
    cap: "95124",
    indirizzo: "Via Etnea 200",
    email: "chiara.bianchi@gmail.com",
    telefono: "+39 347 1239988",
    configurazione: "10+20 Sungrow",
    origine: "Sito web",
    status: "tentato-contattare",
    score: 64,
    sede: "catania",
    commerciale: "Ivan Lo Faro",
    dataCreazione: "06 Giu 2026",
    kwp: 10,
    kwh: 20,
    modelloPannello: "Sungrow",
    tipoImpianto: "trifase",
    zona: "Sud",
    campaignName: "10+20 Sungrow - SUD w05(Statica)",
    wallbox: false,
    emailAperture: 0,
    leadCaldo: false,
    attivita: attivitaBase("Sito web", "06 Giu 2026 13:25"),
    documenti: [],
  },
  {
    id: "lead-11",
    nome: "Roberto",
    cognome: "Esposito",
    citta: "Treviso",
    provincia: "TV",
    cap: "31100",
    indirizzo: "Viale della Repubblica 12",
    email: "roberto.esposito@gmail.com",
    telefono: "+39 338 7654321",
    configurazione: "9+21,2 Sineng",
    origine: "Facebook",
    status: "inviato-preventivo",
    score: 79,
    sede: "treviso",
    commerciale: "Gaetano Grasso",
    dataCreazione: "05 Giu 2026",
    kwp: 9,
    kwh: 21.2,
    modelloPannello: "Sineng",
    tipoImpianto: "trifase",
    zona: "Nord",
    campaignName: "9+21,2 Sineng - NORD w04(Dinamica)",
    wallbox: true,
    emailAperture: 2,
    ultimaApertura: "Ieri 21:05",
    leadCaldo: false,
    attivita: attivitaBase("Facebook", "05 Giu 2026 08:50"),
    documenti: [],
  },
  {
    id: "lead-12",
    nome: "Elena",
    cognome: "Galli",
    citta: "Giarre",
    provincia: "CT",
    cap: "95014",
    indirizzo: "Via Callipoli 130",
    email: "elena.galli@gmail.com",
    telefono: "+39 333 2244668",
    configurazione: "7+14 Solis",
    origine: "Manuale",
    status: "non-contattato",
    score: 49,
    sede: "giarre",
    commerciale: "Cristian Virzì",
    dataCreazione: "05 Giu 2026",
    kwp: 7,
    kwh: 14,
    modelloPannello: "Solis",
    tipoImpianto: "monofase",
    zona: "Sud",
    campaignName: "7+14 Solis - SUD w04(Statica)",
    wallbox: false,
    emailAperture: 0,
    leadCaldo: false,
    attivita: attivitaBase("Manuale", "05 Giu 2026 17:40"),
    documenti: [],
  },
  // --- coppia duplicato #1 (email quasi identica a lead-1) ---
  {
    id: "lead-13",
    nome: "Niccolo",
    cognome: "Leo",
    citta: "Zevio",
    provincia: "VR",
    cap: "37059",
    indirizzo: "Via Roma 14",
    email: "niccolo.leo@gmail.com",
    telefono: "+39 347 1122335",
    configurazione: "9+21,2 Sineng",
    origine: "Facebook",
    status: "non-contattato",
    score: 55,
    sede: "treviso",
    commerciale: "Gaetano Grasso",
    dataCreazione: "12 Giu 2026",
    note: "Possibile duplicato di Niccolò Leo (lead-1).",
    kwp: 9,
    kwh: 21.2,
    modelloPannello: "Sineng",
    tipoImpianto: "trifase",
    zona: "Nord",
    campaignName: "9+21,2 Sineng - NORD w11(Dinamica)",
    wallbox: false,
    emailAperture: 0,
    leadCaldo: false,
    possibileDuplicato: true,
    attivita: attivitaBase("Facebook", "12 Giu 2026 09:05"),
    documenti: [],
  },
  // --- coppia duplicato #2 (telefono identico) ---
  {
    id: "lead-14",
    nome: "Giuseppe",
    cognome: "Giacalone",
    citta: "Palermo",
    provincia: "PA",
    cap: "90121",
    indirizzo: "Via Libertà 88",
    email: "giuseppe.giacalone@gmail.com",
    telefono: "+39 320 5566778",
    configurazione: "9kWp+32kWh",
    origine: "Sito web",
    status: "non-contattato",
    score: 51,
    sede: "catania",
    commerciale: "Ivan Lo Faro",
    dataCreazione: "11 Giu 2026",
    note: "Possibile duplicato di Giuseppe Giacalone (lead-2) — stesso telefono.",
    kwp: 9,
    kwh: 32,
    modelloPannello: "Huawei",
    tipoImpianto: "trifase",
    zona: "Sud",
    campaignName: "9kWp+32kWh - SUD w10(Statica)",
    wallbox: false,
    emailAperture: 0,
    leadCaldo: false,
    possibileDuplicato: true,
    attivita: attivitaBase("Sito web", "11 Giu 2026 12:00"),
    documenti: [],
  },
]

export const DUPLICATI_COUNT = 23

export function nomeCompleto(lead: Lead): string {
  return lead.cognome ? `${lead.nome} ${lead.cognome}` : lead.nome
}

export function getLeadById(id: string): Lead | undefined {
  return mockLeads.find((l) => l.id === id)
}
