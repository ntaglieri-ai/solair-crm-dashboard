// ============================================================================
// Documenti — punto di accesso allo storage Nextcloud
// ----------------------------------------------------------------------------
// La pagina non gestisce i file direttamente: mostra le cartelle preferite e i
// documenti recenti dell'utente corrente, con link rapidi verso Nextcloud.
// Tutti i dati sono mock; i link sono costruiti come nextcloud_url + path.
// ============================================================================

export type CartellaColore = "teal" | "blue" | "amber" | "gray"

export type CartellaIcona = "Folder" | "FolderOpen" | "FileCheck" | "FileClock"

export interface CartellaPreferita {
  id: string
  nome: string
  path: string
  colore: CartellaColore
  icona: CartellaIcona
  ultimo_accesso: string
}

export type DocumentoTipo = "pdf" | "zip" | "file"

export interface DocumentoRecente {
  id: string
  nome: string
  path: string
  tipo: DocumentoTipo
  dimensione: string
  modificato: string
  lead_id: string | null
  lead_nome: string | null
}

export interface DocumentiUser {
  id: string
  nome: string
  ruolo: string
  sede: string
  nextcloud_url: string
  cartelle_preferite: CartellaPreferita[]
  documenti_recenti: DocumentoRecente[]
}

export const currentDocumentiUser: DocumentiUser = {
  id: "usr_001",
  nome: "Gaetano Grasso",
  ruolo: "commerciale",
  sede: "Catania",
  nextcloud_url: "https://nx101824.your-storageshare.de",
  cartelle_preferite: [
    {
      id: "cf_001",
      nome: "Lead attivi — Catania",
      path: "/Lead/Catania/Attivi",
      colore: "teal",
      icona: "Folder",
      ultimo_accesso: "2026-06-24T10:30:00",
    },
    {
      id: "cf_002",
      nome: "Contratti firmati 2026",
      path: "/Contratti/2026/Firmati",
      colore: "blue",
      icona: "FileCheck",
      ultimo_accesso: "2026-06-23T15:00:00",
    },
    {
      id: "cf_003",
      nome: "Preventivi in attesa",
      path: "/Preventivi/InAttesa",
      colore: "amber",
      icona: "FileClock",
      ultimo_accesso: "2026-06-22T09:15:00",
    },
    {
      id: "cf_004",
      nome: "Installatori — Documenti tecnici",
      path: "/Installatori/DocTecnici",
      colore: "gray",
      icona: "FolderOpen",
      ultimo_accesso: "2026-06-20T11:00:00",
    },
  ],
  documenti_recenti: [
    {
      id: "dr_001",
      nome: "Contratto_Bianchi_Mario_2026.pdf",
      path: "/Contratti/2026/Firmati/Contratto_Bianchi_Mario_2026.pdf",
      tipo: "pdf",
      dimensione: "1.2 MB",
      modificato: "2026-06-24T10:28:00",
      lead_id: "lead_042",
      lead_nome: "Mario Bianchi",
    },
    {
      id: "dr_002",
      nome: "Preventivo_Rossi_Lucia_v2.pdf",
      path: "/Preventivi/InAttesa/Preventivo_Rossi_Lucia_v2.pdf",
      tipo: "pdf",
      dimensione: "890 KB",
      modificato: "2026-06-23T14:55:00",
      lead_id: "lead_039",
      lead_nome: "Lucia Rossi",
    },
    {
      id: "dr_003",
      nome: "Scheda_tecnica_impianto_6kW.pdf",
      path: "/Installatori/DocTecnici/Scheda_tecnica_impianto_6kW.pdf",
      tipo: "pdf",
      dimensione: "2.1 MB",
      modificato: "2026-06-22T09:10:00",
      lead_id: null,
      lead_nome: null,
    },
    {
      id: "dr_004",
      nome: "Foto_sopralluogo_Ferrara.zip",
      path: "/Lead/Catania/Attivi/Foto_sopralluogo_Ferrara.zip",
      tipo: "zip",
      dimensione: "18.4 MB",
      modificato: "2026-06-21T16:30:00",
      lead_id: "lead_037",
      lead_nome: "Antonio Ferrara",
    },
  ],
}

/** Costruisce l'URL completo Nextcloud per un dato path. */
export function nextcloudLink(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`
}

/**
 * Classi (sfondo + testo) per il cerchio icona di una cartella, in base al
 * colore configurato. Usa toni chiari coerenti con il design system.
 */
export const CARTELLA_COLORE_CLASSI: Record<CartellaColore, string> = {
  teal: "bg-[#2E8B72]/12 text-[#2E8B72]",
  blue: "bg-[#1E3A5F]/12 text-[#1E3A5F]",
  amber: "bg-amber-500/15 text-amber-600",
  gray: "bg-muted text-muted-foreground",
}

/**
 * Data relativa in italiano (es. "oggi", "ieri", "2 giorni fa", "3 settimane
 * fa") calcolata rispetto ad "adesso".
 */
export function relativeDateIt(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const msPerDay = 1000 * 60 * 60 * 24

  // Confronta a livello di giorno solare per evitare scarti dovuti all'orario.
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(date)) / msPerDay)

  if (diffDays <= 0) return "oggi"
  if (diffDays === 1) return "ieri"
  if (diffDays < 7) return `${diffDays} giorni fa`
  if (diffDays < 14) return "1 settimana fa"
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} settimane fa`
  if (diffDays < 60) return "1 mese fa"
  return `${Math.floor(diffDays / 30)} mesi fa`
}
