import { CLIENTI_ZOHO_FIELDS } from "@/lib/clienti/zoho-fields"
import { LEAD_RECORD_APP_FIELD_TO_COLUMN } from "@/lib/leads/field-map"
import { chiaveCampoCliente } from "@/lib/permissions/field-map"
import type { LayoutFieldOrigine } from "./layout"
import type { LayoutModulo } from "./layout-validate"
import { isValidColumnName } from "./schema-admin"

/**
 * Ponte fra le due lingue con cui il CRM chiama lo stesso campo.
 *
 * Il layout indicizza i campi con la chiave applicativa in stile Zoho
 * ("Importo Contrattuale"), perche' e' cosi' che il record espone i suoi dati
 * alla scheda. crm_custom_fields e crm_column_values usano invece il nome
 * della colonna Postgres ("importo_contrattuale").
 *
 * Finche' le due parti non si parlavano la differenza non dava fastidio. Ora
 * che la definizione di un campo (tipo, valori, formula) sta su
 * crm_custom_fields mentre la sua posizione sta sul layout, serve un punto
 * solo che sappia tradurre: due copie di questa regola divergerebbero, e una
 * traduzione sbagliata qui attacca una formula alla colonna sbagliata.
 */

/**
 * Ripiego sull'etichetta Zoho grezza.
 *
 * Il layout dei clienti e' stato seminato dall'export Zoho usando l'etichetta
 * del campo cosi' come la scrive Zoho, mentre il ponte dei permessi ragiona
 * sull'etichetta applicativa. Per la gran parte dei campi le due coincidono,
 * ma non sempre: Zoho tiene parentesi e spazi che il nome applicativo perde.
 *
 *   "Tempo medio impiegato (minuti)"  ->  appField "Tempo medio impiegato minuti"
 *   "Tot Potenza AC (KW)"             ->  appField "Tot Potenza AC KW"
 *   "Fattura 1"                       ->  appField "Fattura1"
 *
 * Senza questo ripiego quei campi risultano senza colonna e la loro
 * definizione resta indietro. Si prova per secondo, mai per primo: l'etichetta
 * applicativa resta la chiave buona, questa serve solo a recuperare i casi in
 * cui il layout porta ancora il nome di provenienza.
 */
const COLONNA_PER_ETICHETTA_ZOHO: Record<string, string | undefined> =
  Object.fromEntries(CLIENTI_ZOHO_FIELDS.map((campo) => [campo.zoho, campo.column]))

export const TABELLA_PER_LAYOUT_MODULO: Record<LayoutModulo, string> = {
  clienti: "clienti",
  lead: "leads",
  installatori: "installatori",
  compiti: "compiti",
}

/**
 * Nome della colonna Postgres per una chiave del layout, o null se non esiste
 * corrispondenza.
 *
 * I campi `custom` portano gia' il nome della colonna come chiave, per
 * costruzione (crm_admin_add_column scrive field_key = column_name). I campi
 * `system` passano dal ponte del loro modulo; installatori e compiti non hanno
 * il livello di etichette Zoho e lavorano gia' in snake_case, quindi li' la
 * chiave vale se e' un nome di colonna valido.
 */
export function colonnaPerChiaveLayout(
  fieldKey: string,
  origine: LayoutFieldOrigine,
  modulo: LayoutModulo,
): string | null {
  if (origine === "custom") {
    return isValidColumnName(fieldKey) ? fieldKey : null
  }
  if (modulo === "clienti") {
    return chiaveCampoCliente(fieldKey) ?? COLONNA_PER_ETICHETTA_ZOHO[fieldKey] ?? null
  }
  if (modulo === "lead") {
    // La mappa e' tipizzata sulle chiavi note di Lead; qui la chiave arriva dal
    // database e puo' essere qualunque cosa, anche una rimasta indietro.
    const perEtichetta = LEAD_RECORD_APP_FIELD_TO_COLUMN as Record<string, string | undefined>
    return perEtichetta[fieldKey] ?? null
  }
  return isValidColumnName(fieldKey) ? fieldKey : null
}
