import type { FieldAccess, RoleCode } from "./types"

export type FieldModuleKey =
  | "lead"
  | "clienti"
  | "compiti"
  | "scadenze"
  | "installatori"

export type FieldSensitivityCategory =
  | "Economico interno"
  | "Economico cliente"
  | "Dati identificativi"
  | "Metadati Zoho / sistema"
  | "Marketing / tracking"
  | "Tecnico di progetto"
  | "Anagrafica / operativo"

export type CrmFieldDefinition = {
  module: FieldModuleKey
  key: string
  category: FieldSensitivityCategory
}

export const FIELD_MODULE_LABELS: Record<FieldModuleKey, string> = {
  lead: "Lead",
  clienti: "Clienti",
  compiti: "Compiti",
  scadenze: "Scadenze",
  installatori: "Installatori",
}

export const FIELD_CATEGORY_ORDER: FieldSensitivityCategory[] = [
  "Economico interno",
  "Economico cliente",
  "Dati identificativi",
  "Metadati Zoho / sistema",
  "Marketing / tracking",
  "Tecnico di progetto",
  "Anagrafica / operativo",
]

export const FIELD_ACCESS_OPTIONS: {
  value: FieldAccess
  label: string
  description: string
}[] = [
  {
    value: "editable",
    label: "Modificabile",
    description: "Il campo e' visibile e modificabile.",
  },
  {
    value: "readonly",
    label: "Solo lettura",
    description: "Il campo e' visibile ma non modificabile.",
  },
  {
    value: "hidden",
    label: "Nascosto",
    description: "Il campo non deve essere mostrato.",
  },
]

const MODULE_FIELDS: Record<FieldModuleKey, string[]> = {
  lead: [
    "id", "nome", "cognome", "nome_lead", "email", "telefono", "mobile_fisso",
    "social_lead_id", "residente_in_sicilia", "citta", "provincia",
    "codice_postale", "paese", "stato_lead", "stato_email", "valutazione",
    "lead_proprietario_id", "origine_lead", "sede", "campaign_name", "kwp",
    "kwh", "modello_pannello", "wallbox_richiesto", "data_sopralluogo",
    "installatore_sopralluogo_id", "tempo_conversione_lead",
    "account_convertito_id", "contatto_convertito",
    "modalita_iscrizione_annullata", "ora_iscrizione_annullata", "descrizione",
    "connesso_a", "creato_da", "data_click", "data_ora",
    "ora_ultima_attivita", "created_at", "updated_at", "zoho_id",
    "zoho_owner_id", "zoho_creato_da_id", "zoho_account_convertito_id",
    "zoho_contatto_convertito_id", "zoho_installatore_sopralluogo_id",
    "zoho_connesso_a_id", "zoho_modified_at", "zoho_last_seen_at", "saluti",
    "convertito", "bloccato",
  ],
  clienti: [
    "id", "lead_id", "nome", "cognome", "nome_clienti", "saluti",
    "codice_fiscale", "email", "email_secondaria", "cellulare",
    "altro_telefono", "via_indirizzo_postale", "citta_indirizzo_postale",
    "provincia_indirizzo_postale", "codice_postale_indirizzo", "stato",
    "modalita_iscrizione_annullata", "ora_iscrizione_annullata",
    "clienti_proprietario_id", "origine_lead", "sede", "installatore_id",
    "wallbox", "cantiere_multiplo", "descrizione", "note", "note_ufficio",
    "note_pagamenti", "note_provvigioni", "visita_piu_recente",
    "prima_pagina_visitata", "tempo_medio_impiegato_minuti", "numero_di_chat",
    "relatore", "punteggio_visitatore", "prima_visita", "giorni_visitati",
    "social_lead_id", "codice_rintracciabilita", "stato_provvigione",
    "creato_da", "modificato_da", "data_click", "ora_ultima_attivita",
    "created_at", "updated_at", "zoho_record_id", "clienti_proprietario_zoho_id",
    "clienti_proprietario", "creato_da_zoho_id", "modificato_da_zoho_id",
    "ora_creazione", "ora_modifica", "e_mail_secondaria", "tag",
    "zoho_modified_at", "locked", "ora_ultimo_arricchimento",
    "stato_arricchito", "cod_inverter", "cod_moduli", "cod_storage",
    "disponibilita_magazzino", "installatore_zoho_id", "installatore",
    "nr_inverter", "nr_moduli", "potenza_moduli_wp", "nr_batterie",
    "capacita_batterie", "totale_storage", "tot_potenza_dc",
    "potenza_inverter", "modalita_di_pagamento", "tot_potenza_ac_kw",
    "n_1_tranche", "importo_contrattuale", "bonifico_parziale",
    "importo_finanziamento", "n_2tranche", "saldo",
    "stratigrafia_superficie_di_installazione", "c_o_magazzino_installatore",
    "indirizzo_di_ritiro_merce", "merce_ordinata_e_da_ritirare",
    "c_o_cantiere_del_cliente", "altri_materiali", "importi_extra",
    "assistenza", "data_installazione_ultimata", "inserimento_pratica_gse",
    "iva_reverse_charge", "iva", "n_rate_e_importo_rata", "data_ammissibilita",
    "data_sopralluogo", "corrispettivo_pagato", "mappa_catastale",
    "regolamento_di_esecizio", "attestato_terna", "codice_contratto_pnrr",
    "data_conferma_iter_e_distribuzione", "notifica_pred_reg_esercizio",
    "disponibilita_fine_lavori", "tica", "stato_tica", "importo_da_listino",
    "inserimento_pratica_e_distribuzione", "impianto_in_edilizia_libera",
    "area_vincolata", "potenza_nominale_superiore_20kw", "pod", "zona",
    "stato_sollecito", "tipo_ctr", "iban", "finanziamento_approvato",
    "verifica_documentale", "layout_verificato", "scheda_enea",
    "data_scadenza_tica", "importo_tica", "impianto_attivo",
    "data_appuntamento_allaccio", "tipologia", "retrofit",
    "data_interlocutorio", "eps", "stato_sopralluogo",
    "data_affidamento_sopralluogo", "data_iter_enel_concluso",
    "messaggio_di_benvenuto", "messaggio_prog_preliminare",
    "messaggio_ordine_merce", "messaggio_in_esecuzione",
    "telefonata_post_installazione", "messaggio_fattura", "mod_pagamento_ct3_0",
    "intervento_2", "intervento_1", "fattura2", "fattura1", "sconto_combo",
    "bonifico2", "bonifico1", "st300", "scaldacqua_pdc", "pdc_idronica",
    "stf", "accessori", "litri_accumulo", "n_collettori", "bonificopdc",
    "p_d_c_idronica", "fatturapdc", "incentivoatteso", "di_cui_ct3",
    "tot_contratto", "di_cui_ftv", "codice_inv_batt",
    "codice_ordine_sonepar", "foglio", "cer", "sub", "particella",
    "tipo_di_tensione", "nome_intestatario_utenza_elettrica",
    "e_mail_enel_gaudi", "cognome_intestatario_utenza_elettrica",
    "titolarita_impianto", "desidera_installare_impianto_su",
    "tipologia_proprietario", "potenza_sistema_di_accumulo",
  ],
  compiti: [
    "id", "oggetto", "priorita", "stato", "scadenza", "proprietario_id",
    "correlato_id", "correlato_tipo", "orario_chiusura", "descrizione",
    "created_at", "updated_at", "creato_da", "nome_contatto", "ripeti",
    "promemoria", "sede", "ora_ultima_attivita", "zoho_record_id",
    "proprietario_zoho_id", "proprietario_nome", "nome_contatto_zoho_id",
    "correlato_zoho_id", "correlato_nome", "creato_da_zoho_id",
    "creato_da_nome", "modificato_da_zoho_id", "modificato_da_nome",
    "ora_creazione", "ora_modifica", "tag", "locked",
  ],
  scadenze: [
    "id", "nome", "data_scadenza", "proprietario_id", "descrizione",
    "connesso_a_id", "connesso_a_tipo", "created_at", "updated_at", "zoho_id",
    "proprietario_nome", "tag",
  ],
  installatori: [
    "id", "nome", "email", "email_secondaria", "attivo", "proprietario_id",
    "note", "created_at", "updated_at", "zoho_id", "telefono", "tag",
    "connesso_a_id", "connesso_a_tipo",
  ],
}

