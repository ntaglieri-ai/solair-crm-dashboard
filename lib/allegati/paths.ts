// Calcolo dei percorsi cartella per gli allegati record (Lead/Cliente/
// Installatori). Riusa la struttura cartelle già esistente e migrata da
// Zoho (decisione presa il 25/07 con Nando, dopo aver ispezionato il
// contenuto reale con rclone) — nessuna struttura parallela nuova.
//
// ATTENZIONE: TEAM_FOLDER_ROOT va confermato con un test dal vivo (un
// upload reale) prima di considerarlo definitivo — verificato che
// l'account "solair-storage" vede questi percorsi sotto
// solair-storage:/Solair-FileManager/Vendita-Digitale/..., ma le funzioni
// admin-webdav.ts qui operano con l'account ADMIN (nextcloudAdminConfig),
// che potrebbe vedere la stessa Team Folder "Solair" con un path leggermente
// diverso alla radice. Se il primo upload di prova fallisce con 404/409,
// aggiusta SOLO questa costante.

export type AllegatoRecordTipo = "lead" | "cliente" | "installatore"

const TEAM_FOLDER_ROOT = "Solair/Vendita-Digitale"

const BASE_BY_TIPO: Record<AllegatoRecordTipo, string> = {
  lead: `${TEAM_FOLDER_ROOT}/Preventivi progetto 2.0`,
  cliente: `${TEAM_FOLDER_ROOT}/Clienti 2.0`,
  installatore: `${TEAM_FOLDER_ROOT}/INSTALLATORI`,
}

export function sanitizeName(name: string): string {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 150)
}

function suffisso(recordId: string): string {
  return recordId.replace(/-/g, "").slice(-6)
}

/**
 * Percorso cartella per un record. Deterministico: stesso recordId+nome
 * produce sempre lo stesso percorso, cosi' si puo' ricalcolare senza
 * doverlo salvare da nessuna parte.
 */
export function folderPathForRecord(
  tipo: AllegatoRecordTipo,
  recordId: string,
  nomeRecord: string,
): string {
  const base = BASE_BY_TIPO[tipo]
  const cartella = `${sanitizeName(nomeRecord)} - ${suffisso(recordId)}`
  return `${base}/${cartella}`
}

/**
 * Il path appartiene davvero alla cartella di QUESTO record?
 * Le route allegati operano con le credenziali ADMIN Nextcloud (vedono
 * l'intera Team Folder), quindi un path arbitrario preso dalla query string
 * va sempre validato prima di download/delete: senza questo controllo un
 * utente con il solo permesso "view" sui Lead potrebbe leggere qualunque
 * file dell'istanza. Rifiuta anche ogni tentativo di traversal ("..").
 */
export function isPathInsideRecordFolder(
  tipo: AllegatoRecordTipo,
  recordId: string,
  nomeRecord: string,
  path: string,
): boolean {
  const normalized = path.replace(/^\/+/, "").replace(/\/{2,}/g, "/").replace(/\/+$/, "")
  if (!normalized) return false
  if (normalized.split("/").some((seg) => seg === "." || seg === "..")) return false
  return normalized.startsWith(`${folderPathForRecord(tipo, recordId, nomeRecord)}/`)
}

/**
 * Nome fisso della sottocartella che raccoglie i tre documenti obbligatori
 * del lead (spec FASE 1.3). Fisso e non configurabile perche' e' anche il
 * riferimento che i commerciali vedono da Nextcloud: se cambia qui, le
 * cartelle gia' create restano orfane.
 */
export const DOCUMENTI_OBBLIGATORI_FOLDER = "Documenti obbligatori"

/**
 * Sottocartella "Documenti obbligatori" dentro la cartella del lead. Il gate
 * di conversione Lead -> Cliente conta i file QUI dentro e non nella cartella
 * lead principale: cosi' gli allegati liberi (foto, mail, preventivi vari)
 * non falsano il conteggio, e non serve nessun parsing del nome file.
 */
export function documentiObbligatoriFolderPath(
  recordId: string,
  nomeRecord: string,
): string {
  return `${folderPathForRecord("lead", recordId, nomeRecord)}/${DOCUMENTI_OBBLIGATORI_FOLDER}`
}

/**
 * Separa il nome dall'estensione. L'estensione non e' mai parte del nome
 * "modificabile": e' cio' che rende apribile il file, e un nome corretto a
 * mano e' esattamente il posto in cui si perde per sbaglio.
 *
 * Un punto in posizione 0 (".gitignore") non e' un'estensione ma un file
 * nascosto: resta tutto nel nome.
 */
export function splitEstensione(nomeFile: string): { base: string; estensione: string } {
  const punto = nomeFile.lastIndexOf(".")
  if (punto <= 0) return { base: nomeFile, estensione: "" }
  return { base: nomeFile.slice(0, punto), estensione: nomeFile.slice(punto) }
}

/**
 * Nome libero nella cartella: `nomeFile` se non e' gia' preso, altrimenti
 * `base_2.ext`, `base_3.ext` e cosi' via (spec 5.3 — il suffisso va sul nome,
 * non dopo l'estensione).
 *
 * Serve perche' l'upload WebDAV e' un PUT: due file con lo stesso nome non
 * danno errore, il secondo sostituisce il primo senza dire niente. Con la
 * convenzione {Tipo}_{Cognome}_{AAAAMMGG} il rischio smette di essere teorico,
 * perche' due documenti dello stesso tipo caricati lo stesso giorno per lo
 * stesso cliente producono per costruzione lo stesso nome.
 *
 * Confronto case-insensitive: il backend potrebbe essere case-sensitive e
 * tenerli entrambi, ma "Fattura_Rossi_20260815.pdf" accanto a
 * "fattura_rossi_20260815.pdf" e' comunque un doppione da leggere a occhio.
 *
 * Funzione pura sui nomi: la usano sia il dialog (anteprima mentre si scrive,
 * sulla lista gia' caricata) sia la route di upload (verifica sulla cartella
 * reale, subito prima del PUT). Una regola sola, in un posto solo.
 */
export function nomeSenzaCollisioni(
  nomeFile: string,
  esistenti: readonly string[],
): string {
  const presi = new Set(esistenti.map((nome) => nome.toLowerCase()))
  if (!presi.has(nomeFile.toLowerCase())) return nomeFile

  const { base, estensione } = splitEstensione(nomeFile)
  // Termina sempre: `presi` e' finito e ogni giro prova un nome diverso.
  for (let progressivo = 2; ; progressivo++) {
    const tentativo = `${base}_${progressivo}${estensione}`
    if (!presi.has(tentativo.toLowerCase())) return tentativo
  }
}
