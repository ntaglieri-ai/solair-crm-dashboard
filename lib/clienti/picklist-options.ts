import {
  option,
  uniqueOptions,
  type ColumnValueOption,
} from "@/lib/crm-settings/column-values"

export type ClienteOptionKind = "select" | "multiselect"

export type ClienteFieldOptionDefinition = {
  appField: string
  column: string
  kind: ClienteOptionKind
  options: ColumnValueOption[]
}

function options(values: string[]) {
  return values
    .filter((value) => value !== "-None-")
    .map((value) => option(value))
}

export const CLIENTI_FIELD_OPTION_DEFINITIONS = [
  {
    appField: "Saluti",
    column: "saluti",
    kind: "select",
    options: options(["Sig.", "Sigg.", "Sig.ra", "Dr.", "Prof."]),
  },
  {
    appField: "Stato Sollecito",
    column: "stato_sollecito",
    kind: "multiselect",
    options: options(["Nessuno", "Mail inviata", "Liberatoria ricevuta", "Riscontro negativo"]),
  },
  {
    appField: "Origine Lead",
    column: "origine_lead",
    kind: "select",
    options: options([
      "Pubblicità",
      "Chiamata urgente",
      "Segnalazione dipendente",
      "Collegamenti esterni",
      "Negozio online",
      "Partner",
      "Relazioni pubbliche",
      "Mostra affari",
      "Alias di posta vendite",
      "Partner seminario",
      "Facebook",
      "Seminario interno",
      "Twitter",
      "Casi web",
      "Download via Web",
      "Ricerca sul web",
      "Posta Web",
      "Chat",
      "Google+",
      "Online Store",
    ]),
  },
  {
    appField: "Modalità iscrizione annullata",
    column: "modalita_iscrizione_annullata",
    kind: "select",
    options: options(["Modulo di consenso", "Manuale", "Link Annulla iscrizione", "Zoho Campaigns"]),
  },
  {
    appField: "Stato arricchito",
    column: "stato_arricchito",
    kind: "select",
    options: options(["Disponibile", "Enriched", "Data not found"]),
  },
  {
    appField: "Zona",
    column: "zona",
    kind: "multiselect",
    options: options(["Sicilia", "Sud", "Centro", "Nord"]),
  },
  {
    appField: "TIPO CTR",
    column: "tipo_ctr",
    kind: "multiselect",
    options: options(["CTR OLD", "CTR BUSINESS", "CTR AMM", "CTR NEW", "DETR. FISC."]),
  },
  {
    appField: "IVA",
    column: "iva",
    kind: "select",
    options: options(["IVA INCLUSA", "IMPONIBILE"]),
  },
  {
    appField: "Modalità di Pagamento",
    column: "modalita_di_pagamento",
    kind: "select",
    options: options([
      "30-50-20",
      "50-50",
      "100% Finanziamento",
      "Finanziamento Parziale",
      "10-20-50-20",
      "20-60-20",
    ]),
  },
  {
    appField: "Intervento 1",
    column: "intervento_1",
    kind: "multiselect",
    options: options(["Solare Termico", "Scaldacqua PDC", "PDC Idronica"]),
  },
  {
    appField: "Intervento 2",
    column: "intervento_2",
    kind: "multiselect",
    options: options(["Solare Termico", "Scaldacqua PDC", "PDC idronica"]),
  },
  {
    appField: "MOD. PAGAMENTO CT3.0",
    column: "mod_pagamento_ct3_0",
    kind: "multiselect",
    options: options(["Bonifico 100%", "Finanziamento 100%"]),
  },
  {
    appField: "Stato Provvigione",
    column: "stato_provvigione",
    kind: "multiselect",
    options: options([
      "Provvigione maturata",
      "Provvigione sospesa",
      "Provvigione pagata",
      "Provvigione da stornare",
      "Provvigione Stornata",
    ]),
  },
  {
    appField: "Tipologia",
    column: "tipologia",
    kind: "select",
    options: options(["Standard", "A vela"]),
  },
  {
    appField: "Stato sopralluogo",
    column: "stato_sopralluogo",
    kind: "select",
    options: options(["Da assegnare", "Assegnato", "Eseguito"]),
  },
  {
    appField: "TIPOLOGIA PROPRIETARIO",
    column: "tipologia_proprietario",
    kind: "select",
    options: options(["PERSONA FISICA", "PERSONA GIURIDICA", "AMMINISTRATORE DI CONDOMINIO"]),
  },
  {
    appField: "Tica",
    column: "tica",
    kind: "select",
    options: options(["SI", "NO"]),
  },
  {
    appField: "TITOLARITA' IMPIANTO",
    column: "titolarita_impianto",
    kind: "select",
    options: options([
      "PROPRIETARIO",
      "TITOLARE DI ALTRO DIRITTO REALE DI GODIMENTO",
      "AMMINISTRATORE DI CONDOMINIO",
    ]),
  },
  {
    appField: "DESIDERA INSTALLARE L'IMPIANTO SU",
    column: "desidera_installare_impianto_su",
    kind: "select",
    options: options(["Edificio", "Struttura o manufatto fuori terra"]),
  },
  {
    appField: "Stato TICA",
    column: "stato_tica",
    kind: "select",
    options: options(["Inviato al cliente", "Ricevuta distinta pagamento", "Inviato a E-Distribuzione"]),
  },
  {
    appField: "TIPO DI TENSIONE",
    column: "tipo_di_tensione",
    kind: "multiselect",
    options: options(["MONOFASE", "TRIFASE"]),
  },
  {
    appField: "Impianto in edilizia libera",
    column: "impianto_in_edilizia_libera",
    kind: "select",
    options: options(["Si", "No"]),
  },
  {
    appField: "Area vincolata",
    column: "area_vincolata",
    kind: "select",
    options: options(["Si", "No"]),
  },
  {
    appField: ">20kW Pot. Nom.",
    column: "potenza_nominale_superiore_20kw",
    kind: "select",
    options: options(["Si", "No"]),
  },
  {
    appField: "Richiesta Saldo",
    column: "richiesta_saldo",
    kind: "multiselect",
    options: options(["Da fare", "In corso", "In Valutazione", "Accettata"]),
  },
  {
    appField: "Configurazione Cer",
    column: "configurazione_cer",
    kind: "multiselect",
    options: options(["Da fare", "In corso", "In valutazione", "Accettata", "In modifica"]),
  },
  {
    appField: "Messaggio Fattura",
    column: "messaggio_fattura",
    kind: "select",
    options: options(["I Fattura", "II Fattura", "III Fattura"]),
  },
] as const satisfies readonly ClienteFieldOptionDefinition[]

