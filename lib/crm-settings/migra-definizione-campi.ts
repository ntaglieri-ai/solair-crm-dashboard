import type { SupabaseClient } from "@supabase/supabase-js"
import type { CampoTipo } from "@/lib/system-settings-data"
import { colonnaPerChiaveLayout, TABELLA_PER_LAYOUT_MODULO } from "./chiavi-campo"
import type { LayoutCampo } from "./layout"
import { loadLayout } from "./layout-server"
import { LAYOUT_MODULI, type LayoutModulo } from "./layout-validate"

/**
 * Sposta formula, sola lettura e formato da crm_layout_campi a
 * crm_custom_fields: dal PIAZZAMENTO del campo al campo stesso.
 *
 * Perche' non e' una migrazione SQL. Le due tabelle non parlano la stessa
 * lingua: il layout indicizza i campi con la chiave applicativa in stile Zoho
 * ("Importo Contrattuale"), crm_custom_fields con il nome della colonna
 * Postgres ("importo_contrattuale"). La corrispondenza fra le due e' descritta
 * in TypeScript (lib/permissions/field-map.ts, lib/leads/field-map.ts) e
 * Postgres non la conosce. Riscriverla in SQL vorrebbe dire duplicarla, e una
 * copia che diverge qui sposta una formula sulla colonna sbagliata.
 *
 * Gira in prova per default: con `apply: false` calcola e riporta tutto senza
 * scrivere niente, cosi' si vede cosa succederebbe prima che succeda.
 */

export type CampoSpostato = {
  fieldKey: string
  colonna: string
  formula: string | null
  solaLettura: boolean
  formato: Record<string, unknown>
  /** La riga di metadati non esisteva e va creata, non aggiornata. */
  creaRiga: boolean
}

export type CampoNonRisolto = {
  fieldKey: string
  motivo: string
}

export type EsitoMigrazione = {
  modulo: LayoutModulo
  tabella: string
  spostati: CampoSpostato[]
  nonRisolti: CampoNonRisolto[]
}

type PhysicalColumnRow = {
  column_name: string
  data_type: string
  is_nullable: string
  ordinal_position: number
}

type CustomFieldRow = { column_name: string }

function tipoDaDbType(value: string): CampoTipo {
  const type = value.toLowerCase()
  if (type.includes("timestamp")) return "datetime"
  if (type === "date") return "date"
  if (type === "boolean") return "boolean"
  if (type.includes("numeric") || type.includes("integer") || type.includes("double")) {
    return "number"
  }
  if (type === "uuid") return "lookup"
  return "text"
}

