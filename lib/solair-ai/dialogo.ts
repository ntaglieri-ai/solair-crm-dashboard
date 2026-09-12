import type { EntitaAI } from "./tipi"

const SELEZIONI_ENTITA = new Map<string, EntitaAI>([
  ["lead", "lead"],
  ["leads", "lead"],
  ["il lead", "lead"],
  ["un lead", "lead"],
  ["cliente", "cliente"],
  ["clienti", "cliente"],
  ["il cliente", "cliente"],
  ["un cliente", "cliente"],
  ["i clienti", "cliente"],
  ["installatore", "installatore"],
  ["installatori", "installatore"],
  ["l installatore", "installatore"],
  ["un installatore", "installatore"],
  ["gli installatori", "installatore"],
])

const CONFERME_SEMPLICI = new Set([
  "si",
  "sisi",
  "ok",
  "okay",
  "va bene",
  "procedi",
  "confermo",
  "aggiorna",
  "aggiorna pure",
  "crea",
  "crea pure",
])

const RIFIUTI_SEMPLICI = new Set([
  "no",
  "annulla",
  "stop",
  "ferma",
  "lascia stare",
  "non procedere",
])

const SALUTI_SEMPLICI = new Set([
  "ciao",
  "salve",
  "buongiorno",
  "buonasera",
  "buon pomeriggio",
  "hey",
  "ciao solairai",
  "buongiorno solairai",
])

const PAROLE_DOMANDA = new Set([
  "chi",
  "che",
  "cosa",
  "come",
  "quando",
  "quanto",
  "quale",
  "quali",
  "dove",
  "perche",
  "dimmi",
  "cerca",
  "trova",
  "vedi",
  "leggi",
  "controlla",
  "aggiorna",
  "sincronizza",
])

function normalizzaTestoDialogo(testo: string): string {
  return testo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/'/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function entitaDaSelezioneSemplice(messaggio: string): EntitaAI | null {
  const testo = normalizzaTestoDialogo(messaggio)
  if (testo === "") return null

  return SELEZIONI_ENTITA.get(testo) ?? null
}

export function confermaSemplice(messaggio: string): boolean {
  return CONFERME_SEMPLICI.has(normalizzaTestoDialogo(messaggio))
}

export function rifiutoSemplice(messaggio: string): boolean {
  return RIFIUTI_SEMPLICI.has(normalizzaTestoDialogo(messaggio))
}

export function salutoSemplice(messaggio: string): boolean {
  return SALUTI_SEMPLICI.has(normalizzaTestoDialogo(messaggio))
}

export function nomeDaRispostaSemplice(messaggio: string): string | null {
  const originale = messaggio.trim().replace(/\s+/g, " ")
  const normalizzato = normalizzaTestoDialogo(originale)
  if (originale === "" || normalizzato === "") return null
  if (originale.includes("?")) return null
  if (entitaDaSelezioneSemplice(originale)) return null

  const parole = normalizzato.split(" ")
  if (parole.length > 5) return null
  if (PAROLE_DOMANDA.has(parole[0] ?? "")) return null
  if (parole.some((parola) => CONFERME_SEMPLICI.has(parola) || RIFIUTI_SEMPLICI.has(parola))) {
    return null
  }

  return originale
}

export function richiestaLetturaDocumenti(messaggio: string): boolean {
  const testo = normalizzaTestoDialogo(messaggio)
  return (
    /\b(leggi|controlla|vedi|scansiona|analizza)\b.*\b(documenti|file|cartella|nextcloud)\b/.test(
      testo,
    ) ||
    /\b(aggiorna|crea|compila)\b.*\b(crm|scheda|record|campi)\b/.test(testo) ||
    /\b(nuovi documenti|documenti nuovi|novita)\b/.test(testo)
  )
}

export function ricercaRecordSemplice(
  messaggio: string,
): { entita: EntitaAI; nome: string } | null {
  const testo = normalizzaTestoDialogo(messaggio)
  if (testo === "") return null
  if (!/\b(vedi|cerca|trova|controlla|esiste|presente|hai)\b/.test(testo)) return null

  let entita: EntitaAI | null = null
  if (/\b(clienti|cliente)\b/.test(testo)) entita = "cliente"
  else if (/\b(leads|lead)\b/.test(testo)) entita = "lead"
  else if (/\b(installatori|installatore)\b/.test(testo)) entita = "installatore"
  if (!entita) return null

  const nome = testo
    .replace(/\b(vedi|cerca|trova|controlla|esiste|presente|hai|mi|se|c|e|ce|lo|la|tra|fra|nei|nelle|negli|nel|nella|in|i|il|un|una|gli|le|crm|scheda|record)\b/g, " ")
    .replace(/\b(clienti|cliente|leads|lead|installatori|installatore)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const parole = nome.split(" ").filter(Boolean)
  if (parole.length < 2 || parole.length > 8) return null
  if (parole.some((parola) => PAROLE_DOMANDA.has(parola))) return null

  return { entita, nome }
}