const ECON_INTERNAL = new Set([
  "iban", "bonifico1", "bonifico2", "bonifico_parziale", "bonificopdc",
  "codice_ordine_sonepar", "fattura1", "fattura2", "fatturapdc",
  "finanziamento_approvato", "importo_finanziamento", "mod_pagamento_ct3_0",
  "modalita_di_pagamento", "n_1_tranche", "n_2tranche", "note_provvigioni",
  "saldo", "stato_provvigione",
])

const ECON_CLIENT = new Set([
  "di_cui_ct3", "di_cui_ftv", "importo_contrattuale", "importo_da_listino",
  "importo_tica", "incentivoatteso", "iva", "iva_reverse_charge",
  "n_rate_e_importo_rata", "sconto_combo", "tot_contratto",
])

const SENSITIVE_ID = new Set([
  "codice_fiscale", "email", "email_secondaria", "e_mail_secondaria",
  "cellulare", "altro_telefono", "telefono", "mobile_fisso",
  "via_indirizzo_postale", "citta_indirizzo_postale",
  "provincia_indirizzo_postale", "codice_postale_indirizzo",
  "codice_postale", "pod", "nome_intestatario_utenza_elettrica",
  "cognome_intestatario_utenza_elettrica", "e_mail_enel_gaudi",
  "indirizzo_di_ritiro_merce", "stato_email",
])

const AGENT_CONTACT_FIELDS = new Set([
  "email", "email_secondaria", "e_mail_secondaria", "cellulare",
  "altro_telefono", "telefono", "mobile_fisso",
])

