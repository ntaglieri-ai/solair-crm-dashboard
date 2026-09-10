import "server-only"

import { downloadFile, listFolder } from "@/lib/nextcloud/webdav"
import { commercialNextcloudUser } from "@/lib/offerta-commerciale/nextcloud-user"
import { createClient } from "@/lib/supabase/server"
import { fileRiguardaNome, paroleDelNome } from "./corrispondenza"
import type { EntitaAI, FileCandidato } from "./tipi"

/**
 * Accesso Nextcloud di SolairAI.
 *
 * Usa SEMPRE le credenziali dell'utente commerciale (app-password personale
 * di chi sta chattando), mai NEXTCLOUD_ASSET_USER: quell'account e' riservato
 * all'endpoint pubblico ed e' l'unico che vede la cartella degli asset. Con
 * l'app-password personale valgono anche le stesse visibilita' che l'utente
 * ha su Nextcloud, il che e' esattamente quello che vogliamo: SolairAI non
 * deve poter leggere una cartella che il suo utente non aprirebbe.
 */
export type AccessoAI = { username: string; appPassword: string }

export async function accessoAI(subject: {
  userId: string | null
  email: string | null
}): Promise<AccessoAI> {
  return commercialNextcloudUser(subject)
}

/** Profondita' massima della discesa nelle sottocartelle. */
const PROFONDITA_MAX = 3

/** Oltre questa soglia il turno si ferma: leggere 40 file costa e non serve. */
export const MAX_FILE_PER_TURNO = 8

/** 25 MB: il limite di richiesta della Claude API sta a 32 MB in base64. */
const MAX_BYTE_FILE = 25 * 1024 * 1024

/**
 * Impronta del contenuto. Stessa regola del sync del listino: dimensione e
 * data di modifica. Se il file cambia, cambia l'impronta e il file torna
 * "nuovo" — che e' proprio il comportamento che serve al check delle novita'.
 */
function fingerprintDi(voce: { size: number | null; lastModified: string | null }): string {
  return `size-mtime:${voce.size ?? "?"}-${voce.lastModified ?? "?"}`
}

async function scendi(
  accesso: AccessoAI,
  path: string,
  profondita: number,
): Promise<{ path: string; nome: string; size: number | null; lastModified: string | null }[]> {
  if (profondita > PROFONDITA_MAX) return []
  const voci = await listFolder(accesso.username, accesso.appPassword, path)
  const cartelle = voci.filter((voce) => voce.isDir)
  const annidati = await Promise.all(
    cartelle.map((voce) => scendi(accesso, voce.path, profondita + 1)),
  )
  return [
    ...voci
      .filter((voce) => !voce.isDir)
      .map((voce) => ({
        path: voce.path,
        nome: voce.name,
        size: voce.size,
        lastModified: voce.lastModified,
      })),
    ...annidati.flat(),
  ]
}

/**
 * I file della cartella configurata che riguardano `nome`.
 *
 * La cartella per tipo entita' e' una sola e dentro ci sta il materiale di
 * tutti: quali file sono di questa persona lo decide fileRiguardaNome, che
 * sta in un modulo puro perche' e' la regola che va tenuta sotto test.
 */
export async function fileDellaCartella(
  accesso: AccessoAI,
  cartella: string,
  nome: string,
): Promise<FileCandidato[]> {
  const parole = paroleDelNome(nome)
  if (parole.length === 0) return []

  const tutti = await scendi(accesso, cartella, 0)

  return tutti
    .filter((voce) => fileRiguardaNome(voce.path, cartella, parole))
    .filter((voce) => (voce.size ?? 0) <= MAX_BYTE_FILE)
    .map((voce) => ({
      path: voce.path,
      nome: voce.nome,
      dimensione: voce.size,
      modificatoIl: voce.lastModified,
      fingerprint: fingerprintDi(voce),
    }))
    .sort((a, b) => (b.modificatoIl ?? "").localeCompare(a.modificatoIl ?? ""))
}

