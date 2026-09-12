import { extensionOf } from "./estrazione-file"

export type ClassificazioneDocumentoCrm = {
  usaLlm: boolean
  soloAllegato: boolean
  score: number
  motivi: string[]
}

const ESTENSIONI_SOLO_ALLEGATO = new Set([
  "7z",
  "avi",
  "bak",
  "bin",
  "bmp",
  "cbr",
  "dmg",
  "exe",
  "gif",
  "heic",
  "jpeg",
  "jpg",
  "mov",
  "mp3",
  "mp4",
  "mpeg",
  "png",
  "rar",
  "tif",
  "tiff",
  "webp",
  "zip",
])

const ESTENSIONI_TESTO_LOCALE = new Set([
  "csv",
  "docm",
  "docx",
  "eml",
  "html",
  "json",
  "md",
  "ods",
  "odt",
  "pdf",
  "pptm",
  "pptx",
  "rtf",
  "txt",
  "xlsm",
  "xlsx",
  "xml",
])

const PAROLE_SOLO_ALLEGATO = [
  "backup",
  "disegno",
  "foto",
  "immagine",
  "layout",
  "mappa",
  "pianta",
  "piantina",
  "planimetria",
  "render",
  "schema",
  "screenshot",
  "temp",
  "whatsapp image",
]

const PAROLE_CRM_META = [
  "accettazione",
  "anagrafica",
  "bonifico",
  "cessione",
  "cliente",
  "contratto",
  "dati",
  "documento",
  "fattura",
  "finanziamento",
  "iban",
  "modulo",
  "offerta",
  "pod",
  "preventivo",
  "scheda",
  "sopralluogo",
  "verbale",
  "visura",
]

const PAROLE_CRM_TESTO = [
  "cabina primaria",
  "codice fiscale",
  "conto corrente",
  "data installazione",
  "documento d'identita",
  "documento di identita",
  "garanzia",
  "iban",
  "indirizzo",
  "inverter",
  "marca inverter",
  "numero pannelli",
  "partita iva",
  "piva",
  "pod",
  "potenza impianto",
  "ragione sociale",
  "recapito",
  "seriale",
  "telefono",
]

function normalizza(valore: string): string {
  return valore
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function contaOccorrenze(testo: string, parole: string[]) {
  return parole.filter((parola) => testo.includes(parola)).length
}

function segnaliStrutturati(testo: string) {
  const segnali: string[] = []
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(testo)) segnali.push("email")
  if (/\bIT\d{2}[A-Z]\d{10}[0-9A-Z]{12}\b/i.test(testo)) segnali.push("iban")
  if (/\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/i.test(testo)) {
    segnali.push("codice fiscale")
  }
  if (/\b(?:p\.?\s*iva|partita\s+iva|vat)\D{0,8}\d{11}\b/i.test(testo)) {
    segnali.push("partita iva")
  }
  if (/\bIT\d{3}E\d{8}\b/i.test(testo)) segnali.push("pod")
  if (/(?:\+39\s*)?(?:\d[\s.-]?){8,12}/.test(testo)) segnali.push("telefono")
  return segnali
}

export function classificaDocumentoCrm(params: {
  nome: string
  path: string
  testo: string
}): ClassificazioneDocumentoCrm {
  const ext = extensionOf(params.nome)
  const meta = normalizza(`${params.path} ${params.nome}`)
  const testo = normalizza(params.testo.slice(0, 80_000))
  const motivi: string[] = []

  const paroleAllegato = PAROLE_SOLO_ALLEGATO.filter((parola) => meta.includes(parola))
  if (paroleAllegato.length > 0) {
    motivi.push(`solo allegato: ${paroleAllegato.join(", ")}`)
    return { usaLlm: false, soloAllegato: true, score: 0, motivi }
  }

  if (ESTENSIONI_SOLO_ALLEGATO.has(ext)) {
    motivi.push(`estensione solo allegato: ${ext || "senza estensione"}`)
    return { usaLlm: false, soloAllegato: true, score: 0, motivi }
  }

  if (!ESTENSIONI_TESTO_LOCALE.has(ext)) {
    motivi.push(`estensione non adatta a campi CRM: ${ext || "senza estensione"}`)
    return { usaLlm: false, soloAllegato: true, score: 0, motivi }
  }

  let score = 0
  const metaHits = contaOccorrenze(meta, PAROLE_CRM_META)
  if (metaHits > 0) {
    score += metaHits * 2
    motivi.push(`${metaHits} segnale/i nel nome o percorso`)
  }

  if (testo) {
    const testoHits = contaOccorrenze(testo, PAROLE_CRM_TESTO)
    if (testoHits > 0) {
      score += testoHits
      motivi.push(`${testoHits} segnale/i nel testo`)
    }

    const strutturati = segnaliStrutturati(params.testo)
    if (strutturati.length > 0) {
      score += strutturati.length * 2
      motivi.push(`pattern: ${strutturati.join(", ")}`)
    }
  }

  if (!testo && score < 3) {
    motivi.push("nessun testo locale utile")
  }

  return {
    usaLlm: score >= 3,
    soloAllegato: score < 3,
    score,
    motivi: motivi.length > 0 ? motivi : ["nessun segnale CRM"],
  }
}
