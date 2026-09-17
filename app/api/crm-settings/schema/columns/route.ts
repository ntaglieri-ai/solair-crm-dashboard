import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireApiAction } from "@/lib/permissions/server"
import {
  dbTypeForFieldType,
  isValidColumnName,
  tableForCrmModule,
  valueKeyFromLabel,
} from "@/lib/crm-settings/schema-admin"
import { valutaFormula } from "@/lib/crm-settings/formula-eval"
import { CAMPO_TIPI, type CampoTipo } from "@/lib/system-settings-data"

type ValoreIniziale = { label?: string; color?: string }

type ColumnBody = {
  module?: string
  name?: string
  label?: string
  type?: CampoTipo
  required?: boolean
  visible?: boolean
  /** Opzioni della tendina, definite insieme al campo per select e multiselect. */
  values?: ValoreIniziale[]
  /** Espressione del campo calcolato; null la rimuove e il campo torna scrivibile. */
  formula?: { expr?: string } | null
  solaLettura?: boolean
  formato?: Record<string, unknown> | null
}

/**
 * I tipi che possono convivere con una colonna gia' esistente.
 *
 * Il tipo applicativo e quello di storage sono due cose diverse: "Elenco di
 * selezione" e "Linea singola" sono entrambi `text` in Postgres, e passare
 * dall'uno all'altro non tocca la colonna. Cambiare invece un campo numerico
 * in testuale vorrebbe dire riscrivere la colonna, cosa che qui non si fa mai:
 * questa mappa dice quali cambi sono solo di interpretazione.
 */
function tipiCompatibiliCon(dbType: string): CampoTipo[] {
  const tipo = dbType.toLowerCase()
  if (tipo === "text[]" || tipo.includes("array")) return ["multiselect"]
  if (tipo.includes("char") || tipo === "text") {
    return ["text", "textarea", "select", "email", "phone", "url"]
  }
  if (tipo.includes("numeric") || tipo.includes("int") || tipo.includes("double")) {
    return ["number", "decimal", "currency", "percent"]
  }
  if (tipo === "boolean") return ["boolean"]
  if (tipo === "date") return ["date"]
  if (tipo.includes("timestamp")) return ["datetime"]
  if (tipo === "uuid") return ["lookup"]
  return []
}

type PhysicalColumnRow = {
  column_name: string
  data_type: string
  is_nullable: string
  ordinal_position: number
}

type CustomFieldRow = {
  id: string
  field_key: string
  label: string
  tipo: CampoTipo
  required: boolean
  visible: boolean
  system: boolean
  table_name: string
  column_name: string
  db_type: string
  formula: { expr?: string } | null
  sola_lettura: boolean
  formato: Record<string, unknown> | null
}

function schemaAdminClient() {
  const admin = createAdminClient()
  if (!admin) {
    return {
      client: null,
      response: NextResponse.json(
        { error: "Supabase admin non configurato" },
        { status: 503 },
      ),
    }
  }
  return { client: admin, response: null }
}