export type ClienteOptionColumn = (typeof CLIENTI_FIELD_OPTION_DEFINITIONS)[number]["column"]

/**
 * Colonne a scelta multipla dei Clienti ("A;B" in una colonna text): le
 * tendine multiple qui sopra piu' Stato, le cui opzioni vivono in
 * crm_stato_cliente. Filtri e ricerche le confrontano sui singoli valori.
 */
export const COLONNE_MULTIPLE_CLIENTI: ReadonlySet<string> = new Set([
  ...CLIENTI_FIELD_OPTION_DEFINITIONS.filter((definition) => definition.kind === "multiselect").map(
    (definition) => definition.column as string,
  ),
  "stato",
])

export const CLIENTI_OPTION_COLUMNS = CLIENTI_FIELD_OPTION_DEFINITIONS.map(
  (definition) => definition.column,
) as ClienteOptionColumn[]

export const CLIENTI_PICKLIST_FALLBACKS = Object.fromEntries(
  CLIENTI_FIELD_OPTION_DEFINITIONS.map((definition) => [
    definition.appField,
    {
      column: definition.column,
      kind: definition.kind,
      options: definition.options,
    },
  ]),
) as Record<
  (typeof CLIENTI_FIELD_OPTION_DEFINITIONS)[number]["appField"],
  Pick<ClienteFieldOptionDefinition, "column" | "kind" | "options">
>

export function isClienteOptionColumn(column: string): column is ClienteOptionColumn {
  return (CLIENTI_OPTION_COLUMNS as readonly string[]).includes(column)
}

export function clienteOptionDefinitionByColumn(column: string) {
  return CLIENTI_FIELD_OPTION_DEFINITIONS.find((definition) => definition.column === column)
}

export function clienteOptionDefinitionByField(field: string) {
  return CLIENTI_FIELD_OPTION_DEFINITIONS.find((definition) => definition.appField === field)
}

export function splitClienteOptionValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  return String(value ?? "")
    .split(/[;\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function cleanClienteOptionValues(column: ClienteOptionColumn, value: unknown) {
  const definition = clienteOptionDefinitionByColumn(column)
  const values = definition?.kind === "multiselect"
    ? splitClienteOptionValue(value)
    : [typeof value === "string" ? value.trim() : ""]

  return values.filter((item) => {
    if (!item || item === "—" || item === "-None-") return false
    if (/^\d{8,}$/.test(item)) return false
    if (/^\d{4}-\d{2}-\d{2}/.test(item)) return false
    return true
  })
}

export function mergeClienteOptions(
  column: ClienteOptionColumn,
  configured: ColumnValueOption[],
  importedValues: string[],
) {
  const fallback = clienteOptionDefinitionByColumn(column)?.options ?? []
  return uniqueOptions([
    ...configured,
    ...importedValues.map((value) => option(value)),
    ...fallback,
  ])
}
