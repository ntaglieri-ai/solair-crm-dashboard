// Vocabolario condiviso di Session & Access.
//
// Come per lib/audit/constants.ts, questo file non puo' importare nulla di
// server-side: lo carica anche il componente client, e trascinare qui il client
// Supabase (che importa next/headers) fa fallire la build del bundle browser.

// --- Configurazione di sicurezza --------------------------------------------
// Le tre chiavi esistono gia' su public.crm_settings dal 26/06/2026. Non se ne
// inventano di nuove: si legge e si riscrive quello che c'e'.

export const CHIAVE_TIMEOUT = "session_timeout_minutes"
export const CHIAVE_MAX_TENTATIVI = "max_login_attempts"
export const CHIAVE_BLOCCO_IP = "ip_block_enabled"

/**
 * Valori ammessi per il timeout di inattivita', in minuti.
 *
 * Gli estremi non sono decorativi: `clampTimeoutMinuti` li applica anche ai
 * valori che arrivano dal database, perche' la riga di crm_settings e'
 * scrivibile da qualunque utente autenticato (policy `crm_authenticated_access`,
 * ALL su authenticated) e un valore assurdo li' dentro non deve poter
 * disattivare di fatto il timeout per tutta l'azienda.
 */
export const TIMEOUT_MINUTI = [15, 30, 60, 120, 240, 480] as const

export const TIMEOUT_MINUTI_MIN = 5
export const TIMEOUT_MINUTI_MAX = 720

export const TENTATIVI_AMMESSI = [3, 5, 10, 20] as const

export const TENTATIVI_MIN = 3
export const TENTATIVI_MAX = 50

/** Finestra entro cui si contano i tentativi falliti di uno stesso IP. */
export const FINESTRA_TENTATIVI_MINUTI = 10

/** Durata del blocco automatico applicato al superamento della soglia. */
export const DURATA_BLOCCO_MINUTI = 15

export function clampTimeoutMinuti(value: number): number {
  if (!Number.isFinite(value)) return 30
  return Math.min(Math.max(Math.round(value), TIMEOUT_MINUTI_MIN), TIMEOUT_MINUTI_MAX)
}

export function clampTentativi(value: number): number {
  if (!Number.isFinite(value)) return 5
  return Math.min(Math.max(Math.round(value), TENTATIVI_MIN), TENTATIVI_MAX)
}

export function etichettaTimeout(minuti: number): string {
  if (minuti < 60) return `${minuti} minuti`
  const ore = minuti / 60
  if (Number.isInteger(ore)) return ore === 1 ? "1 ora" : `${ore} ore`
  return `${minuti} minuti`
}

export interface ImpostazioniSicurezza {
  timeoutMinuti: number
  maxTentativi: number
  bloccoIpAttivo: boolean
}

// --- Sessioni ---------------------------------------------------------------

/**
 * Origine della sessione, dedotta dallo user agent.
 *
 * Serve perche' in `auth.sessions` non ci sono solo i browser: convivono le
 * sessioni aperte dalle funzioni server ("Vercel Edge Functions") e quelle
 * degli script di manutenzione ("node"). Mostrarle tutte come se fossero
 * persone collegate al CRM sarebbe falso.
 */
export type OrigineSessione = "browser" | "servizio" | "script" | "sconosciuta"

export interface SessioneAttiva {
  sessionId: string
  authUserId: string
  utenteId: string | null
  utenteNome: string | null
  utenteEmail: string | null
  utenteRuolo: string | null
  /** Etichetta pronta, es. "Chrome 151 · macOS". */
  dispositivo: string
  origine: OrigineSessione
  userAgent: string | null
  ip: string | null
  creataIl: string
  /**
   * `auth.sessions.updated_at`: si muove al rinnovo del token, non a ogni
   * azione dell'utente. La UI lo chiama "Ultimo rinnovo" e non "Ultima
   * attivita'" proprio per questo — vedi commento in session-access-client.
   */
  rinnovataIl: string | null
  /** True quando la sessione e' quella di chi sta guardando la pagina. */
  corrente: boolean
}

export interface IpBloccato {
  id: string
  ipAddress: string
  motivo: string
  bloccatoDaNome: string | null
  creatoIl: string
  scadenza: string | null
  /** Calcolato lato server: uno scaduto non blocca piu' nessuno. */
  attivo: boolean
}

export interface SessionAccessData {
  sessioni: SessioneAttiva[]
  ipBloccati: IpBloccato[]
  impostazioni: ImpostazioniSicurezza
  /** Errore di lettura: va distinto da "nessuna sessione". */
  errore: string | null
}

// --- Parsing user agent -----------------------------------------------------
// Deliberatamente minimale e senza dipendenze: bastano browser e sistema
// operativo per riconoscere una postazione. Un parser completo non aggiunge
// niente a questa pagina e aggiunge un pacchetto da mantenere.

const BROWSERS: Array<[RegExp, string]> = [
  [/Edg\/(\d+)/, "Edge"],
  [/OPR\/(\d+)/, "Opera"],
  [/Firefox\/(\d+)/, "Firefox"],
  // Chrome va testato prima di Safari: lo user agent di Chrome contiene Safari.
  [/Chrome\/(\d+)/, "Chrome"],
  [/Version\/(\d+).*Safari/, "Safari"],
]

const SISTEMI: Array<[RegExp, string]> = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Mac OS X/, "macOS"],
  [/Windows NT/, "Windows"],
  [/Linux/, "Linux"],
]

export function origineDaUserAgent(userAgent: string | null): OrigineSessione {
  if (!userAgent) return "sconosciuta"
  if (/Vercel|Edge Functions|supabase/i.test(userAgent)) return "servizio"
  if (/^node/i.test(userAgent) || /undici|axios|curl|python/i.test(userAgent)) return "script"
  if (/Mozilla|AppleWebKit|Gecko/i.test(userAgent)) return "browser"
  return "sconosciuta"
}

export function dispositivoDaUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Origine sconosciuta"

  const origine = origineDaUserAgent(userAgent)
  if (origine === "servizio") return "Funzione server"
  if (origine === "script") return "Script di servizio"

  let browser: string | null = null
  for (const [regex, nome] of BROWSERS) {
    const match = userAgent.match(regex)
    if (match) {
      browser = `${nome} ${match[1]}`
      break
    }
  }

  let sistema: string | null = null
  for (const [regex, nome] of SISTEMI) {
    if (regex.test(userAgent)) {
      sistema = nome
      break
    }
  }

  if (browser && sistema) return `${browser} · ${sistema}`
  return browser ?? sistema ?? "Origine sconosciuta"
}

export function isMobileUserAgent(userAgent: string | null): boolean {
  return Boolean(userAgent) && /iPhone|iPad|iPod|Android|Mobile/i.test(userAgent!)
}
