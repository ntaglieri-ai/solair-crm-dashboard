import { CLIENTI_RECORD_COLUMNS } from "@/lib/clienti/zoho-fields"

export const CLIENTI_LIST_COLUMN_NAMES = [
  ...new Set([
    "id",
    "created_at",
    "updated_at",
    "sede",
    "clienti_proprietario_id",
    "installatore_id",
    ...CLIENTI_RECORD_COLUMNS,
  ]),
]
