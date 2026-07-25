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

function sanitizeName(name: string): string {
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

export function filePathForRecord(
  tipo: AllegatoRecordTipo,
  recordId: string,
  nomeRecord: string,
  nomeFile: string,
): string {
  return `${folderPathForRecord(tipo, recordId, nomeRecord)}/${sanitizeName(nomeFile)}`
}
