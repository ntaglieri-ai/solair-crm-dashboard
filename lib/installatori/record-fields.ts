// Campi del record Installatore, nella stessa forma column/appField usata da
// Clienti (lib/clienti/zoho-fields.ts) e Lead (lib/leads/field-map.ts): e' la
// mappa che l'invio di massa usa per risolvere i segnaposto {Campo} nei
// modelli e-mail. Gli Installatori non vengono da un import Zoho, quindi qui
// non c'e' un CSV da tradurre: la tabella (lib/installatori/repository.ts,
// INSTALLATORE_COLUMNS) e' l'unica fonte.
export type InstallatoreRecordFieldType = "text" | "boolean" | "timestamp"

export interface InstallatoreRecordField {
  column: string
  type: InstallatoreRecordFieldType
  appField: string
}

export const INSTALLATORI_RECORD_FIELDS = [
  { column: "nome", type: "text", appField: "Nome" },
  { column: "email", type: "text", appField: "E-mail" },
  { column: "email_secondaria", type: "text", appField: "E-mail secondaria" },
  { column: "telefono", type: "text", appField: "Telefono" },
  { column: "tag", type: "text", appField: "Tag" },
  { column: "attivo", type: "boolean", appField: "Attivo" },
  { column: "canale_preferito", type: "text", appField: "Canale preferito" },
  { column: "note", type: "text", appField: "Note" },
  { column: "created_at", type: "timestamp", appField: "Creato il" },
  { column: "updated_at", type: "timestamp", appField: "Modificato il" },
] as const satisfies readonly InstallatoreRecordField[]
