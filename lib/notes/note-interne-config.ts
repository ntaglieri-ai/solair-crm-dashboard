import type { FieldModuleKey } from "@/lib/permissions/field-catalog"

/**
 * Le note interne, descritte per modulo.
 *
 * Nascono sul Cliente e servono anche su Installatori. Invece di duplicare
 * il codice — che qui e' codice di sicurezza, e due copie divergono — il
 * comportamento resta uno solo e cambia solo questa descrizione.
 *
 * Ogni modulo dice: dove stanno le sue note, a quale record appartengono,
 * chi ne e' il proprietario e quale permesso governa la lettura.
 */
export type NoteInterneConfig = {
  /** Modulo dei permessi ("clienti", "installatori"). */
  modulo: FieldModuleKey
  /** Tabella delle note interne del modulo. */
  tabella: string
  /** Colonna che collega la nota al record. */
  colonnaRecord: string
  /** Tabella del record a cui la nota appartiene. */
  tabellaRecord: string
  /** Colonna del proprietario sul record, per il perimetro di visibilita'. */
  colonnaProprietario: string
  /** Azione che abilita la lettura delle note interne. */
  azione: string
  /** Tipo di record per gli allegati su Nextcloud. */
  recordTipo: "cliente" | "installatore"
  /** Etichetta usata quando il nome del record non e' recuperabile. */
  etichetta: string
}

export const NOTE_INTERNE_CLIENTI: NoteInterneConfig = {
  modulo: "clienti",
  tabella: "cliente_note_interne",
  colonnaRecord: "cliente_id",
  tabellaRecord: "clienti",
  colonnaProprietario: "clienti_proprietario_id",
  azione: "clienti.note_interne.view",
  recordTipo: "cliente",
  etichetta: "Cliente",
}

export const NOTE_INTERNE_INSTALLATORI: NoteInterneConfig = {
  modulo: "installatori",
  tabella: "installatore_note_interne",
  colonnaRecord: "installatore_id",
  tabellaRecord: "installatori",
  colonnaProprietario: "proprietario_id",
  azione: "installatori.note_interne.view",
  recordTipo: "installatore",
  etichetta: "Installatore",
}