function titleFromColumn(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function fieldTypeFromDbType(value: string): CampoTipo {
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

function schemaErrorMessage(error: { message?: string; code?: string }) {
  const message = error.message ?? "Operazione schema non riuscita"
  const lowerMessage = message.toLowerCase()
  if (
    lowerMessage.includes("column crm_custom_fields.") ||
    lowerMessage.includes("could not find the") ||
    lowerMessage.includes("column") && lowerMessage.includes("does not exist")
  ) {
    return "Schema campi CRM incompleto su Supabase. Esegui la query di creazione crm_custom_fields."
  }
  if (
    error.code === "42883" ||
    lowerMessage.includes("function") ||
    lowerMessage.includes("schema cache")
  ) {
    return "Funzioni schema CRM non presenti su Supabase. Applica supabase/permission-engine-schema.sql."
  }
  return message
}

function logSchemaError(operation: string, error: { message?: string; code?: string }) {
  console.error(`[crm-settings/schema/columns] ${operation}`, {
    code: error.code ?? "unknown",
    message: error.message ?? "unknown",
  })
}

function isMissingSchemaObject(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ""
  return (
    error?.code === "42P01" ||
    error?.code === "42883" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  )
}

export async function GET(request: Request) {
  const guard = await requireApiAction("crm_settings.system.schema.manage")
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const tableName = tableForCrmModule(searchParams.get("module") ?? "")
  if (!tableName) {
    return NextResponse.json({ error: "Modulo CRM non valido" }, { status: 400 })
  }

  const { client: supabase, response } = schemaAdminClient()
  if (response) return response
  const { data: physicalColumns, error: physicalError } = await supabase.rpc(
    "crm_admin_list_columns",
    { p_table_name: tableName },
  )

  if (physicalError) {
    logSchemaError("list columns", physicalError)
    return NextResponse.json({ error: schemaErrorMessage(physicalError) }, { status: 500 })
  }

  const { data: customFields, error: customError } = await supabase
    .from("crm_custom_fields")
    .select(
      "id, field_key, label, tipo, required, visible, system, table_name, column_name, db_type, formula, sola_lettura, formato",
    )
    .eq("table_name", tableName)
    .is("deleted_at", null)
    .order("ordinamento", { ascending: true })

  if (customError && !isMissingSchemaObject(customError)) {
    logSchemaError("read custom fields", customError)
    return NextResponse.json({ error: schemaErrorMessage(customError) }, { status: 500 })
  }

  const customByColumn = new Map(
    ((customFields ?? []) as CustomFieldRow[]).map((field) => [field.column_name, field]),
  )
  const columns = ((physicalColumns ?? []) as PhysicalColumnRow[]).map((column) => {
    const custom = customByColumn.get(column.column_name)
    // Una colonna NOT NULL e' obbligatoria e basta: se i metadati dicessero il
    // contrario il form smetterebbe di imporre il campo e l'insert fallirebbe
    // a valle, con un errore Postgres al posto di una validazione leggibile.
    const notNull = column.is_nullable === "NO"
    return {
      id: custom?.id ?? column.column_name,
      field_key: custom?.field_key ?? column.column_name,
      label: custom?.label ?? titleFromColumn(column.column_name),
      tipo: custom?.tipo ?? fieldTypeFromDbType(column.data_type),
      required: notNull || (custom?.required ?? false),
      requiredBloccato: notNull,
      visible: custom?.visible ?? true,
      system: custom ? custom.system : true,
      table_name: tableName,
      column_name: column.column_name,
      db_type: custom?.db_type ?? column.data_type,
      ordinal_position: column.ordinal_position,
      formula: custom?.formula?.expr ? custom.formula : null,
      sola_lettura: custom?.sola_lettura ?? false,
      formato: custom?.formato ?? {},
      // Quali tipi si possono scegliere senza toccare la colonna: la UI ne ha
      // bisogno per non proporre cambi che verrebbero rifiutati.
      tipi_compatibili: tipiCompatibiliCon(custom?.db_type ?? column.data_type),
    }
  })

  return NextResponse.json({ columns })
}

export async function POST(request: Request) {
  const guard = await requireApiAction("crm_settings.system.schema.manage")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as ColumnBody | null
  const moduleName = body?.module ?? ""
  const tableName = tableForCrmModule(moduleName)
  const name = body?.name?.trim() ?? ""
  const label = body?.label?.trim() ?? ""
  const fieldType = body?.type ?? "text"
  const dbType = dbTypeForFieldType(fieldType)

  if (!tableName) {
    return NextResponse.json({ error: "Modulo CRM non valido" }, { status: 400 })
  }
  if (!isValidColumnName(name)) {
    return NextResponse.json({ error: "Nome colonna non valido" }, { status: 400 })
  }
  if (!label) {
    return NextResponse.json({ error: "Etichetta obbligatoria" }, { status: 400 })
  }
  if (!dbType) {
    return NextResponse.json({ error: "Tipo campo non valido" }, { status: 400 })
  }

  // Le opzioni della tendina si definiscono insieme al campo: un "Elenco di
  // selezione" creato vuoto e' inutilizzabile finche' qualcuno non si ricorda
  // di tornare a riempirlo, ed e' esattamente il passaggio che si dimentica.
  const wantsValues = fieldType === "select" || fieldType === "multiselect"
  const values = wantsValues ? (body?.values ?? []) : []
  const valoriPuliti: { value: string; label: string; color: string | null }[] = []
  const chiaviViste = new Set<string>()
  for (const valore of values) {
    const etichetta = valore?.label?.trim() ?? ""
    if (!etichetta) continue
    const chiave = valueKeyFromLabel(etichetta)
    if (!chiave || chiaviViste.has(chiave)) continue
    chiaviViste.add(chiave)
    valoriPuliti.push({ value: chiave, label: etichetta, color: valore?.color ?? null })
  }

  const { client: supabase, response } = schemaAdminClient()
  if (response) return response
  const { data, error } = await supabase.rpc("crm_admin_add_column", {
    p_table_name: tableName,
    p_column_name: name,
    p_db_type: dbType,
    p_label: label,
    p_field_type: fieldType,
    p_required: Boolean(body?.required),
    p_visible: body?.visible ?? true,
  })

  if (error) {
    logSchemaError("add column", error)
    return NextResponse.json({ error: schemaErrorMessage(error) }, { status: 500 })
  }

  if (valoriPuliti.length > 0) {
    const { error: erroreValori } = await supabase.from("crm_column_values").insert(
      valoriPuliti.map((valore, indice) => ({
        table_name: tableName,
        column_name: name,
        value: valore.value,
        label: valore.label,
        color: valore.color,
        sort_order: indice,
        active: true,
      })),
    )

    // La colonna esiste gia': fallire tutto adesso lascerebbe un campo a meta'
    // senza dirlo. Meglio confermare la creazione e segnalare che le opzioni
    // vanno reinserite, cosi' l'admin sa esattamente cosa gli manca.
    if (erroreValori) {
      logSchemaError("insert column values", erroreValori)
      return NextResponse.json({
        ok: true,
        id: data,
        avviso: `Campo creato, ma le opzioni non sono state salvate: ${erroreValori.message}`,
      })
    }
  }

  return NextResponse.json({ ok: true, id: data, valori: valoriPuliti.length })
}

export async function PATCH(request: Request) {
  const guard = await requireApiAction("crm_settings.system.schema.manage")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as
    | (ColumnBody & { column?: string })
    | null
  const tableName = tableForCrmModule(body?.module ?? "")
  const columnName = body?.column?.trim() ?? body?.name?.trim() ?? ""

  if (!tableName || !isValidColumnName(columnName)) {
    return NextResponse.json({ error: "Campo CRM non valido" }, { status: 400 })
  }

  const { client: supabase, response } = schemaAdminClient()
  if (response) return response

  // La colonna fisica serve sempre, non solo quando i metadati mancano: e' lei
  // a dire se il campo puo' smettere di essere obbligatorio e quali tipi sono
  // compatibili. Senza, si accetterebbero patch che rompono gli inserimenti.
  const { data: physicalColumns, error: physicalError } = await supabase.rpc(
    "crm_admin_list_columns",
    { p_table_name: tableName },
  )

  if (physicalError) {
    logSchemaError("list columns for metadata patch", physicalError)
    return NextResponse.json({ error: schemaErrorMessage(physicalError) }, { status: 500 })
  }

  const physical = ((physicalColumns ?? []) as PhysicalColumnRow[]).find(
    (column) => column.column_name === columnName,
  )
  if (!physical) {
    return NextResponse.json({ error: "Campo CRM non trovato" }, { status: 404 })
  }

  const { data: existing, error: lookupError } = await supabase
    .from("crm_custom_fields")
    .select("id, tipo, db_type")
    .eq("table_name", tableName)
    .eq("column_name", columnName)
    .is("deleted_at", null)
    .maybeSingle()

  if (lookupError) {
    logSchemaError("lookup custom field", lookupError)
    return NextResponse.json({ error: schemaErrorMessage(lookupError) }, { status: 500 })
  }

  const existingRow = existing as { id: string; tipo: CampoTipo; db_type: string } | null
  const dbType = existingRow?.db_type ?? physical.data_type
  const notNull = physical.is_nullable === "NO"

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body?.label === "string" && body.label.trim()) patch.label = body.label.trim()
  if (typeof body?.visible === "boolean") patch.visible = body.visible

  if (typeof body?.required === "boolean") {
    if (notNull && !body.required) {
      return NextResponse.json(
        {
          error: `La colonna ${tableName}.${columnName} e' NOT NULL: il campo non puo' diventare facoltativo senza modificare la colonna.`,
        },
        { status: 400 },
      )
    }
    patch.required = body.required
  }

  // Il tipo si cambia solo a livello applicativo: "Elenco di selezione" e
  // "Linea singola" sono entrambi text, passare dall'uno all'altro e' una
  // reinterpretazione. Un cambio che richiederebbe ALTER COLUMN si rifiuta,
  // perche' convertire una colonna popolata e' un'operazione distruttiva che
  // non deve nascondersi dietro a un menu a tendina.
  if (typeof body?.type === "string") {
    if (!CAMPO_TIPI.includes(body.type)) {
      return NextResponse.json({ error: "Tipo campo non valido" }, { status: 400 })
    }
    const compatibili = tipiCompatibiliCon(dbType)
    if (!compatibili.includes(body.type)) {
      return NextResponse.json(
        {
          error: `Il tipo "${body.type}" non e' compatibile con la colonna ${dbType}. Tipi ammessi: ${compatibili.join(", ") || "nessuno"}.`,
        },
        { status: 400 },
      )
    }
    patch.tipo = body.type
  }

  if (typeof body?.solaLettura === "boolean") patch.sola_lettura = body.solaLettura

  if (body?.formato !== undefined) {
    if (body.formato !== null && (typeof body.formato !== "object" || Array.isArray(body.formato))) {
      return NextResponse.json({ error: "Formato non valido" }, { status: 400 })
    }
    patch.formato = body.formato ?? {}
  }

  if (body?.formula !== undefined) {
    const expr = body.formula?.expr?.trim() ?? ""
    if (!expr) {
      // Svuotare la formula rende il campo di nuovo scrivibile: e' il modo
      // previsto per tornare indietro da un campo calcolato.
      patch.formula = null
    } else {
      // Stesso valutatore che usera' la scheda: un refuso si vede adesso,
      // non quando il campo mostra un numero sbagliato a chi lavora.
      const esito = valutaFormula(expr, new Map())
      if (!esito.ok) {
        return NextResponse.json(
          { error: `Formula non valida: ${esito.errore}` },
          { status: 400 },
        )
      }
      patch.formula = { ...body.formula, expr }
    }
  }

  if (existingRow) {
    const { error } = await supabase
      .from("crm_custom_fields")
      .update(patch)
      .eq("table_name", tableName)
      .eq("column_name", columnName)
      .is("deleted_at", null)

    if (error) {
      logSchemaError("update custom field", error)
      return NextResponse.json({ error: schemaErrorMessage(error) }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  // Colonna reale mai governata dalle impostazioni: si registra adesso.
  // `system: true` perche' non l'ha creata un admin e non deve diventare
  // cancellabile — crm_admin_drop_column rifiuta le righe con system = true.
  // upsert e non insert: una riga soft-deleted occupa comunque il vincolo
  // unico, e un insert secco fallirebbe con un duplicate key poco leggibile.
  const { error: upsertError } = await supabase.from("crm_custom_fields").upsert(
    {
      modulo: tableName,
      field_key: columnName,
      label: (patch.label as string) ?? titleFromColumn(columnName),
      tipo: (patch.tipo as CampoTipo) ?? fieldTypeFromDbType(physical.data_type),
      required: (patch.required as boolean) ?? notNull,
      visible: (patch.visible as boolean) ?? true,
      system: true,
      options: [],
      ordinamento: physical.ordinal_position,
      table_name: tableName,
      column_name: columnName,
      db_type: physical.data_type,
      deleted_at: null,
      sola_lettura: (patch.sola_lettura as boolean) ?? false,
      formato: (patch.formato as Record<string, unknown>) ?? {},
      formula: (patch.formula as Record<string, unknown> | null) ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "table_name,column_name" },
  )

  if (upsertError) {
    logSchemaError("insert system field metadata", upsertError)
    return NextResponse.json({ error: schemaErrorMessage(upsertError) }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const guard = await requireApiAction("crm_settings.system.schema.manage")
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const tableName = tableForCrmModule(searchParams.get("module") ?? "")
  const columnName = searchParams.get("column")?.trim() ?? ""

  if (!tableName || !isValidColumnName(columnName)) {
    return NextResponse.json({ error: "Campo CRM non valido" }, { status: 400 })
  }

  const { client: supabase, response } = schemaAdminClient()
  if (response) return response
  const { error } = await supabase.rpc("crm_admin_drop_column", {
    p_table_name: tableName,
    p_column_name: columnName,
  })

  if (error) {
    logSchemaError("drop column", error)
    return NextResponse.json({ error: schemaErrorMessage(error) }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
