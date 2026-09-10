/**
 * Tipi condivisi di SolairAI.
 *
 * Questo modulo lo importa anche la pagina client: non deve tirarsi dietro
 * niente di server-only (Supabase, permissions/server, Nextcloud). Se un
 * giorno serve una costante che sa di server, va in un altro file — un
 * import sbagliato qui non rompe typecheck ne' lint, rompe solo `pnpm build`.
 */

export const ENTITA_AI = ["lead", "cliente", "installatore"] as const
export type EntitaAI = (typeof ENTITA_AI)[number]

export function isEntitaAI(value: unknown): value is EntitaAI {
  return typeof value === "string" && (ENTITA_AI as readonly string[]).includes(value)
}

export const ENTITA_LABEL: Record<EntitaAI, string> = {
  lead: "Lead",
  cliente: "Cliente",
  installatore: "Installatore",
}

/** Articolo per le frasi del bot: "Creo il lead", "Creo l'installatore". */
export const ENTITA_ARTICOLO: Record<EntitaAI, string> = {
  lead: "il lead",
  cliente: "il cliente",
  installatore: "l'installatore",
}

/** Un file Nextcloud candidato alla lettura. */
export type FileCandidato = {
  path: string
  nome: string
  dimensione: number | null
  modificatoIl: string | null
  /** etag quando c'e', altrimenti dimensione+data modifica. */
  fingerprint: string
}

/** Un campo che il documento propone di scrivere. */
export type CampoProposto = {
  /** Colonna reale della tabella del record. */
  campo: string
  /** Etichetta CRM, per mostrarla senza rifare la mappatura lato pagina. */
  etichetta: string
  /** Valore proposto, gia' normalizzato al tipo della colonna. */
  valore: string
  /** Path Nextcloud del documento da cui viene. */
  fonte: string
}

/**
 * La proposta che il bot mette in attesa di conferma. Viaggia avanti e
 * indietro col client, ma non e' fidata: /applica rilegge il record e
 * rivalida ogni campo contro il catalogo prima di scrivere.
 */
export type PropostaAI = {
  entita: EntitaAI
  nome: string
  /** Assente quando il record non esiste ancora: allora si tratta di crearlo. */
  recordId: string | null
  /** Etichetta del record trovato, per il messaggio di conferma. */
  recordEtichetta: string | null
  campi: CampoProposto[]
  file: FileCandidato[]
  riepilogo: string
}

/** Stato della conversazione, tenuto dal client e rimandato a ogni turno. */
export type StatoConversazione = {
  entita: EntitaAI | null
  nome: string | null
  proposta: PropostaAI | null
}

export const STATO_INIZIALE: StatoConversazione = {
  entita: null,
  nome: null,
  proposta: null,
}

export type RuoloMessaggio = "utente" | "bot"

export type MessaggioChat = {
  id: string
  ruolo: RuoloMessaggio
  testo: string
  /** Dettaglio strutturato che la bolla mostra sotto il testo. */
  proposta?: PropostaAI | null
  /** File letti in questo turno, elencati sotto la risposta. */
  file?: FileCandidato[]
}

export type EsitoApplicazione = {
  recordId: string
  creato: boolean
  aggiornati: CampoProposto[]
  inRevisione: CampoProposto[]
  invariati: CampoProposto[]
  fileRegistrati: number
  nota: string
}

export type RisposteChat = {
  messaggio: string
  stato: StatoConversazione
  file?: FileCandidato[]
  /** true quando il bot sta aspettando un si'/no sulla proposta. */
  attendeConferma: boolean
  /**
   * true quando l'utente ha appena confermato: il client chiama
   * /api/solair-ai/applica. La scrittura sta dietro un endpoint suo perche'
   * e' l'unico punto che tocca i record, e cosi' ha un permesso e un audit
   * suoi invece di nascondersi dentro un turno di chat.
   */
  applica?: boolean
}

export type RevisionePending = {
  id: string
  record_tipo: EntitaAI
  record_id: string
  campo: string
  campo_etichetta: string | null
  valore_attuale: string | null
  valore_proposto: string
  fonte_documento: string
  stato: "pending" | "accettata" | "rifiutata"
  creato_il: string
  creato_da_nome: string | null
}