const MARKETING = new Set([
  "numero_di_chat", "tempo_medio_impiegato_minuti", "punteggio_visitatore",
  "giorni_visitati", "prima_pagina_visitata", "prima_visita",
  "visita_piu_recente", "relatore", "social_lead_id", "campaign_name",
  "valutazione", "origine_lead", "modalita_iscrizione_annullata",
  "ora_iscrizione_annullata", "tempo_conversione_lead",
])

function isMetadata(field: string) {
  return (
    field.startsWith("zoho_") ||
    field.includes("_zoho_") ||
    field === "zoho_record_id" ||
    field === "created_at" ||
    field === "updated_at" ||
    field === "ora_creazione" ||
    field === "ora_modifica" ||
    field === "ora_ultima_attivita" ||
    field === "locked" ||
    field.startsWith("creato_da") ||
    field.startsWith("modificato_da") ||
    field === "data_click"
  )
}

function isTechnical(field: string) {
  return /kwp|kwh|pannello|wallbox|potenza|installazione|sopralluogo|iter|enel|gse|terna|catastale|edilizia|tica|impianto|tipologia|retrofit|eps|stf|accessori|accumulo|collettori|pdc|scaldacqua|assistenza|disponibilita|cantiere|magazzino|merce|material|attestato|regolamento|particella|foglio|sub|titolarita|messaggio_|telefonata_|st300|batterie|storage|inverter|moduli|contratto_pnrr|zona|sollecito|documentale|layout|scheda_enea|vincolata/.test(field)
}

function categoryForField(field: string): FieldSensitivityCategory {
  if (ECON_INTERNAL.has(field)) return "Economico interno"
  if (ECON_CLIENT.has(field)) return "Economico cliente"
  if (SENSITIVE_ID.has(field)) return "Dati identificativi"
  if (isMetadata(field)) return "Metadati Zoho / sistema"
  if (MARKETING.has(field)) return "Marketing / tracking"
  if (isTechnical(field)) return "Tecnico di progetto"
  return "Anagrafica / operativo"
}

export const CRM_FIELD_CATALOG: Record<FieldModuleKey, CrmFieldDefinition[]> =
  Object.fromEntries(
    Object.entries(MODULE_FIELDS).map(([module, fields]) => [
      module,
      fields.map((key) => ({
        module: module as FieldModuleKey,
        key,
        category: categoryForField(key),
      })),
    ]),
  ) as Record<FieldModuleKey, CrmFieldDefinition[]>

export const CRM_FIELD_MODULES = Object.keys(MODULE_FIELDS) as FieldModuleKey[]

export function normalizeFieldAccess(value: string | null | undefined): FieldAccess {
  if (value === "hidden" || value === "readonly" || value === "editable") return value
  return "hidden"
}

export function fieldAccessLabel(value: string | null | undefined) {
  const access = normalizeFieldAccess(value)
  return FIELD_ACCESS_OPTIONS.find((option) => option.value === access)?.label ?? access
}

export function defaultFieldAccessForRole(
  roleCode: RoleCode | string | null | undefined,
  module: FieldModuleKey,
  field: string,
): FieldAccess {
  const role = (roleCode ?? "STANDARD").toUpperCase()
  const category = categoryForField(field)

  if (role === "SUPERADMIN" || role === "ADMIN") return "editable"

  if (role === "AGENT") {
    if (category === "Economico interno" || category === "Economico cliente") return "hidden"
    if (category === "Metadati Zoho / sistema") return "hidden"
    if (category === "Dati identificativi") {
      return AGENT_CONTACT_FIELDS.has(field) ? "readonly" : "hidden"
    }
    return module === "clienti" ? "readonly" : "editable"
  }

  if (role === "STANDARD") {
    if (category === "Economico interno") return "hidden"
    return "readonly"
  }

  if (role === "DIRECTOR") {
    if (category === "Economico interno") return "hidden"
    return "readonly"
  }

  return "readonly"
}

export function buildFieldPermissionsForRole(
  roleCode: RoleCode | string | null | undefined,
): Record<string, Record<string, FieldAccess>> {
  return Object.fromEntries(
    CRM_FIELD_MODULES.map((module) => [
      module,
      Object.fromEntries(
        CRM_FIELD_CATALOG[module].map((field) => [
          field.key,
          defaultFieldAccessForRole(roleCode, module, field.key),
        ]),
      ),
    ]),
  )
}

export function completeFieldPermissions(
  current: Record<string, Record<string, string>> | undefined,
  roleCode: RoleCode | string | null | undefined,
) {
  const completed = buildFieldPermissionsForRole(roleCode)

  for (const module of CRM_FIELD_MODULES) {
    const moduleCurrent = current?.[module] ?? {}
    const hasWildcard = Object.prototype.hasOwnProperty.call(moduleCurrent, "*")
    const wildcard = normalizeFieldAccess(moduleCurrent["*"])

    for (const field of CRM_FIELD_CATALOG[module]) {
      const existing = moduleCurrent[field.key]
      completed[module][field.key] = existing
        ? normalizeFieldAccess(existing)
        : hasWildcard
          ? wildcard
          : completed[module][field.key]
    }
  }

  return completed
}
