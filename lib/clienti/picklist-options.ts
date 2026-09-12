import { option } from "@/lib/crm-settings/column-values"

export const CLIENTI_PICKLIST_FALLBACKS = {
  "Stato sopralluogo": {
    column: "stato_sopralluogo",
    options: ["Da assegnare", "Assegnato", "Eseguito"].map((value) => option(value)),
  },
  "TIPO CTR": {
    column: "tipo_ctr",
    options: ["CTR OLD", "CTR BUSINESS", "CTR AMM", "CTR NEW", "DETR. FISC."].map((value) =>
      option(value),
    ),
  },
  "TIPOLOGIA PROPRIETARIO": {
    column: "tipologia_proprietario",
    options: [
      "PERSONA FISICA",
      "PERSONA GIURIDICA",
      "AMMINISTRATORE DI CONDOMINIO",
    ].map((value) => option(value)),
  },
  "Richiesta Saldo": {
    column: "richiesta_saldo",
    options: ["Da fare", "In corso", "In Valutazione", "Accettata"].map((value) =>
      option(value),
    ),
  },
} as const