function etichettaDaColonna(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

/** Un campo porta una definizione da spostare solo se ne ha davvero una. */
function haDefinizione(campo: LayoutCampo) {
  return (
    campo.formula !== null ||
    campo.solaLettura ||
    Object.keys(campo.formato ?? {}).length > 0
  )
}

export async function migraDefinizioneModulo(
  supabase: SupabaseClient,
  modulo: LayoutModulo,
  { apply }: { apply: boolean },
): Promise<EsitoMigrazione> {
  const tabella = TABELLA_PER_LAYOUT_MODULO[modulo]
  const esito: EsitoMigrazione = { modulo, tabella, spostati: [], nonRisolti: [] }

  const pagine = await loadLayout(supabase, modulo)
  const campi = pagine
    .flatMap((pagina) => pagina.blocchi)
    .flatMap((blocco) => blocco.campi)
    .filter(haDefinizione)

  if (campi.length === 0) return esito

  // Serve sapere quali colonne esistono davvero e quali hanno gia' una riga di
  // metadati: la prima cosa decide se il campo e' reale, la seconda se la
  // scrittura e' un update o un insert.
  const { data: fisiche, error: erroreFisiche } = await supabase.rpc(
    "crm_admin_list_columns",
    { p_table_name: tabella },
  )
  if (erroreFisiche) {
    throw new Error(`Colonne di ${tabella}: ${erroreFisiche.message}`)
  }
  const perNome = new Map(
    ((fisiche ?? []) as PhysicalColumnRow[]).map((riga) => [riga.column_name, riga]),
  )

  const { data: esistenti, error: erroreEsistenti } = await supabase
    .from("crm_custom_fields")
    .select("column_name")
    .eq("table_name", tabella)
    .is("deleted_at", null)
  if (erroreEsistenti) {
    throw new Error(`Metadati di ${tabella}: ${erroreEsistenti.message}`)
  }
  const conRiga = new Set(
    ((esistenti ?? []) as CustomFieldRow[]).map((riga) => riga.column_name),
  )

  for (const campo of campi) {
    const colonna = colonnaPerChiaveLayout(campo.fieldKey, campo.origine, modulo)
    if (!colonna) {
      esito.nonRisolti.push({
        fieldKey: campo.fieldKey,
        motivo: "Nessuna colonna corrispondente nel ponte chiavi del modulo",
      })
      continue
    }

    const fisica = perNome.get(colonna)
    if (!fisica) {
      // Non e' per forza un errore: certi campi della scheda sono derivati, non
      // memorizzati. `installatori.proprietario_nome` per esempio si risolve a
      // ogni lettura dal proprietario_id, e una colonna con quel nome non
      // esiste ne' deve esistere. Per questi la definizione resta sul
      // piazzamento, che e' l'unico posto che li conosce.
      esito.nonRisolti.push({
        fieldKey: campo.fieldKey,
        motivo: `Nessuna colonna ${tabella}.${colonna}: probabile campo derivato, la definizione resta sul layout`,
      })
      continue
    }

    esito.spostati.push({
      fieldKey: campo.fieldKey,
      colonna,
      formula: campo.formula?.expr ?? null,
      solaLettura: campo.solaLettura,
      formato: campo.formato ?? {},
      creaRiga: !conRiga.has(colonna),
    })

    if (!apply) continue

    const definizione = {
      formula: campo.formula ? { ...campo.formula } : null,
      sola_lettura: campo.solaLettura,
      formato: campo.formato ?? {},
      updated_at: new Date().toISOString(),
    }

    if (conRiga.has(colonna)) {
      const { error } = await supabase
        .from("crm_custom_fields")
        .update(definizione)
        .eq("table_name", tabella)
        .eq("column_name", colonna)
        .is("deleted_at", null)
      if (error) {
        throw new Error(`Aggiornamento ${tabella}.${colonna}: ${error.message}`)
      }
      continue
    }

    // Nessuna riga di metadati: la colonna esiste in Postgres ma non e' mai
    // stata governata dalle impostazioni. Si registra ora, marcata `system`
    // perche' non l'ha creata un admin e non deve diventare cancellabile:
    // crm_admin_drop_column rifiuta di droppare le righe con system = true.
    const { error } = await supabase.from("crm_custom_fields").insert({
      modulo: tabella,
      field_key: colonna,
      label: campo.labelOverride ?? etichettaDaColonna(colonna),
      tipo: tipoDaDbType(fisica.data_type),
      required: fisica.is_nullable === "NO",
      visible: campo.visible,
      system: true,
      options: [],
      ordinamento: fisica.ordinal_position,
      table_name: tabella,
      column_name: colonna,
      db_type: fisica.data_type,
      ...definizione,
    })
    if (error) {
      throw new Error(`Registrazione ${tabella}.${colonna}: ${error.message}`)
    }
    conRiga.add(colonna)
  }

  return esito
}

/** Travasa tutti i moduli che hanno un layout. Vedi migraDefinizioneModulo. */
export async function migraDefinizioneTutti(
  supabase: SupabaseClient,
  { apply }: { apply: boolean },
) {
  const esiti: EsitoMigrazione[] = []
  for (const modulo of LAYOUT_MODULI) {
    esiti.push(await migraDefinizioneModulo(supabase, modulo, { apply }))
  }
  return esiti
}