/**
 * Sottrae dai candidati quelli gia' registrati in crm_ai_file_log con la
 * stessa impronta. E' il check "novita'" del punto 5: gira a ogni
 * interazione, prima di scaricare qualunque byte.
 *
 * `recordId` nullo = record non ancora creato: si confronta con le righe
 * che a loro volta non hanno record, cioe' le letture fatte prima che
 * qualcuno decidesse di crearlo.
 */
export async function soloNuovi(
  entita: EntitaAI,
  recordId: string | null,
  candidati: FileCandidato[],
): Promise<FileCandidato[]> {
  if (candidati.length === 0) return []
  const supabase = await createClient()

  let query = supabase
    .from("crm_ai_file_log")
    .select("path, fingerprint")
    .eq("entita", entita)
    .in(
      "path",
      candidati.map((file) => file.path),
    )

  query = recordId ? query.eq("record_id", recordId) : query.is("record_id", null)

  const { data, error } = await query
  if (error) throw new Error(`Registro file SolairAI non leggibile: ${error.message}`)

  const gia = new Set(
    ((data ?? []) as { path: string; fingerprint: string }[]).map(
      (riga) => `${riga.path} ${riga.fingerprint}`,
    ),
  )
  return candidati.filter((file) => !gia.has(`${file.path} ${file.fingerprint}`))
}

/** Registra i file letti. Idempotente: path+impronta per record e' unica. */
export async function registraLetture(
  entita: EntitaAI,
  recordId: string | null,
  utenteId: string,
  file: FileCandidato[],
): Promise<number> {
  if (file.length === 0) return 0
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crm_ai_file_log")
    .upsert(
      file.map((voce) => ({
        entita,
        record_id: recordId,
        path: voce.path,
        fingerprint: voce.fingerprint,
        dimensione: voce.dimensione,
        modificato_il: voce.modificatoIl,
        letto_da: utenteId,
        letto_il: new Date().toISOString(),
        esito: "letto" as const,
      })),
      { onConflict: "entita,record_id,path,fingerprint" },
    )
    .select("id")

  if (error) throw new Error(`Registro file SolairAI non aggiornato: ${error.message}`)
  return data?.length ?? 0
}

/**
 * Aggancia al record le letture fatte quando il record non esisteva ancora.
 * Va chiamata subito dopo una creazione, altrimenti quei file resterebbero
 * "senza record" e tornerebbero nuovi alla prima domanda sul record creato.
 */
export async function collegaLettureAlRecord(
  entita: EntitaAI,
  recordId: string,
  path: string[],
): Promise<void> {
  if (path.length === 0) return
  const supabase = await createClient()
  const { error } = await supabase
    .from("crm_ai_file_log")
    .update({ record_id: recordId })
    .eq("entita", entita)
    .is("record_id", null)
    .in("path", path)
  if (error) throw new Error(`Collegamento letture al record non riuscito: ${error.message}`)
}

export type ContenutoFile = {
  file: FileCandidato
  base64: string
  mediaType: string
}

const MEDIA_TYPE_PER_ESTENSIONE: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
}

/**
 * Solo PDF e immagini viaggiano come allegato nativo alla Claude API.
 * Tutto il resto (txt, csv, docx, eml...) viene passato come testo: il
 * modello legge quello che riesce a leggere, che e' il punto del
 * "qualsiasi formato, nessun parsing dedicato".
 */
export function mediaTypeDi(nome: string): string | null {
  const estensione = nome.split(".").pop()?.toLowerCase() ?? ""
  return MEDIA_TYPE_PER_ESTENSIONE[estensione] ?? null
}

export async function scaricaContenuti(
  accesso: AccessoAI,
  file: FileCandidato[],
): Promise<ContenutoFile[]> {
  return Promise.all(
    file.map(async (voce) => {
      const risposta = await downloadFile(accesso.username, accesso.appPassword, voce.path)
      const buffer = Buffer.from(await risposta.arrayBuffer())
      const mediaType = mediaTypeDi(voce.nome)
      return {
        file: voce,
        base64: buffer.toString("base64"),
        // Senza media type nativo il contenuto viene inviato come testo:
        // "text/plain" e' l'etichetta che il costruttore del messaggio usa
        // per decidere fra blocco document/image e blocco text.
        mediaType: mediaType ?? "text/plain",
      }
    }),
  )
}
