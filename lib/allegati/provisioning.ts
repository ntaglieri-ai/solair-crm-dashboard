// Provisioning della cartella Nextcloud di un record alla sua creazione.
//
// Unico punto che decide cosa nasce insieme al record: la usano le route di
// creazione Lead/Cliente e gli script di migrazione, cosi' una cartella creata
// da uno script e' identica a quella creata dall'app (stesso percorso, stesse
// sottocartelle).
//
// Import relativi (non "@/"): il modulo viene caricato anche dagli script
// node in scripts/migrations.

import { ensureFolder, type WebDavResult } from "../nextcloud/admin-webdav"
import { documentiObbligatoriFolderPath, folderPathForRecord } from "./paths"

export async function provisionaCartellaRecord(
  tipo: "lead" | "cliente",
  recordId: string,
  nomeRecord: string,
): Promise<WebDavResult & { path: string }> {
  const path = folderPathForRecord(tipo, recordId, nomeRecord)
  const result = await ensureFolder(path)
  if (!result.ok || tipo !== "lead") return { ...result, path }

  // Sottocartella dei tre documenti obbligatori (spec FASE 1.3): creata
  // subito insieme alla cartella lead cosi' il commerciale trova gia' il
  // posto dove caricarli, anche caricando direttamente da Nextcloud senza
  // passare dal CRM. ensureFolder e' idempotente (405 = esiste gia').
  const docs = await ensureFolder(documentiObbligatoriFolderPath(recordId, nomeRecord))
  if (!docs.ok) {
    return { ...docs, path, error: `sottocartella documenti obbligatori: ${docs.error ?? docs.status}` }
  }
  return { ...result, path }
}
